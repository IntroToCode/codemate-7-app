const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const logActivity = require('../lib/logActivity');

router.post('/', async (req, res) => {
  const { restaurant_id, rated_by, score } = req.body;
  if (!restaurant_id || !rated_by || score === undefined) {
    return res.status(400).json({ error: 'restaurant_id, rated_by, and score are required' });
  }
  if (score < 1 || score > 5) {
    return res.status(400).json({ error: 'score must be between 1 and 5' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO ratings (restaurant_id, rated_by, score)
       VALUES ($1, $2, $3)
       ON CONFLICT (restaurant_id, rated_by)
       DO UPDATE SET score = EXCLUDED.score, created_at = NOW()
       RETURNING *`,
      [restaurant_id, rated_by, score]
    );

    await logActivity({
      userName: rated_by,
      action: 'rating_cast',
      entityType: 'rating',
      entityId: result.rows[0].id,
      details: { restaurant_id, score },
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
