const express = require('express');
const router = express.Router();

// Get donation statistics
router.get('/donations', async (req, res) => {
    try {
        const { period = 'week' } = req.query;

        // Determine the date range based on the period
        const now = new Date();
        let startDate;
        let groupBy;

        switch (period) {
            case 'week':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 7);
                groupBy = 'day';
                break;
            case '2weeks':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 14);
                groupBy = 'day';
                break;
            case 'month':
                startDate = new Date(now);
                startDate.setMonth(startDate.getMonth() - 1);
                groupBy = 'day';
                break;
            case '3months':
                startDate = new Date(now);
                startDate.setMonth(startDate.getMonth() - 3);
                groupBy = 'week';
                break;
            case '6months':
                startDate = new Date(now);
                startDate.setMonth(startDate.getMonth() - 6);
                groupBy = 'month';
                break;
            case '9months':
                startDate = new Date(now);
                startDate.setMonth(startDate.getMonth() - 9);
                groupBy = 'month';
                break;
            case 'year':
                startDate = new Date(now);
                startDate.setFullYear(startDate.getFullYear() - 1);
                groupBy = 'month';
                break;
            case 'all':
            default:
                startDate = new Date(0); // Beginning of time
                groupBy = 'month';
        }

        // Format the date for SQL
        const formattedStartDate = startDate.toISOString().split('T')[0];

        let query;

        if (groupBy === 'day') {
            query = `
                SELECT 
                    DATE(d.created_at) as date,
                    TO_CHAR(d.created_at, 'Mon DD') as name,
                    SUM(CASE WHEN d.type = 'sheep' THEN d.price ELSE 0 END) as "sheepValue",
                    SUM(CASE WHEN d.type = 'cow' THEN d.price ELSE 0 END) as "cowValue",
                    SUM(d.price) as total
                FROM 
                    donations d
                WHERE 
                    d.created_at >= $1
                GROUP BY 
                    DATE(d.created_at), 
                    TO_CHAR(d.created_at, 'Mon DD')
                ORDER BY 
                    date ASC
            `;
        } else if (groupBy === 'week') {
            query = `
                SELECT 
                    DATE_TRUNC('week', d.created_at) as date,
                    'Week ' || TO_CHAR(d.created_at, 'WW') as name,
                    SUM(CASE WHEN d.type = 'sheep' THEN d.price ELSE 0 END) as "sheepValue",
                    SUM(CASE WHEN d.type = 'cow' THEN d.price ELSE 0 END) as "cowValue",
                    SUM(d.price) as total
                FROM 
                    donations d
                WHERE 
                    d.created_at >= $1
                GROUP BY 
                    DATE_TRUNC('week', d.created_at),
                    'Week ' || TO_CHAR(d.created_at, 'WW')
                ORDER BY 
                    date ASC
            `;
        } else {
            query = `
                SELECT 
                    DATE_TRUNC('month', d.created_at) as date,
                    TO_CHAR(d.created_at, 'Mon YYYY') as name,
                    SUM(CASE WHEN d.type = 'sheep' THEN d.price ELSE 0 END) as "sheepValue",
                    SUM(CASE WHEN d.type = 'cow' THEN d.price ELSE 0 END) as "cowValue",
                    SUM(d.price) as total
                FROM 
                    donations d
                WHERE 
                    d.created_at >= $1
                GROUP BY 
                    DATE_TRUNC('month', d.created_at),
                    TO_CHAR(d.created_at, 'Mon YYYY')
                ORDER BY 
                    date ASC
            `;
        }

        const { rows } = await req.app.locals.db.query(query, [formattedStartDate]);

        // If no data is found, return an empty array
        if (rows.length === 0) {
            return res.json([]);
        }

        // Format the data to match the expected structure in the frontend
        const formattedData = rows.map(row => ({
            name: row.name,
            date: row.date,
            sheepValue: parseInt(row.sheepValue) || 0,
            cowValue: parseInt(row.cowValue) || 0,
            total: parseInt(row.total) || 0
        }));

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching donation statistics:', error);
        res.status(500).json({ error: 'Failed to fetch donation statistics' });
    }
});

module.exports = router;
