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
      `SELECT id, first_name, last_name, role, created_at
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
      `INSERT INTO user_profiles (first_name, last_name, role)
       VALUES ($1, $2, 'admin')
       RETURNING id, first_name, last_name, role, created_at`,
      [first, last]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/all', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, role
       FROM user_profiles
       ORDER BY first_name, last_name`
    );
    res.json(rows);
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

router.get('/spin-limits', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT key, value FROM admin_settings WHERE key IN ('guest_spin_limit', 'admin_spin_limit')"
    );
    const limits = {};
    for (const row of rows) {
      limits[row.key] = parseInt(row.value, 10);
    }
    res.json({
      guest_spin_limit: limits.guest_spin_limit ?? 2,
      admin_spin_limit: limits.admin_spin_limit ?? -1,
    });
  } catch (err) {
    console.error('Get spin limits error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/spin-limits', async (req, res) => {
  const { guest_spin_limit, admin_spin_limit } = req.body;
  try {
    if (guest_spin_limit !== undefined) {
      const val = parseInt(guest_spin_limit, 10);
      if (isNaN(val) || (val < 1 && val !== -1)) {
        return res.status(400).json({ error: 'Guest spin limit must be a positive number or -1 for unlimited.' });
      }
      await pool.query(
        "INSERT INTO admin_settings (key, value) VALUES ('guest_spin_limit', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        [String(val)]
      );
    }
    if (admin_spin_limit !== undefined) {
      const val = parseInt(admin_spin_limit, 10);
      if (isNaN(val) || (val < 1 && val !== -1)) {
        return res.status(400).json({ error: 'Admin spin limit must be a positive number or -1 for unlimited.' });
      }
      await pool.query(
        "INSERT INTO admin_settings (key, value) VALUES ('admin_spin_limit', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        [String(val)]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Update spin limits error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reset-all-spins', async (req, res) => {
  try {
    await pool.query('UPDATE user_profiles SET spin_counter_reset_at = NOW()');
    res.json({ success: true });
  } catch (err) {
    console.error('Reset all spins error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/spin-usage', async (req, res) => {
  try {
    const twentyFourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { rows } = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.role, u.spin_counter_reset_at,
              (SELECT COUNT(*)::int FROM spins s
               WHERE s.spun_by = CONCAT(u.first_name, ' ', u.last_name)
                 AND s.is_vetoed = FALSE
                 AND s.created_at > GREATEST($1::timestamptz, COALESCE(u.spin_counter_reset_at, $1::timestamptz))
              ) AS spins_used
       FROM user_profiles u
       ORDER BY u.first_name, u.last_name`,
      [twentyFourAgo]
    );

    const limitsResult = await pool.query(
      "SELECT key, value FROM admin_settings WHERE key IN ('guest_spin_limit', 'admin_spin_limit')"
    );
    const limits = {};
    for (const row of limitsResult.rows) {
      limits[row.key] = parseInt(row.value, 10);
    }

    const usersWithUsage = rows.map(u => {
      const limit = u.role === 'admin'
        ? (limits.admin_spin_limit ?? -1)
        : (limits.guest_spin_limit ?? 2);
      return {
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        role: u.role,
        spins_used: u.spins_used,
        spin_limit: limit,
        unlimited: limit === -1,
        was_reset: !!u.spin_counter_reset_at && u.spin_counter_reset_at > twentyFourAgo,
      };
    });

    res.json(usersWithUsage);
  } catch (err) {
    console.error('Spin usage error:', err.message);
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

router.patch('/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!role || !['admin', 'guest'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "admin" or "guest".' });
  }
  try {
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
  try {
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

router.post('/:id/reset-spins', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'UPDATE user_profiles SET spin_counter_reset_at = NOW() WHERE id = $1 RETURNING id, first_name, last_name',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Reset spins error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
