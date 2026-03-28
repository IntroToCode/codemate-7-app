const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

async function isUserAdmin(username) {
  if (!username) return false;
  const result = await pool.query('SELECT 1 FROM admins WHERE username = $1', [username]);
  return result.rows.length > 0;
}

router.get('/', async (req, res) => {
  const requestingUser = req.query.user || '';
  try {
    const result = await pool.query('SELECT key, value FROM app_settings');
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    const isAdmin = await isUserAdmin(requestingUser);
    const adminUsername = settings.admin_username || '';
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
    const admin = await isUserAdmin(user);
    if (!admin) {
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
      await pool.query(
        'INSERT INTO admins (username, promoted_by) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
        [trimmed, trimmed]
      );
      return res.json({ is_admin: true, admin_name: trimmed });
    }
    const isAdmin = await isUserAdmin(trimmed);
    res.json({ is_admin: isAdmin, admin_name: currentAdmin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/admins', async (req, res) => {
  try {
    const result = await pool.query('SELECT username, promoted_by, created_at FROM admins ORDER BY created_at');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/known-users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT username FROM (
        SELECT created_by AS username FROM restaurants
        UNION
        SELECT spun_by AS username FROM spins
        UNION
        SELECT rated_by AS username FROM ratings
      ) all_users
      ORDER BY username
    `);
    res.json(result.rows.map(r => r.username));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admins/promote', async (req, res) => {
  const { user, target } = req.body;
  if (!user || !target) return res.status(400).json({ error: 'user and target are required' });

  try {
    const callerIsAdmin = await isUserAdmin(user);
    if (!callerIsAdmin) {
      return res.status(403).json({ error: 'Only admins can promote users' });
    }

    const alreadyAdmin = await isUserAdmin(target);
    if (alreadyAdmin) {
      return res.status(409).json({ error: 'User is already an admin' });
    }

    await pool.query(
      'INSERT INTO admins (username, promoted_by) VALUES ($1, $2)',
      [target, user]
    );
    res.json({ promoted: target });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admins/demote', async (req, res) => {
  const { user, target } = req.body;
  if (!user || !target) return res.status(400).json({ error: 'user and target are required' });

  try {
    if (user === target) {
      return res.status(400).json({ error: 'You cannot demote yourself' });
    }

    const callerIsAdmin = await isUserAdmin(user);
    if (!callerIsAdmin) {
      return res.status(403).json({ error: 'Only admins can demote users' });
    }

    const targetIsAdmin = await isUserAdmin(target);
    if (!targetIsAdmin) {
      return res.status(404).json({ error: 'Target user is not an admin' });
    }

    await pool.query('DELETE FROM admins WHERE username = $1', [target]);
    res.json({ demoted: target });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
