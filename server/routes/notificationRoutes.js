const express = require('express');
const router = express.Router();

// Get all notifications
router.get('/', async (req, res) => {
    try {
        const query = `
      SELECT * FROM notifications
      ORDER BY created_at DESC
    `;
        const { rows } = await req.app.locals.db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Create a new notification
router.post('/', async (req, res) => {
    const { donation_id, message } = req.body;

    if (!donation_id || !message) {
        return res.status(400).json({ error: 'Donation ID and message are required' });
    }

    try {
        const query = `
      INSERT INTO notifications (donation_id, message, sent)
      VALUES ($1, $2, false)
      RETURNING *
    `;
        const { rows } = await req.app.locals.db.query(query, [donation_id, message]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

module.exports = router;
