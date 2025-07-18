const express = require('express');
const router = express.Router();

// Get all donors
router.get('/', async (req, res) => {
    try {
        const query = `
      SELECT d.*, 
             COUNT(dn.id) AS donation_count,
             SUM(CASE WHEN dn.status = 'done' THEN 1 ELSE 0 END) AS completed_donations
      FROM donors d
      LEFT JOIN donations dn ON d.id = dn.donor_id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `;
        const { rows } = await req.app.locals.db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching donors:', error);
        res.status(500).json({ error: 'Failed to fetch donors' });
    }
});

// Get donor by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
      SELECT d.*, 
             COUNT(dn.id) AS donation_count,
             SUM(CASE WHEN dn.status = 'done' THEN 1 ELSE 0 END) AS completed_donations
      FROM donors d
      LEFT JOIN donations dn ON d.id = dn.donor_id
      WHERE d.id = $1
      GROUP BY d.id
    `;
        const { rows } = await req.app.locals.db.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Donor not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching donor:', error);
        res.status(500).json({ error: 'Failed to fetch donor' });
    }
});

// Create a new donor
router.post('/', async (req, res) => {
    const { first_name, last_name, whatsapp_number } = req.body;

    if (!first_name || !last_name || !whatsapp_number) {
        return res.status(400).json({ error: 'First name, last name, and WhatsApp number are required' });
    }

    try {
        const query = `
      INSERT INTO donors (first_name, last_name, whatsapp_number)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
        const { rows } = await req.app.locals.db.query(query, [first_name, last_name, whatsapp_number]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating donor:', error);
        res.status(500).json({ error: 'Failed to create donor' });
    }
});

// Update a donor
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, whatsapp_number } = req.body;

    if (!first_name || !last_name || !whatsapp_number) {
        return res.status(400).json({ error: 'First name, last name, and WhatsApp number are required' });
    }

    try {
        const query = `
      UPDATE donors
      SET first_name = $1, last_name = $2, whatsapp_number = $3
      WHERE id = $4
      RETURNING *
    `;
        const { rows } = await req.app.locals.db.query(query, [first_name, last_name, whatsapp_number, id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Donor not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating donor:', error);
        res.status(500).json({ error: 'Failed to update donor' });
    }
});

// Delete a donor
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `DELETE FROM donors WHERE id = $1 RETURNING *`;
        const { rows } = await req.app.locals.db.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Donor not found' });
        }

        res.json({ message: 'Donor deleted successfully' });
    } catch (error) {
        console.error('Error deleting donor:', error);
        res.status(500).json({ error: 'Failed to delete donor' });
    }
});

// Get donations for a donor
router.get('/:id/donations', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
      SELECT d.*
      FROM donations d
      WHERE d.donor_id = $1
      ORDER BY d.created_at DESC
    `;
        const { rows } = await req.app.locals.db.query(query, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching donor donations:', error);
        res.status(500).json({ error: 'Failed to fetch donor donations' });
    }
});

module.exports = router;
