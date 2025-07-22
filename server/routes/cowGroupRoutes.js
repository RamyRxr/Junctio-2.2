const express = require('express');
const router = express.Router();

// Get all cow groups
router.get('/', async (req, res) => {
    try {
        const query = `
      SELECT cg.*, COUNT(cs.donation_id) as share_count
      FROM cow_groups cg
      LEFT JOIN cow_shares cs ON cg.id = cs.cow_group_id
      GROUP BY cg.id
      ORDER BY cg.created_at DESC
    `;
        const { rows } = await req.app.locals.db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching cow groups:', error);
        res.status(500).json({ error: 'Failed to fetch cow groups' });
    }
});

// Get cow group by ID with its shares
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
      SELECT cg.*, 
             d.id as donation_id, 
             d.status, 
             dn.first_name, 
             dn.last_name,
             dn.whatsapp_number
      FROM cow_groups cg
      LEFT JOIN cow_shares cs ON cg.id = cs.cow_group_id
      LEFT JOIN donations d ON cs.donation_id = d.id
      LEFT JOIN donors dn ON d.donor_id = dn.id
      WHERE cg.id = $1
    `;
        const { rows } = await req.app.locals.db.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Cow group not found' });
        }

        const result = {
            id: rows[0].id,
            created_at: rows[0].created_at,
            shares: rows.map(row => ({
                donation_id: row.donation_id,
                status: row.status,
                donor: row.first_name ? {
                    first_name: row.first_name,
                    last_name: row.last_name,
                    whatsapp_number: row.whatsapp_number
                } : null
            })).filter(share => share.donation_id)
        };

        res.json(result);
    } catch (error) {
        console.error('Error fetching cow group:', error);
        res.status(500).json({ error: 'Failed to fetch cow group' });
    }
});

// Create a new cow group
router.post('/', async (req, res) => {
    try {
        const query = `INSERT INTO cow_groups DEFAULT VALUES RETURNING *`;
        const { rows } = await req.app.locals.db.query(query);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating cow group:', error);
        res.status(500).json({ error: 'Failed to create cow group' });
    }
});

// Add a donation to a cow group
router.post('/:id/shares', async (req, res) => {
    const { id } = req.params;
    const { donation_id } = req.body;

    if (!donation_id) {
        return res.status(400).json({ error: 'Donation ID is required' });
    }

    try {
        // Check if cow group exists
        const checkGroupQuery = `SELECT * FROM cow_groups WHERE id = $1`;
        const groupResult = await req.app.locals.db.query(checkGroupQuery, [id]);

        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cow group not found' });
        }

        // Check if donation exists and is type 'cow'
        const checkDonationQuery = `
      SELECT * FROM donations WHERE id = $1 AND type = 'cow'
    `;
        const donationResult = await req.app.locals.db.query(checkDonationQuery, [donation_id]);

        if (donationResult.rows.length === 0) {
            return res.status(400).json({ error: 'Donation not found or not a cow donation' });
        }

        // Check if the cow group already has 7 shares
        const countQuery = `
      SELECT COUNT(*) FROM cow_shares WHERE cow_group_id = $1
    `;
        const countResult = await req.app.locals.db.query(countQuery, [id]);

        if (parseInt(countResult.rows[0].count) >= 7) {
            return res.status(400).json({ error: 'Cow group already has maximum shares (7)' });
        }

        // Add the donation to the cow group
        const insertQuery = `
      INSERT INTO cow_shares (donation_id, cow_group_id)
      VALUES ($1, $2)
      RETURNING *
    `;
        const { rows } = await req.app.locals.db.query(insertQuery, [donation_id, id]);

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error adding share to cow group:', error);
        res.status(500).json({ error: 'Failed to add share to cow group' });
    }
});

module.exports = router;
