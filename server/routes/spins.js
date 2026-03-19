const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { selectRestaurant } = require('../lib/spinAlgorithm');

router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  try {
    const result = await pool.query(
      `SELECT s.*, r.name AS restaurant_name
       FROM spins s
       LEFT JOIN restaurants r ON r.id = s.restaurant_id
       ORDER BY s.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { spun_by, exclude_recent = true, skip_ids = [] } = req.body;
  if (!spun_by) return res.status(400).json({ error: 'spun_by is required' });

  try {
    const [restaurantsResult, recentSpinsResult] = await Promise.all([
      pool.query('SELECT * FROM restaurants WHERE active = TRUE'),
      pool.query(
        'SELECT restaurant_id FROM spins WHERE is_vetoed = FALSE ORDER BY created_at DESC LIMIT 5'
      ),
    ]);

    const restaurants = restaurantsResult.rows;
    const recentSpins = recentSpinsResult.rows;

    const selected = selectRestaurant(restaurants, recentSpins, exclude_recent, skip_ids);

    if (!selected) {
      return res.status(422).json({ error: 'No eligible restaurants to spin.' });
    }

    const spinResult = await pool.query(
      `INSERT INTO spins (restaurant_id, spun_by) VALUES ($1, $2) RETURNING *`,
      [selected.id, spun_by]
    );

    res.status(201).json({ spin: spinResult.rows[0], restaurant: selected });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/veto', async (req, res) => {
  const { id } = req.params;
  const { spun_by, exclude_recent = true, skip_ids = [] } = req.body;
  if (!spun_by) return res.status(400).json({ error: 'spun_by is required' });

  try {
    const vetoResult = await pool.query(
      `UPDATE spins SET is_vetoed = TRUE WHERE id = $1 RETURNING *`,
      [id]
    );
    if (vetoResult.rows.length === 0) return res.status(404).json({ error: 'Spin not found' });

    const [restaurantsResult, recentSpinsResult] = await Promise.all([
      pool.query('SELECT * FROM restaurants WHERE active = TRUE'),
      pool.query(
        'SELECT restaurant_id FROM spins WHERE is_vetoed = FALSE ORDER BY created_at DESC LIMIT 5'
      ),
    ]);

    const selected = selectRestaurant(
      restaurantsResult.rows,
      recentSpinsResult.rows,
      exclude_recent,
      skip_ids
    );

    if (!selected) {
      return res.status(422).json({ error: 'No eligible restaurants after veto.' });
    }

    const newSpinResult = await pool.query(
      `INSERT INTO spins (restaurant_id, spun_by) VALUES ($1, $2) RETURNING *`,
      [selected.id, spun_by]
    );

    res.status(201).json({ spin: newSpinResult.rows[0], restaurant: selected });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
