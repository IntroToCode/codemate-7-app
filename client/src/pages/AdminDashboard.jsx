import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import StarRating from '../components/StarRating';
import { priceLabel } from '../components/rouletteUtils.jsx';

export default function AdminDashboard() {
  const { userName, userId, updateRole, logout } = useUser();
  const [restaurants, setRestaurants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('restaurants');

  const [spinLimits, setSpinLimits] = useState({ guest_spin_limit: 2, admin_spin_limit: -1 });
  const [guestLimitInput, setGuestLimitInput] = useState('2');
  const [adminLimitInput, setAdminLimitInput] = useState('');
  const [guestUnlimited, setGuestUnlimited] = useState(false);
  const [adminUnlimited, setAdminUnlimited] = useState(true);
  const [spinLimitMessage, setSpinLimitMessage] = useState('');
  const [spinUsage, setSpinUsage] = useState([]);

  async function loadRestaurants() {
    try {
      const res = await fetch('/api/restaurants');
      setRestaurants(await res.json());
    } catch (err) {
      console.error('Failed to load restaurants:', err);
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch('/api/users/all');
      setUsers(await res.json());
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  async function loadSpinLimits() {
    try {
      const res = await fetch('/api/users/spin-limits');
      const data = await res.json();
      setSpinLimits(data);
      setGuestUnlimited(data.guest_spin_limit === -1);
      setAdminUnlimited(data.admin_spin_limit === -1);
      setGuestLimitInput(data.guest_spin_limit === -1 ? '' : String(data.guest_spin_limit));
      setAdminLimitInput(data.admin_spin_limit === -1 ? '' : String(data.admin_spin_limit));
    } catch (err) {
      console.error('Failed to load spin limits:', err);
    }
  }

  async function loadSpinUsage() {
    try {
      const res = await fetch('/api/users/spin-usage');
      setSpinUsage(await res.json());
    } catch (err) {
      console.error('Failed to load spin usage:', err);
    }
  }

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadRestaurants(), loadUsers(), loadSpinLimits(), loadSpinUsage()]);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleToggle(id) {
    const res = await fetch(`/api/restaurants/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'X-User-Id': userId },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to toggle restaurant');
      return;
    }
    loadRestaurants();
  }

  async function handleRoleChange(targetUserId, newRole) {
    const res = await fetch(`/api/users/${targetUserId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to update role');
      return;
    }
    if (targetUserId === userId) {
      updateRole(newRole);
    }
    loadUsers();
    loadSpinUsage();
  }

  async function handleDeleteUser(targetUserId) {
    const user = users.find((u) => u.id === targetUserId);
    const name = user ? `${user.first_name} ${user.last_name}` : 'this user';
    if (!window.confirm(`Are you sure you want to delete ${name}'s profile? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/users/${targetUserId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to delete user');
        return;
      }
      if (targetUserId === userId) {
        logout();
        return;
      }
      loadUsers();
      loadSpinUsage();
    } catch (err) {
      alert('Failed to delete user. Please try again.');
    }
  }

  async function handleSaveSpinLimits(e) {
    e.preventDefault();
    setSpinLimitMessage('');
    const guestVal = guestUnlimited ? -1 : parseInt(guestLimitInput, 10);
    const adminVal = adminUnlimited ? -1 : parseInt(adminLimitInput, 10);

    if (!guestUnlimited && (isNaN(guestVal) || guestVal < 1)) {
      setSpinLimitMessage('Guest spin limit must be at least 1.');
      return;
    }
    if (!adminUnlimited && (isNaN(adminVal) || adminVal < 1)) {
      setSpinLimitMessage('Admin spin limit must be at least 1.');
      return;
    }

    try {
      const res = await fetch('/api/users/spin-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_spin_limit: guestVal,
          admin_spin_limit: adminVal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSpinLimitMessage(data.error || 'Failed to update spin limits.');
        return;
      }
      setSpinLimitMessage('Spin limits updated!');
      loadSpinLimits();
      loadSpinUsage();
      setTimeout(() => setSpinLimitMessage(''), 2000);
    } catch (err) {
      setSpinLimitMessage('Network error. Please try again.');
    }
  }

  async function handleResetUserSpins(targetUserId) {
    const user = spinUsage.find((u) => u.id === targetUserId);
    const name = user ? `${user.first_name} ${user.last_name}` : 'this user';
    if (!window.confirm(`Reset spin counter for ${name}?`)) return;

    try {
      const res = await fetch(`/api/users/${targetUserId}/reset-spins`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to reset spins');
        return;
      }
      loadSpinUsage();
    } catch (err) {
      alert('Failed to reset spins. Please try again.');
    }
  }

  async function handleResetAllSpins() {
    if (!window.confirm('Reset spin counters for ALL users?')) return;

    try {
      const res = await fetch('/api/users/reset-all-spins', {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to reset all spins');
        return;
      }
      loadSpinUsage();
    } catch (err) {
      alert('Failed to reset spins. Please try again.');
    }
  }

  if (loading) return <div className="loading">Loading… 🍽️</div>;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>⚙️ Admin Dashboard</h2>
        <div className="header-actions">
          <button
            className={`btn btn-sm ${activeTab === 'restaurants' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('restaurants')}
          >
            🍽️ Restaurants
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Users
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'spins' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveTab('spins'); loadSpinUsage(); }}
          >
            🎰 Spin Settings
          </button>
        </div>
      </div>

      {activeTab === 'restaurants' && (
        <>
          <p className="page-sub">
            Manage availability for your restaurants. Toggle status for restaurants you added.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Cuisine</th>
                  <th>Price</th>
                  <th>Rating</th>
                  <th>Added by</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((r) => {
                  const isOwner = r.created_by === userName;
                  return (
                    <tr key={r.id} className={r.active ? '' : 'row-inactive'}>
                      <td className="td-name">{r.name}</td>
                      <td>{r.cuisine || '—'}</td>
                      <td>{priceLabel(r.price_range)}</td>
                      <td>
                        {r.avg_rating
                          ? <StarRating value={parseFloat(r.avg_rating)} readOnly size="sm" />
                          : <span className="no-rating">—</span>
                        }
                      </td>
                      <td>
                        {r.created_by}
                        {isOwner && <span className="owner-badge"> 👑</span>}
                      </td>
                      <td>
                        <span className={`badge ${r.active ? 'badge-active' : 'badge-inactive'}`}>
                          {r.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {isOwner && (
                          <button
                            className={`btn btn-sm ${r.active ? 'btn-ghost' : 'btn-primary'}`}
                            onClick={() => handleToggle(r.id)}
                          >
                            {r.active ? '🚫 Deactivate' : '✅ Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {restaurants.length === 0 && <p className="empty-state">No restaurants yet.</p>}
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <>
          <p className="page-sub">
            Manage user roles and remove profiles.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="td-name">
                      {u.first_name} {u.last_name}
                      {u.id === userId && <span className="owner-badge"> (you)</span>}
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-active' : 'badge-inactive'}`}>
                        {u.role === 'admin' ? '🛡️ Admin' : '👤 Guest'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-user-actions">
                        {u.role === 'guest' ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleRoleChange(u.id, 'admin')}
                          >
                            Promote
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleRoleChange(u.id, 'guest')}
                          >
                            Demote
                          </button>
                        )}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteUser(u.id)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p className="empty-state">No users yet.</p>}
          </div>
        </>
      )}

      {activeTab === 'spins' && (
        <>
          <p className="page-sub">
            Configure spin limits per role and manage user spin counters.
          </p>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3>🎰 Spin Limits per Role</h3>
            <form onSubmit={handleSaveSpinLimits}>
              <div className="spin-limit-row">
                <label className="spin-limit-label">
                  <span>👤 Guest limit:</span>
                  <label className="toggle-label" style={{ marginLeft: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={guestUnlimited}
                      onChange={(e) => setGuestUnlimited(e.target.checked)}
                    />
                    <span>Unlimited</span>
                  </label>
                  {!guestUnlimited && (
                    <input
                      className="form-input form-input-sm"
                      type="number"
                      min="1"
                      value={guestLimitInput}
                      onChange={(e) => setGuestLimitInput(e.target.value)}
                      style={{ width: '80px', marginLeft: '0.5rem' }}
                    />
                  )}
                </label>
              </div>
              <div className="spin-limit-row" style={{ marginTop: '0.75rem' }}>
                <label className="spin-limit-label">
                  <span>🛡️ Admin limit:</span>
                  <label className="toggle-label" style={{ marginLeft: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={adminUnlimited}
                      onChange={(e) => setAdminUnlimited(e.target.checked)}
                    />
                    <span>Unlimited</span>
                  </label>
                  {!adminUnlimited && (
                    <input
                      className="form-input form-input-sm"
                      type="number"
                      min="1"
                      value={adminLimitInput}
                      onChange={(e) => setAdminLimitInput(e.target.value)}
                      style={{ width: '80px', marginLeft: '0.5rem' }}
                    />
                  )}
                </label>
              </div>
              {spinLimitMessage && (
                <p className={spinLimitMessage.includes('updated') ? 'success-text' : 'error-text'} style={{ marginTop: '0.5rem' }}>
                  {spinLimitMessage}
                </p>
              )}
              <div className="card-actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">Save Limits</button>
              </div>
            </form>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>📊 Spin Usage (24h)</h3>
              <button className="btn btn-sm btn-ghost" onClick={handleResetAllSpins}>
                🔄 Reset All Counters
              </button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Spins Used</th>
                    <th>Limit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {spinUsage.map((u) => (
                    <tr key={u.id}>
                      <td className="td-name">
                        {u.first_name} {u.last_name}
                        {u.was_reset && <span className="owner-badge"> (reset)</span>}
                      </td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-active' : 'badge-inactive'}`}>
                          {u.role === 'admin' ? '🛡️ Admin' : '👤 Guest'}
                        </span>
                      </td>
                      <td>
                        <span className={!u.unlimited && u.spins_used >= u.spin_limit ? 'error-text' : ''}>
                          {u.spins_used}
                        </span>
                      </td>
                      <td>{u.unlimited ? '∞' : u.spin_limit}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleResetUserSpins(u.id)}
                        >
                          🔄 Reset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {spinUsage.length === 0 && <p className="empty-state">No users yet.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
