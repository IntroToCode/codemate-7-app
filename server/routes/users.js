const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, first_name, last_name, created_at FROM users ORDER BY first_name, last_name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { first_name, last_name } = req.body;
  if (!first_name || !first_name.trim() || !last_name || !last_name.trim()) {
    return res.status(400).json({ error: 'first_name and last_name are required' });
  }

  const trimFirst = first_name.trim();
  const trimLast = last_name.trim();

  try {
    const existing = await pool.query(
      'SELECT id, first_name, last_name, created_at FROM users WHERE first_name = $1 AND last_name = $2',
      [trimFirst, trimLast]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A user with that name already exists' });
    }

    const result = await pool.query(
      'INSERT INTO users (first_name, last_name) VALUES ($1, $2) RETURNING id, first_name, last_name, created_at',
      [trimFirst, trimLast]
    );

    const newUser = result.rows[0];
    const displayName = `${newUser.first_name} ${newUser.last_name}`;

    const adminResult = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'admin_username'"
    );
    const currentAdmin = adminResult.rows[0]?.value || '';
    if (!currentAdmin) {
      await pool.query(
        "UPDATE app_settings SET value = $1 WHERE key = 'admin_username'",
        [displayName]
      );
    }

    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
