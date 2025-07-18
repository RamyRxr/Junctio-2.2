const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection configuration
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'junction',
    password: 'Ramy2024',
    port: 5432,
});

async function setupDatabase() {
    try {
        // Read the SQL file
        const schemaFilePath = path.join(__dirname, 'schema.sql');
        const sqlScript = fs.readFileSync(schemaFilePath, 'utf8');

        // Execute the SQL script
        console.log('Setting up database schema...');
        await pool.query(sqlScript);

        console.log('Database setup completed successfully!');
    } catch (err) {
        console.error('Error setting up database:', err);
    } finally {
        // Close the pool
        await pool.end();
    }
}

// Run the setup
setupDatabase();
