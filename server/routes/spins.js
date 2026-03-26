const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { selectRestaurant } = require('../lib/spinAlgorithm');

async function getExcludeRecentSetting() {
  const result = await pool.query(
    "SELECT value FROM app_settings WHERE key = 'exclude_recent_7_days'"
  );
  return result.rows[0]?.value === 'true';
}

async function getRecentSpinData() {
  const result = await pool.query(
    `SELECT restaurant_id, MAX(created_at) AS last_visit
     FROM spins
     WHERE is_vetoed = FALSE
       AND created_at >= NOW() - INTERVAL '7 days'
     GROUP BY restaurant_id`
  );
  const ids = result.rows.map((r) => r.restaurant_id).filter(Boolean);
  const lastVisitMap = {};
  result.rows.forEach((r) => {
    if (r.restaurant_id) lastVisitMap[r.restaurant_id] = r.last_visit;
  });
  return { ids, lastVisitMap };
}

router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  try {
    const result = await pool.query(
      `SELECT s.*, r.name AS restaurant_name
       FROM spins s
       LEFT JOIN restaurants r ON r.id = s.restaurant_id
       ORDER BY s.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { spun_by, skip_ids = [] } = req.body;
  if (!spun_by) return res.status(400).json({ error: 'spun_by is required' });

  try {
    const [restaurantsResult, excludeRecent, recentData] = await Promise.all([
      pool.query('SELECT * FROM restaurants WHERE active = TRUE'),
      getExcludeRecentSetting(),
      getRecentSpinData(),
    ]);

    const restaurants = restaurantsResult.rows;

    const result = selectRestaurant(restaurants, recentData.ids, excludeRecent, skip_ids);

    if (!result.selected && result.allExcluded) {
      return res.status(422).json({
        error: 'All restaurants have been visited in the last 7 days. Add more restaurants or turn off the exclusion filter.',
        allExcluded: true,
      });
    }

    if (!result.selected) {
      return res.status(422).json({ error: 'No eligible restaurants to spin.' });
    }

    const spinResult = await pool.query(
      `INSERT INTO spins (restaurant_id, spun_by) VALUES ($1, $2) RETURNING *`,
      [result.selected.id, spun_by]
    );

    res.status(201).json({ spin: spinResult.rows[0], restaurant: result.selected });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/veto', async (req, res) => {
  const { id } = req.params;
  const { spun_by, skip_ids = [] } = req.body;
  if (!spun_by) return res.status(400).json({ error: 'spun_by is required' });

  try {
    const vetoResult = await pool.query(
      `UPDATE spins SET is_vetoed = TRUE WHERE id = $1 RETURNING *`,
      [id]
    );
    if (vetoResult.rows.length === 0) return res.status(404).json({ error: 'Spin not found' });

    const vetoedRestaurantId = vetoResult.rows[0].restaurant_id;

    const [restaurantsResult, excludeRecent, recentData] = await Promise.all([
      pool.query('SELECT * FROM restaurants WHERE active = TRUE'),
      getExcludeRecentSetting(),
      getRecentSpinData(),
    ]);

    const vetoSkipIds = vetoedRestaurantId
      ? [...new Set([...skip_ids, vetoedRestaurantId])]
      : skip_ids;

    const result = selectRestaurant(
      restaurantsResult.rows,
      recentData.ids,
      excludeRecent,
      vetoSkipIds
    );

    if (!result.selected && result.allExcluded) {
      return res.status(422).json({
        error: 'All restaurants have been visited in the last 7 days. Add more restaurants or turn off the exclusion filter.',
        allExcluded: true,
      });
    }

    if (!result.selected) {
      return res.status(422).json({ error: 'No eligible restaurants after veto.' });
    }

    const newSpinResult = await pool.query(
      `INSERT INTO spins (restaurant_id, spun_by) VALUES ($1, $2) RETURNING *`,
      [result.selected.id, spun_by]
    );

    res.status(201).json({ spin: newSpinResult.rows[0], restaurant: result.selected });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
