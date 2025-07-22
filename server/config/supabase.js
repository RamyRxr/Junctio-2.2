const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Log values for debugging (remove in production)
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key available:', !!supabaseKey);
console.log('Supabase Service Key available:', !!supabaseServiceKey);

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase credentials not found in environment variables');
    process.exit(1); // Exit with error to prevent invalid client creation
}

// Initialize Supabase client with the anon key (for client-side use)
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Supabase admin client with the service role key (for server-side operations)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

// Verify connection on startup
const testConnection = async () => {
    try {
        // Simple test query to verify connection
        const { error } = await supabase.storage.getBucket('media');

        if (error) {
            console.warn('Warning: Could not connect to Supabase storage:', error.message);
        } else {
            console.log('Supabase connection successful');
        }
    } catch (err) {
        console.warn('Warning: Error testing Supabase connection:', err.message);
    }
};

// Run the test (but don't block startup if it fails)
testConnection().catch(console.error);

module.exports = {
    supabase,        // For client-side operations
    supabaseAdmin    // For admin operations like storage management
};
