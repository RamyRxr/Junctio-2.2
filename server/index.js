const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { Pool } = require('pg');
const donorRoutes = require('./routes/donorRoutes');
const donationRoutes = require('./routes/donationRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const agentRoutes = require('./routes/agentRoutes');
const cowGroupRoutes = require('./routes/cowGroupRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'junction',
    password: process.env.DB_PASSWORD || 'Ramy2024',
    port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err.stack);
    } else {
        console.log('Database connected:', res.rows[0]);
    }
});

// Make pool available to routes
app.locals.db = pool;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Add Cross-Origin Isolation headers for WASM
app.use((req, res, next) => {
    res.header("Cross-Origin-Embedder-Policy", "require-corp");
    res.header("Cross-Origin-Opener-Policy", "same-origin");
    next();
});

// Set up static file serving for uploaded media
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/donors', donorRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/cow-groups', cowGroupRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        error: true,
        message: err.message || 'An unexpected error occurred',
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
