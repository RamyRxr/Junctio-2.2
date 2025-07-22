const { Pool } = require('pg');

// Create a connection pool
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'junction',
    password: process.env.DB_PASSWORD || 'Ramy2024',
    port: process.env.DB_PORT || 5432,
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error', err.stack);
    } else {
        console.log('Database connected successfully');
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
