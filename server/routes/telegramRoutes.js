const express = require('express');
const router = express.Router();
const axios = require('axios');

// POST /api/telegram/sendMedia
router.post('/sendMedia', async (req, res) => {
    const { donor, mediaUrl, type } = req.body;
    // Replace with your Telegram bot logic
    try {
        // Example: send to Telegram using bot API
        // await axios.post('https://api.telegram.org/bot<token>/sendMessage', { ... })
        // You need to map donor info to a chat_id or phone number
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send via Telegram' });
    }
});

module.exports = router;
