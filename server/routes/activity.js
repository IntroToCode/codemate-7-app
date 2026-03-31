const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const { user_name } = req.query;

  try {
    const params = [limit, offset];
    const whereClause = user_name
      ? `WHERE user_name = $${params.push(user_name)}`
      : '';

    const { rows } = await pool.query(
      `SELECT id, user_name, action, entity_type, entity_id, details, created_at
       FROM activity_log
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
