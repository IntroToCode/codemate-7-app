const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.post('/', async (req, res) => {
  const { restaurant_id, label } = req.body;
  if (!restaurant_id || !label) {
    return res.status(400).json({ error: 'restaurant_id and label are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO tags (restaurant_id, label) VALUES ($1, $2)
       ON CONFLICT (restaurant_id, label) DO NOTHING
       RETURNING *`,
      [restaurant_id, label.trim()]
    );
    if (result.rows.length === 0) {
      return res.status(200).json({ message: 'Tag already exists' });
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM tags WHERE id = $1 RETURNING id`,
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
