const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Database migration complete.');
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  }
}

module.exports = migrate;
