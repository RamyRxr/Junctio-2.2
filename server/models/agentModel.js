const db = require('../config/db');

const agentModel = {
    // Get all agents
    getAllAgents: async () => {
        const query = `
      SELECT a.*,
             COUNT(ad.donation_id) AS total_donations,
             SUM(CASE WHEN d.status = 'done' THEN 1 ELSE 0 END) AS completed_donations
      FROM agent_assignments a
      LEFT JOIN agent_donations ad ON a.id = ad.agent_id
      LEFT JOIN donations d ON ad.donation_id = d.id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `;
        const result = await db.query(query);
        return result.rows;
    },

    // Get agent by ID
    getAgentById: async (id) => {
        const query = `
      SELECT a.*,
             COUNT(ad.donation_id) AS total_donations,
             SUM(CASE WHEN d.status = 'done' THEN 1 ELSE 0 END) AS completed_donations
      FROM agent_assignments a
      LEFT JOIN agent_donations ad ON a.id = ad.agent_id
      LEFT JOIN donations d ON ad.donation_id = d.id
      WHERE a.id = $1
      GROUP BY a.id
    `;
        const result = await db.query(query, [id]);
        return result.rows[0];
    },

    // Create new agent
    createAgent: async (agentName) => {
        const query = `
      INSERT INTO agent_assignments (agent_name)
      VALUES ($1)
      RETURNING *
    `;
        const result = await db.query(query, [agentName]);
        return result.rows[0];
    },

    // Update agent
    updateAgent: async (id, agentName) => {
        const query = `
      UPDATE agent_assignments
      SET agent_name = $1
      WHERE id = $2
      RETURNING *
    `;
        const result = await db.query(query, [agentName, id]);
        return result.rows[0];
    },

    // Delete agent
    deleteAgent: async (id) => {
        const query = 'DELETE FROM agent_assignments WHERE id = $1 RETURNING *';
        const result = await db.query(query, [id]);
        return result.rows[0];
    },

    // Assign donations to agent
    assignDonationsToAgent: async (agentId, donationIds) => {
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            // Delete existing assignments for these donations
            const deleteQuery = `
        DELETE FROM agent_donations
        WHERE donation_id = ANY($1::int[])
      `;
            await client.query(deleteQuery, [donationIds]);

            // Create new assignments
            const values = donationIds.map(donationId => `(${agentId}, ${donationId})`).join(', ');
            const insertQuery = `
        INSERT INTO agent_donations (agent_id, donation_id)
        VALUES ${values}
        RETURNING *
      `;
            const result = await client.query(insertQuery);

            // Update donation status to 'assigned'
            const updateQuery = `
        UPDATE donations
        SET status = CASE WHEN status = 'pending' THEN 'sending' ELSE status END
        WHERE id = ANY($1::int[])
      `;
            await client.query(updateQuery, [donationIds]);

            await client.query('COMMIT');

            return result.rows;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    // Get donations assigned to agent
    getDonationsByAgentId: async (agentId) => {
        const query = `
      SELECT d.*, 
             dn.first_name, dn.last_name, dn.whatsapp_number,
             CASE WHEN d.type = 'cow' THEN cs.cow_group_id ELSE NULL END AS cow_group_id,
             (SELECT COUNT(*) FROM media m WHERE m.donation_id = d.id) > 0 AS has_media
      FROM agent_donations ad
      JOIN donations d ON ad.donation_id = d.id
      JOIN donors dn ON d.donor_id = dn.id
      LEFT JOIN cow_shares cs ON d.id = cs.donation_id
      WHERE ad.agent_id = $1
      ORDER BY d.type, d.created_at ASC
    `;

        const result = await db.query(query, [agentId]);

        // Process results to group cow donations by cow_group_id
        const sheepDonations = result.rows.filter(d => d.type === 'sheep');
        const cowDonations = result.rows.filter(d => d.type === 'cow');

        // Group cows by cow_group_id
        const cowGroups = {};
        cowDonations.forEach(donation => {
            const groupId = donation.cow_group_id;
            if (!cowGroups[groupId]) {
                cowGroups[groupId] = [];
            }
            cowGroups[groupId].push(donation);
        });

        return {
            sheepDonations,
            cowGroups: Object.values(cowGroups)
        };
    },

    // Split donations between agents
    splitDonationsBetweenAgents: async (agents, sheepDonationIds, cowGroupIds) => {
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            // Delete existing assignments
            const deleteQuery = `
        DELETE FROM agent_donations
        WHERE donation_id = ANY($1::int[])
      `;
            const allDonationIds = [...sheepDonationIds];

            // Get all donation IDs from cow groups
            if (cowGroupIds.length > 0) {
                const cowDonationQuery = `
          SELECT d.id
          FROM donations d
          JOIN cow_shares cs ON d.id = cs.donation_id
          WHERE cs.cow_group_id = ANY($1::int[])
        `;
                const cowDonationResult = await client.query(cowDonationQuery, [cowGroupIds]);
                const cowDonationIds = cowDonationResult.rows.map(row => row.id);
                allDonationIds.push(...cowDonationIds);
            }

            await client.query(deleteQuery, [allDonationIds]);

            // Calculate donations per agent
            const sheepPerAgent = Math.ceil(sheepDonationIds.length / agents.length);
            const cowGroupsPerAgent = Math.ceil(cowGroupIds.length / agents.length);

            // Assign sheep donations
            for (let i = 0; i < agents.length; i++) {
                const start = i * sheepPerAgent;
                const end = Math.min(start + sheepPerAgent, sheepDonationIds.length);
                const agentSheepDonations = sheepDonationIds.slice(start, end);

                if (agentSheepDonations.length > 0) {
                    const sheepValues = agentSheepDonations.map(id => `(${agents[i].id}, ${id})`).join(', ');
                    const insertSheepQuery = `
            INSERT INTO agent_donations (agent_id, donation_id)
            VALUES ${sheepValues}
          `;
                    await client.query(insertSheepQuery);
                }

                // Assign cow groups
                const cowStart = i * cowGroupsPerAgent;
                const cowEnd = Math.min(cowStart + cowGroupsPerAgent, cowGroupIds.length);
                const agentCowGroups = cowGroupIds.slice(cowStart, cowEnd);

                if (agentCowGroups.length > 0) {
                    const cowDonationQuery = `
            SELECT d.id
            FROM donations d
            JOIN cow_shares cs ON d.id = cs.donation_id
            WHERE cs.cow_group_id = ANY($1::int[])
          `;
                    const cowDonationResult = await client.query(cowDonationQuery, [agentCowGroups]);
                    const cowDonationIds = cowDonationResult.rows.map(row => row.id);

                    if (cowDonationIds.length > 0) {
                        const cowValues = cowDonationIds.map(id => `(${agents[i].id}, ${id})`).join(', ');
                        const insertCowQuery = `
              INSERT INTO agent_donations (agent_id, donation_id)
              VALUES ${cowValues}
            `;
                        await client.query(insertCowQuery);
                    }
                }
            }

            // Update donation status to 'sending' for all assigned donations
            const updateQuery = `
        UPDATE donations
        SET status = 'sending'
        WHERE id = ANY($1::int[]) AND status = 'pending'
      `;
            await client.query(updateQuery, [allDonationIds]);

            await client.query('COMMIT');

            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = agentModel;
