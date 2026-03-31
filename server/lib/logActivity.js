const pool = require('../db/pool');

async function logActivity({ userName, action, entityType = null, entityId = null, details = null }) {
  try {
    await pool.query(
      `INSERT INTO activity_log (user_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userName, action, entityType, entityId || null, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = logActivity;
