const { Router } = require('express');
const pool = require('../db/pool');

const router = Router();

router.post('/login', async (req, res) => {
  const { firstName, lastName } = req.body;
  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'First name and last name are required.' });
  }
  const first = firstName.trim();
  const last = lastName.trim();

  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, created_at
       FROM user_profiles
       WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)`,
      [first, last]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No profile found. Please create one first.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/register', async (req, res) => {
  const { firstName, lastName } = req.body;
  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'First name and last name are required.' });
  }
  const first = firstName.trim();
  const last = lastName.trim();

  try {
    const existing = await pool.query(
      `SELECT id FROM user_profiles
       WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)`,
      [first, last]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A profile with that name already exists. Try logging in instead.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO user_profiles (first_name, last_name)
       VALUES ($1, $2)
       RETURNING id, first_name, last_name, created_at`,
      [first, last]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/count', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM user_profiles');
    res.json({ total: rows[0].total });
  } catch (err) {
    console.error('Count users error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
