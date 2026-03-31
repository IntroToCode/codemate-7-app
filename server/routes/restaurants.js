const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { validateZipCode, searchWithSmartFill } = require('../lib/places');

router.get('/search', async (req, res) => {
  const { zip, keyword, page_token, hide_duplicates } = req.query;
  if (!zip || !validateZipCode(zip)) {
    return res.status(400).json({ error: 'A valid 5-digit US zip code is required.' });
  }
  if (!process.env.google_place_api_key) {
    return res.status(503).json({ error: 'Google Places API is not configured.' });
  }
  try {
    const existing = await pool.query('SELECT name, address, google_place_id FROM restaurants');
    const hideDupes = hide_duplicates === 'true';
    const result = await searchWithSmartFill(
      zip,
      keyword || '',
      page_token || null,
      existing.rows,
      hideDupes
    );
    res.json(result);
  } catch (err) {
    console.error('Places search error:', err);
    const status = err.message.includes('Invalid zip') || err.message.includes('Could not find') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const { user } = req.query;
  try {
    let result;
    if (user) {
      result = await pool.query(`
        SELECT
          r.*,
          COALESCE(
            JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', t.id, 'label', t.label))
            FILTER (WHERE t.id IS NOT NULL), '[]'
          ) AS tags,
          rq.avg_rating,
          rq.rating_count,
          ur.score AS user_rating
        FROM restaurants r
        LEFT JOIN tags t ON t.restaurant_id = r.id
        LEFT JOIN (
          SELECT
            restaurant_id,
            ROUND(AVG(score)::numeric, 1) AS avg_rating,
            COUNT(id)::int AS rating_count
          FROM ratings
          GROUP BY restaurant_id
        ) rq ON rq.restaurant_id = r.id
        LEFT JOIN ratings ur ON ur.restaurant_id = r.id AND ur.rated_by = $1
        GROUP BY r.id, rq.avg_rating, rq.rating_count, ur.score
        ORDER BY r.created_at DESC
      `, [user]);
    } else {
      result = await pool.query(`
        SELECT
          r.*,
          COALESCE(
            JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', t.id, 'label', t.label))
            FILTER (WHERE t.id IS NOT NULL), '[]'
          ) AS tags,
          rq.avg_rating,
          rq.rating_count
        FROM restaurants r
        LEFT JOIN tags t ON t.restaurant_id = r.id
        LEFT JOIN (
          SELECT
            restaurant_id,
            ROUND(AVG(score)::numeric, 1) AS avg_rating,
            COUNT(id)::int AS rating_count
          FROM ratings
          GROUP BY restaurant_id
        ) rq ON rq.restaurant_id = r.id
        GROUP BY r.id, rq.avg_rating, rq.rating_count
        ORDER BY r.created_at DESC
      `);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, cuisine, price_range, address, created_by, google_place_id } = req.body;
  if (!name || !created_by) {
    return res.status(400).json({ error: 'name and created_by are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO restaurants (name, cuisine, price_range, address, created_by, google_place_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, cuisine || null, price_range || null, address || null, created_by, google_place_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

async function resolveUserName(userId) {
  if (!userId) return null;
  const { rows } = await pool.query(
    'SELECT first_name, last_name FROM user_profiles WHERE id = $1',
    [userId]
  );
  if (rows.length === 0) return null;
  return `${rows[0].first_name} ${rows[0].last_name}`;
}

async function isAdminPasswordValid(adminPassword) {
  if (!adminPassword) return false;
  const { rows } = await pool.query(
    "SELECT value FROM admin_settings WHERE key = 'admin_password'"
  );
  return rows.length > 0 && adminPassword === rows[0].value;
}

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, cuisine, price_range, address } = req.body;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'User ID is required.' });
  }

  try {
    const restaurantResult = await pool.query(
      'SELECT created_by FROM restaurants WHERE id = $1',
      [id]
    );
    if (restaurantResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const userName = await resolveUserName(userId);
    if (!userName) return res.status(401).json({ error: 'User not found.' });
    if (userName !== restaurantResult.rows[0].created_by) {
      return res.status(403).json({ error: 'Only the creator can edit this restaurant.' });
    }

    const result = await pool.query(
      `UPDATE restaurants
       SET name = COALESCE($1, name),
           cuisine = COALESCE($2, cuisine),
           price_range = COALESCE($3, price_range),
           address = COALESCE($4, address)
       WHERE id = $5
       RETURNING *`,
      [name, cuisine, price_range, address, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'];
  const adminPassword = req.body?.adminPassword;

  if (!userId && !adminPassword) {
    return res.status(401).json({ error: 'Authorization required.' });
  }

  try {
    let authorized = false;

    if (adminPassword) {
      authorized = await isAdminPasswordValid(adminPassword);
    }

    if (!authorized && userId) {
      const restaurantResult = await pool.query(
        'SELECT created_by FROM restaurants WHERE id = $1',
        [id]
      );
      const userName = await resolveUserName(userId);
      if (restaurantResult.rows.length > 0 && userName) {
        authorized = userName === restaurantResult.rows[0].created_by;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Only the creator can toggle this restaurant.' });
    }

    const result = await pool.query(
      `UPDATE restaurants SET active = NOT active WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'User ID is required.' });
  }

  try {
    const restaurantResult = await pool.query(
      'SELECT id, created_by FROM restaurants WHERE id = $1',
      [id]
    );
    if (restaurantResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const userName = await resolveUserName(userId);
    if (!userName) return res.status(401).json({ error: 'User not found.' });
    if (userName !== restaurantResult.rows[0].created_by) {
      return res.status(403).json({ error: 'Only the creator can delete this restaurant.' });
    }

    await pool.query('DELETE FROM restaurants WHERE id = $1', [id]);
    res.json({ deleted: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
