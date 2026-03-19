const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { autofill } = require('../lib/autofill');

router.get('/autofill', (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'name query param required' });
  const data = autofill(name);
  res.json(data);
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.*,
        COALESCE(
          JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', t.id, 'label', t.label))
          FILTER (WHERE t.id IS NOT NULL), '[]'
        ) AS tags,
        ROUND(AVG(rt.score)::numeric, 1) AS avg_rating,
        COUNT(rt.id)::int AS rating_count
      FROM restaurants r
      LEFT JOIN tags t ON t.restaurant_id = r.id
      LEFT JOIN ratings rt ON rt.restaurant_id = r.id
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, cuisine, price_range, address, added_by } = req.body;
  if (!name || !added_by) {
    return res.status(400).json({ error: 'name and added_by are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO restaurants (name, cuisine, price_range, address, added_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, cuisine || null, price_range || null, address || null, added_by]
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
  try {
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
