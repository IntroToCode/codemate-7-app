const { Pool } = require('pg');

// Reads DATABASE_URL from your .env file.
// In Replit: copy the DATABASE_URL from the Database tab into your Secrets (not .env).
// Locally: put it in your .env file (never commit .env to GitHub).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Required for Replit's hosted Postgres — remove this if connecting to a
  // local Postgres instance during development.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test the connection on startup so you know immediately if something's wrong.
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.message);
    console.error('Check that DATABASE_URL is set correctly in your .env / Replit Secrets.');
    return;
  }
  console.log('Database connected successfully');
  release();
});

module.exports = pool;
