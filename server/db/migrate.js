const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    // Rename added_by to created_by if the old column still exists
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='restaurants' AND column_name='added_by'
        ) THEN
          ALTER TABLE restaurants RENAME COLUMN added_by TO created_by;
        END IF;
      END $$;
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='restaurants' AND column_name='google_place_id'
        ) THEN
          ALTER TABLE restaurants ADD COLUMN google_place_id VARCHAR(255);
        END IF;
      END $$;
    `);
    await pool.query(`
      INSERT INTO app_settings (key, value) VALUES ('exclude_recent_7_days', 'true')
      ON CONFLICT (key) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO app_settings (key, value) VALUES ('admin_username', '')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('Database migration complete.');
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  }
}

module.exports = migrate;
