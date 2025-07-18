const express = require('express');
const router = express.Router();

// Get all donations
router.get('/', async (req, res) => {
    try {
        const query = `
      SELECT d.*, 
             dn.first_name, dn.last_name, dn.whatsapp_number,
             CASE 
               WHEN d.type = 'cow' THEN cg.id 
               ELSE NULL 
             END AS cow_group_id,
             (SELECT COUNT(*) FROM media m WHERE m.donation_id = d.id) AS media_count
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      LEFT JOIN cow_shares cs ON d.id = cs.donation_id
      LEFT JOIN cow_groups cg ON cs.cow_group_id = cg.id
      ORDER BY d.created_at DESC
    `;
        const { rows } = await req.app.locals.db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching donations:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Get donation by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
      SELECT d.*, 
             dn.first_name, dn.last_name, dn.whatsapp_number,
             CASE 
               WHEN d.type = 'cow' THEN cg.id 
               ELSE NULL 
             END AS cow_group_id
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      LEFT JOIN cow_shares cs ON d.id = cs.donation_id
      LEFT JOIN cow_groups cg ON cs.cow_group_id = cg.id
      WHERE d.id = $1
    `;
        const { rows } = await req.app.locals.db.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching donation:', error);
        res.status(500).json({ error: 'Failed to fetch donation' });
    }
});

// Create a new donation
router.post('/', async (req, res) => {
    const { donor_id, price, type } = req.body;

    if (!donor_id || !price || !type) {
        return res.status(400).json({ error: 'Donor ID, price, and type are required' });
    }

    if (type !== 'sheep' && type !== 'cow') {
        return res.status(400).json({ error: 'Type must be either "sheep" or "cow"' });
    }

    const client = await req.app.locals.db.connect();

    try {
        await client.query('BEGIN');

        // Insert the donation
        const donationQuery = `
      INSERT INTO donations (donor_id, price, type, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
    `;
        const donationResult = await client.query(donationQuery, [donor_id, price, type]);
        const newDonation = donationResult.rows[0];

        // If this is a cow donation, handle cow sharing logic
        if (type === 'cow') {
            // Find an existing cow group with less than 7 shares
            const cowGroupQuery = `
        SELECT cg.id, COUNT(cs.donation_id) AS share_count
        FROM cow_groups cg
        LEFT JOIN cow_shares cs ON cg.id = cs.cow_group_id
        GROUP BY cg.id
        HAVING COUNT(cs.donation_id) < 7
        ORDER BY COUNT(cs.donation_id) DESC
        LIMIT 1
      `;
            const cowGroupResult = await client.query(cowGroupQuery);

            let cowGroupId;

            // If no group exists or all groups are full, create a new one
            if (cowGroupResult.rows.length === 0) {
                const newGroupQuery = `
          INSERT INTO cow_groups DEFAULT VALUES RETURNING id
        `;
                const newGroupResult = await client.query(newGroupQuery);
                cowGroupId = newGroupResult.rows[0].id;
            } else {
                cowGroupId = cowGroupResult.rows[0].id;
            }

            // Add this donation to the cow group
            const cowShareQuery = `
        INSERT INTO cow_shares (donation_id, cow_group_id)
        VALUES ($1, $2)
        RETURNING *
      `;
            await client.query(cowShareQuery, [newDonation.id, cowGroupId]);
        }

        await client.query('COMMIT');

        res.status(201).json(newDonation);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating donation:', error);
        res.status(500).json({ error: 'Failed to create donation' });
    } finally {
        client.release();
    }
});

// Update donation status
router.put('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    if (!['pending', 'sending', 'done'].includes(status)) {
        return res.status(400).json({ error: 'Status must be either "pending", "sending", or "done"' });
    }

    console.log(`Updating donation ${id} status to ${status}`);

    try {
        let query, params;

        if (status === 'done') {
            query = `
        UPDATE donations
        SET status = $1, completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
        } else {
            query = `
        UPDATE donations
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;
        }

        params = [status, id];
        const { rows } = await req.app.locals.db.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        console.log(`Donation ${id} status updated to ${status}`);

        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating donation status:', error);
        res.status(500).json({ error: 'Failed to update donation status' });
    }
});

// Get dashboard counts
router.get('/dashboard-counts', async (req, res) => {
    try {
        console.log('Fetching dashboard counts...');

        let pendingSheepCount = 0;
        let pendingCowSharesCount = 0;
        let totalPendingValue = 0;

        // Get pending sheep count

        try {
            const sheepQuery = `SELECT COUNT(*)::int AS count FROM donations WHERE type = 'sheep' AND status = 'pending'`;
            const pendingSheepResult = await req.app.locals.db.query(sheepQuery);
            pendingSheepCount = Number(pendingSheepResult.rows[0]?.count || 0);
        } catch (err) {
            console.error('Error counting pending sheep:', err);
            if (err && err.message) console.error('Sheep Query Error:', err.message);
        }

        // Get pending cow count
        try {
            const cowQuery = `SELECT COUNT(*)::int AS count FROM donations WHERE type = 'cow' AND status = 'pending'`;
            const pendingCowResult = await req.app.locals.db.query(cowQuery);
            pendingCowSharesCount = Number(pendingCowResult.rows[0]?.count || 0);
        } catch (err) {
            console.error('Error counting pending cows:', err);
            if (err && err.message) console.error('Cow Query Error:', err.message);
        }

        // Get total pending value
        try {
            const valueQuery = `SELECT COALESCE(SUM(price), 0)::float AS total_value FROM donations WHERE status = 'pending'`;
            const pendingValueResult = await req.app.locals.db.query(valueQuery);
            totalPendingValue = Number(pendingValueResult.rows[0]?.total_value || 0);
        } catch (err) {
            console.error('Error calculating total pending value:', err);
            if (err && err.message) console.error('Value Query Error:', err.message);
        }

        const pendingCowGroups = Math.floor(pendingCowSharesCount / 7);
        const remainingCowShares = pendingCowSharesCount % 7;

        const result = {
            pendingSheepCount,
            pendingCowSharesCount,
            pendingCowGroups,
            remainingCowShares,
            totalValue: totalPendingValue
        };

        console.log('Dashboard counts:', result);

        res.json(result);
    } catch (error) {
        console.error('Error fetching dashboard counts:', error);
        if (error && error.message) console.error('Dashboard Counts Error:', error.message);
        // Send a fallback response to avoid frontend errors
        console.error('Dashboard Counts Error Stack:', error?.stack || error);
        res.status(500).json({
            pendingSheepCount: 0,
            pendingCowSharesCount: 0,
            pendingCowGroups: 0,
            remainingCowShares: 0,
            totalValue: 0,
            error: error?.message || "An error occurred calculating dashboard statistics"
        });
    }
});

// Get donations by status
router.get('/status/:status', async (req, res) => {
    const { status } = req.params;

    if (!['pending', 'sending', 'done'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status parameter' });
    }

    try {
        const query = `
      SELECT d.*, 
             dn.first_name, dn.last_name, dn.whatsapp_number
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      WHERE d.status = $1
      ORDER BY d.created_at DESC
    `;
        const { rows } = await req.app.locals.db.query(query, [status]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching donations by status:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

module.exports = router;
