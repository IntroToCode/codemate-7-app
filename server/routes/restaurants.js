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

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, cuisine, price_range, address } = req.body;
  try {
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
  try {
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
    const userCheck = await pool.query(
      'SELECT role FROM user_profiles WHERE id = $1',
      [userId]
    );
    if (userCheck.rows.length === 0 || userCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete restaurants.' });
    }
    const result = await pool.query(
      `DELETE FROM restaurants WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
