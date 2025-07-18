const express = require('express');
const router = express.Router();

// Get all agents with detailed statistics
router.get('/', async (req, res) => {
    try {
        const query = `
      SELECT a.*,
             COUNT(ad.donation_id) AS total_donations,
             SUM(CASE WHEN d.status = 'done' THEN 1 ELSE 0 END) AS completed_donations,
             SUM(CASE WHEN d.status = 'pending' OR d.status = 'sending' THEN 1 ELSE 0 END) AS pending_donations,
             ROUND(
               CASE 
                 WHEN COUNT(ad.donation_id) > 0 
                 THEN (SUM(CASE WHEN d.status = 'done' THEN 1 ELSE 0 END)::float / COUNT(ad.donation_id)) * 100 
                 ELSE 0 
               END
             ) AS completion_percentage
      FROM agent_assignments a
      LEFT JOIN agent_donations ad ON a.id = ad.agent_id
      LEFT JOIN donations d ON ad.donation_id = d.id
      GROUP BY a.id
      ORDER BY pending_donations DESC, a.created_at DESC
    `;
        const { rows } = await req.app.locals.db.query(query);

        // Add sheep and cow counts
        for (const agent of rows) {
            try {
                // Get sheep counts
                const sheepQuery = `
          SELECT COUNT(*) as count
          FROM agent_donations ad
          JOIN donations d ON ad.donation_id = d.id
          WHERE ad.agent_id = $1 AND d.type = 'sheep'
        `;
                const sheepResult = await req.app.locals.db.query(sheepQuery, [agent.id]);
                agent.sheep_count = parseInt(sheepResult.rows[0].count) || 0;

                // Get cow counts
                const cowQuery = `
          SELECT COUNT(*) as count
          FROM agent_donations ad
          JOIN donations d ON ad.donation_id = d.id
          WHERE ad.agent_id = $1 AND d.type = 'cow'
        `;
                const cowResult = await req.app.locals.db.query(cowQuery, [agent.id]);
                agent.cow_count = parseInt(cowResult.rows[0].count) || 0;
            } catch (error) {
                console.error(`Error getting counts for agent ${agent.id}:`, error);
            }
        }

        console.log(`Returning ${rows.length} agents with stats`);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

// Create a new agent
router.post('/', async (req, res) => {
    const { agent_name } = req.body;

    if (!agent_name) {
        return res.status(400).json({ error: 'Agent name is required' });
    }

    try {
        const query = `
      INSERT INTO agent_assignments (agent_name)
      VALUES ($1)
      RETURNING *
    `;
        const { rows } = await req.app.locals.db.query(query, [agent_name]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({ error: 'Failed to create agent' });
    }
});

// Get donations assigned to an agent
router.get('/:id/donations', async (req, res) => {
    const { id } = req.params;

    try {
        // Get sheep donations
        const sheepQuery = `
      SELECT d.*, 
             dn.first_name, dn.last_name, dn.whatsapp_number
      FROM agent_donations ad
      JOIN donations d ON ad.donation_id = d.id
      JOIN donors dn ON d.donor_id = dn.id
      WHERE ad.agent_id = $1 AND d.type = 'sheep'
      ORDER BY d.created_at ASC
    `;
        const sheepResult = await req.app.locals.db.query(sheepQuery, [id]);

        // Get cow donations grouped by cow group
        const cowQuery = `
      SELECT d.*,
             dn.first_name, dn.last_name, dn.whatsapp_number,
             cs.cow_group_id
      FROM agent_donations ad
      JOIN donations d ON ad.donation_id = d.id
      JOIN donors dn ON d.donor_id = dn.id
      JOIN cow_shares cs ON d.id = cs.donation_id
      WHERE ad.agent_id = $1 AND d.type = 'cow'
      ORDER BY cs.cow_group_id, d.created_at ASC
    `;
        const cowResult = await req.app.locals.db.query(cowQuery, [id]);

        // Group cow donations by cow_group_id
        const cowGroups = {};
        cowResult.rows.forEach(row => {
            const groupId = row.cow_group_id;
            if (!cowGroups[groupId]) {
                cowGroups[groupId] = [];
            }
            cowGroups[groupId].push(row);
        });

        res.json({
            sheepDonations: sheepResult.rows,
            cowGroups
        });
    } catch (error) {
        console.error('Error fetching agent donations:', error);
        res.status(500).json({ error: 'Failed to fetch agent donations' });
    }
});

// Split donations between agents
router.post('/split', async (req, res) => {
    const { agent_names } = req.body;

    if (!agent_names || !Array.isArray(agent_names) || agent_names.length === 0) {
        return res.status(400).json({ error: 'Agent names array is required' });
    }

    const client = await req.app.locals.db.connect();

    try {
        await client.query('BEGIN');

        // Create agents if they don't exist
        const agents = [];
        for (const name of agent_names) {
            const agentQuery = `
        INSERT INTO agent_assignments (agent_name)
        VALUES ($1)
        RETURNING *
      `;
            const agentResult = await client.query(agentQuery, [name]);
            agents.push(agentResult.rows[0]);
        }

        // Get pending sheep donations
        const sheepQuery = `
      SELECT id FROM donations
      WHERE type = 'sheep' AND status = 'pending'
    `;
        const sheepResult = await client.query(sheepQuery);
        const sheepDonationIds = sheepResult.rows.map(row => row.id);

        // Get complete cow groups (with exactly 7 shares)
        const cowGroupsQuery = `
      SELECT cs.cow_group_id
      FROM cow_shares cs
      JOIN donations d ON cs.donation_id = d.id
      WHERE d.status = 'pending'
      GROUP BY cs.cow_group_id
      HAVING COUNT(cs.donation_id) = 7
    `;
        const cowGroupsResult = await client.query(cowGroupsQuery);
        const cowGroupIds = cowGroupsResult.rows.map(row => row.cow_group_id);

        // Calculate donations per agent
        const sheepPerAgent = Math.ceil(sheepDonationIds.length / agents.length);
        const cowGroupsPerAgent = Math.ceil(cowGroupIds.length / agents.length);

        // Distribute sheep donations
        for (let i = 0; i < agents.length; i++) {
            const start = i * sheepPerAgent;
            const end = Math.min(start + sheepPerAgent, sheepDonationIds.length);
            const agentSheepDonations = sheepDonationIds.slice(start, end);

            if (agentSheepDonations.length > 0) {
                const values = agentSheepDonations.map((id, index) => `($1, $${index + 2})`).join(', ');
                const params = [agents[i].id, ...agentSheepDonations];

                const insertSheepQuery = `
          INSERT INTO agent_donations (agent_id, donation_id)
          VALUES ${values}
        `;
                await client.query(insertSheepQuery, params);

                // Update donation status to 'sending'
                const updateStatusQuery = `
          UPDATE donations
          SET status = 'sending'
          WHERE id = ANY($1::int[]) AND status = 'pending'
        `;
                await client.query(updateStatusQuery, [agentSheepDonations]);
            }
        }

        // Distribute cow groups
        for (let i = 0; i < agents.length && cowGroupIds.length > 0; i++) {
            const start = i * cowGroupsPerAgent;
            const end = Math.min(start + cowGroupsPerAgent, cowGroupIds.length);
            const agentCowGroups = cowGroupIds.slice(start, end);

            if (agentCowGroups.length > 0) {
                // Get donation IDs for these cow groups
                const donationIdsQuery = `
          SELECT d.id
          FROM donations d
          JOIN cow_shares cs ON d.id = cs.donation_id
          WHERE cs.cow_group_id = ANY($1::int[])
        `;
                const donationIdsResult = await client.query(donationIdsQuery, [agentCowGroups]);
                const cowDonationIds = donationIdsResult.rows.map(row => row.id);

                if (cowDonationIds.length > 0) {
                    const values = cowDonationIds.map((id, index) => `($1, $${index + 2})`).join(', ');
                    const params = [agents[i].id, ...cowDonationIds];

                    const insertCowQuery = `
            INSERT INTO agent_donations (agent_id, donation_id)
            VALUES ${values}
          `;
                    await client.query(insertCowQuery, params);

                    // Update donation status to 'sending'
                    const updateStatusQuery = `
            UPDATE donations
            SET status = 'sending'
            WHERE id = ANY($1::int[]) AND status = 'pending'
          `;
                    await client.query(updateStatusQuery, [cowDonationIds]);
                }
            }
        }

        await client.query('COMMIT');

        // Fetch complete agent information with statistics for immediate dashboard update
        const agentsWithStats = [];
        for (const agent of agents) {
            // Get basic stats for each agent
            const statsQuery = `
        SELECT 
          COUNT(ad.donation_id) AS total_donations,
          SUM(CASE WHEN d.status = 'done' THEN 1 ELSE 0 END) AS completed_donations,
          SUM(CASE WHEN d.status = 'pending' OR d.status = 'sending' THEN 1 ELSE 0 END) AS pending_donations,
          ROUND(
            CASE 
              WHEN COUNT(ad.donation_id) > 0 
              THEN (SUM(CASE WHEN d.status = 'done' THEN 1 ELSE 0 END)::float / COUNT(ad.donation_id)) * 100 
              ELSE 0 
            END
          ) AS completion_percentage
        FROM agent_donations ad
        LEFT JOIN donations d ON ad.donation_id = d.id
        WHERE ad.agent_id = $1
        GROUP BY ad.agent_id
      `;
            const statsResult = await client.query(statsQuery, [agent.id]);
            const stats = statsResult.rows[0] || {
                total_donations: 0,
                completed_donations: 0,
                pending_donations: 0,
                completion_percentage: 0
            };

            // Get sheep count
            const sheepQuery = `
        SELECT COUNT(*) as count
        FROM agent_donations ad
        JOIN donations d ON ad.donation_id = d.id
        WHERE ad.agent_id = $1 AND d.type = 'sheep'
      `;
            const sheepResult = await client.query(sheepQuery, [agent.id]);
            const sheep_count = parseInt(sheepResult.rows[0].count) || 0;

            // Get cow count
            const cowQuery = `
        SELECT COUNT(*) as count
        FROM agent_donations ad
        JOIN donations d ON ad.donation_id = d.id
        WHERE ad.agent_id = $1 AND d.type = 'cow'
      `;
            const cowResult = await client.query(cowQuery, [agent.id]);
            const cow_count = parseInt(cowResult.rows[0].count) || 0;

            // Combine all information
            agentsWithStats.push({
                ...agent,
                ...stats,
                sheep_count,
                cow_count
            });
        }

        res.json({
            message: 'Donations split successfully',
            agents: agentsWithStats,
            sheepCount: sheepDonationIds.length,
            cowGroupsCount: cowGroupIds.length
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error splitting donations:', error);
        res.status(500).json({ error: 'Failed to split donations' });
    } finally {
        client.release();
    }
});

module.exports = router;
