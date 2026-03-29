const { Router } = require('express');
const pool = require('../db/pool');

const router = Router();

router.post('/login', async (req, res) => {
  const { firstName, lastName, password } = req.body;
  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'First name and last name are required.' });
  }
  const first = firstName.trim();
  const last = lastName.trim();

  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, role, password, created_at
       FROM user_profiles
       WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)`,
      [first, last]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No profile found. Please create one first.' });
    }
    const user = rows[0];
    if (!user.password) {
      return res.status(428).json({
        error: 'Password not set. Please create a password.',
        userId: user.id,
        needsPassword: true,
      });
    }
    if (!password) {
      return res.status(401).json({ error: 'Password is required.' });
    }
    if (password !== user.password) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/set-password', async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res.status(400).json({ error: 'User ID and password are required.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, password FROM user_profiles WHERE id = $1',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (rows[0].password) {
      return res.status(409).json({ error: 'Password already set. Use change-password instead.' });
    }
    const result = await pool.query(
      `UPDATE user_profiles SET password = $1 WHERE id = $2
       RETURNING id, first_name, last_name, role, created_at`,
      [password, userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Set password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/change-user-password', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'User ID, current password, and new password are required.' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters.' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, password FROM user_profiles WHERE id = $1',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (rows[0].password !== currentPassword) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    await pool.query(
      'UPDATE user_profiles SET password = $1 WHERE id = $2',
      [newPassword, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Change user password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/register', async (req, res) => {
  const { firstName, lastName, password } = req.body;
  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'First name and last name are required.' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password is required (minimum 4 characters).' });
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
      `INSERT INTO user_profiles (first_name, last_name, password)
       VALUES ($1, $2, $3)
       RETURNING id, first_name, last_name, role, created_at`,
      [first, last, password]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/all', async (req, res) => {
  const includeDetails = req.query.admin === 'true';
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, role, (password IS NOT NULL) AS has_password
       FROM user_profiles
       ORDER BY first_name, last_name`
    );
    if (!includeDetails) {
      res.json(rows.map(({ has_password, ...rest }) => ({ ...rest, has_password })));
    } else {
      res.json(rows);
    }
  } catch (err) {
    console.error('List users error:', err.message);
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

router.get('/:id/role', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT role FROM user_profiles WHERE id = $1',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ role: rows[0].role });
  } catch (err) {
    console.error('Get role error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/admin-login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }
  try {
    const { rows } = await pool.query(
      "SELECT value FROM admin_settings WHERE key = 'admin_password'"
    );
    if (rows.length === 0) {
      return res.status(500).json({ error: 'Admin password not configured.' });
    }
    if (password !== rows[0].value) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Admin login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/admin-change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters.' });
  }
  try {
    const { rows } = await pool.query(
      "SELECT value FROM admin_settings WHERE key = 'admin_password'"
    );
    if (rows.length === 0 || currentPassword !== rows[0].value) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    await pool.query(
      "UPDATE admin_settings SET value = $1 WHERE key = 'admin_password'",
      [newPassword]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role, adminPassword } = req.body;
  if (!role || !['admin', 'guest'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "admin" or "guest".' });
  }
  if (!adminPassword) {
    return res.status(400).json({ error: 'Admin password is required.' });
  }
  try {
    const pwCheck = await pool.query(
      "SELECT value FROM admin_settings WHERE key = 'admin_password'"
    );
    if (pwCheck.rows.length === 0 || adminPassword !== pwCheck.rows[0].value) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const { rows } = await pool.query(
      'UPDATE user_profiles SET role = $1 WHERE id = $2 RETURNING id, first_name, last_name, role',
      [role, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Update role error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { adminPassword } = req.body;
  if (!adminPassword) {
    return res.status(400).json({ error: 'Admin password is required.' });
  }
  try {
    const pwCheck = await pool.query(
      "SELECT value FROM admin_settings WHERE key = 'admin_password'"
    );
    if (pwCheck.rows.length === 0 || adminPassword !== pwCheck.rows[0].value) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const { rows } = await pool.query(
      'DELETE FROM user_profiles WHERE id = $1 RETURNING id, first_name, last_name',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ deleted: rows[0] });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/admin-reset-password', async (req, res) => {
  const { id } = req.params;
  const { adminPassword, newPassword } = req.body;
  if (!adminPassword) {
    return res.status(400).json({ error: 'Admin password is required.' });
  }
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'New password is required (minimum 4 characters).' });
  }
  try {
    const pwCheck = await pool.query(
      "SELECT value FROM admin_settings WHERE key = 'admin_password'"
    );
    if (pwCheck.rows.length === 0 || adminPassword !== pwCheck.rows[0].value) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const { rows } = await pool.query(
      'UPDATE user_profiles SET password = $1 WHERE id = $2 RETURNING id, first_name, last_name',
      [newPassword, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Admin reset password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
