const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/', async (req, res) => {
  const requestingUser = req.query.user || '';
  try {
    const result = await pool.query('SELECT key, value FROM app_settings');
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    const adminUsername = settings.admin_username || '';
    const isAdmin = !!(requestingUser && adminUsername && requestingUser === adminUsername);
    res.json({
      exclude_recent_7_days: settings.exclude_recent_7_days === 'true',
      is_admin: isAdmin,
      admin_name: adminUsername,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  const { user, exclude_recent_7_days } = req.body;
  if (!user) return res.status(400).json({ error: 'user is required' });
  if (typeof exclude_recent_7_days !== 'boolean') {
    return res.status(400).json({ error: 'exclude_recent_7_days must be a boolean' });
  }

  try {
    const adminResult = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'admin_username'"
    );
    const adminUsername = adminResult.rows[0]?.value || '';
    if (!adminUsername || adminUsername !== user) {
      return res.status(403).json({ error: 'Only the admin can change settings' });
    }

    await pool.query(
      "UPDATE app_settings SET value = $1 WHERE key = 'exclude_recent_7_days'",
      [String(exclude_recent_7_days)]
    );

    res.json({ exclude_recent_7_days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  const { user } = req.body;
  if (!user || !user.trim()) return res.status(400).json({ error: 'user is required' });
  const trimmed = user.trim();

  try {
    const adminResult = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'admin_username'"
    );
    const currentAdmin = adminResult.rows[0]?.value || '';
    if (!currentAdmin) {
      await pool.query(
        "UPDATE app_settings SET value = $1 WHERE key = 'admin_username'",
        [trimmed]
      );
      return res.json({ is_admin: true, admin_name: trimmed });
    }
    res.json({ is_admin: currentAdmin === trimmed, admin_name: currentAdmin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
