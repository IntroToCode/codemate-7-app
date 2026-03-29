const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { selectRestaurant } = require('../lib/spinAlgorithm');

async function getSpinLimit(role) {
  const key = role === 'admin' ? 'admin_spin_limit' : 'guest_spin_limit';
  const { rows } = await pool.query(
    'SELECT value FROM admin_settings WHERE key = $1',
    [key]
  );
  if (rows.length === 0) return role === 'admin' ? -1 : 2;
  return parseInt(rows[0].value, 10);
}

function getEffectiveSince(resetAt) {
  const twentyFourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return resetAt && resetAt > twentyFourAgo ? resetAt : twentyFourAgo;
}

async function getSpinCount(userName, resetAt) {
  const effectiveSince = getEffectiveSince(resetAt);
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM spins
     WHERE spun_by = $1 AND is_vetoed = FALSE AND created_at > $2`,
    [userName, effectiveSince]
  );
  return rows[0].count;
}

async function getResetTime(userName, resetAt) {
  const effectiveSince = getEffectiveSince(resetAt);
  const { rows } = await pool.query(
    `SELECT created_at FROM spins
     WHERE spun_by = $1 AND is_vetoed = FALSE AND created_at > $2
     ORDER BY created_at ASC LIMIT 1`,
    [userName, effectiveSince]
  );
  if (rows.length > 0) {
    return new Date(rows[0].created_at.getTime() + 24 * 60 * 60 * 1000);
  }
  return new Date(effectiveSince.getTime() + 24 * 60 * 60 * 1000);
}

async function getUserProfile(userName) {
  const { rows } = await pool.query(
    `SELECT id, role, spin_counter_reset_at FROM user_profiles
     WHERE CONCAT(first_name, ' ', last_name) = $1`,
    [userName]
  );
  return rows[0] || null;
}

router.get('/remaining', async (req, res) => {
  const { user_name } = req.query;
  if (!user_name) return res.status(400).json({ error: 'user_name is required' });

  try {
    const profile = await getUserProfile(user_name);
    if (!profile) return res.status(404).json({ error: 'User not found' });

    const limit = await getSpinLimit(profile.role);
    if (limit === -1) {
      return res.json({ remaining: -1, limit: -1, used: 0, unlimited: true });
    }

    const used = await getSpinCount(user_name, profile.spin_counter_reset_at);
    const remaining = Math.max(0, limit - used);

    let resetTime = null;
    if (remaining === 0) {
      resetTime = (await getResetTime(user_name, profile.spin_counter_reset_at)).toISOString();
    }

    res.json({ remaining, limit, used, unlimited: false, resetTime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  try {
    const excludeVetoed = req.query.exclude_vetoed === 'true';
    const whereClause = excludeVetoed ? 'WHERE s.is_vetoed = FALSE' : '';
    const result = await pool.query(
      `SELECT s.*, r.name AS restaurant_name
       FROM spins s
       LEFT JOIN restaurants r ON r.id = s.restaurant_id
       ${whereClause}
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
  const { spun_by, exclude_recent = true, skip_ids = [] } = req.body;
  if (!spun_by) return res.status(400).json({ error: 'spun_by is required' });

  try {
    const profile = await getUserProfile(spun_by);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found. Please log in first.' });
    }
    const limit = await getSpinLimit(profile.role);
    if (limit !== -1) {
      const used = await getSpinCount(spun_by, profile.spin_counter_reset_at);
      if (used >= limit) {
        const resetTime = await getResetTime(spun_by, profile.spin_counter_reset_at);
        const retryAfterSeconds = Math.max(0, Math.ceil((resetTime - Date.now()) / 1000));
        return res.status(429).json({
          error: `You've reached your spin limit of ${limit} per 24 hours.`,
          limit,
          used,
          resetTime,
          retryAfterSeconds,
        });
      }
    }

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
      `UPDATE spins SET is_vetoed = TRUE WHERE id = $1 AND is_vetoed = FALSE RETURNING *`,
      [id]
    );
    if (vetoResult.rows.length === 0) return res.status(404).json({ error: 'Spin not found or already vetoed' });

    const vetoedRestaurantId = vetoResult.rows[0].restaurant_id;

    const [restaurantsResult, recentSpinsResult] = await Promise.all([
      pool.query('SELECT * FROM restaurants WHERE active = TRUE'),
      pool.query(
        'SELECT restaurant_id FROM spins WHERE is_vetoed = FALSE ORDER BY created_at DESC LIMIT 5'
      ),
    ]);

    const vetoSkipIds = vetoedRestaurantId
      ? [...new Set([...skip_ids, vetoedRestaurantId])]
      : skip_ids;

    const selected = selectRestaurant(
      restaurantsResult.rows,
      recentSpinsResult.rows,
      exclude_recent,
      vetoSkipIds
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
