import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import StarRating from '../components/StarRating';
import { priceLabel } from '../components/rouletteUtils.jsx';

export default function AdminDashboard() {
  const { userName, userId, userRole, updateRole } = useUser();
  const [restaurants, setRestaurants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('restaurants');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMessage, setPwMessage] = useState('');

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

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadRestaurants(), loadUsers()]);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdminLoggedIn) loadAll();
  }, [isAdminLoggedIn]);

  async function handleAdminLogin(e) {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/users/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.error || 'Login failed.');
        return;
      }
      setIsAdminLoggedIn(true);
    } catch (err) {
      setLoginError('Network error. Please try again.');
    }
  }

  async function handleToggle(id) {
    const res = await fetch(`/api/restaurants/${id}/toggle`, { method: 'PATCH' });
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
      body: JSON.stringify({ role: newRole, adminPassword }),
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
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMessage('');
    try {
      const res = await fetch('/api/users/admin-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMessage(data.error || 'Failed to change password.');
        return;
      }
      setAdminPassword(newPw);
      setCurrentPw('');
      setNewPw('');
      setPwMessage('Password changed successfully!');
    } catch (err) {
      setPwMessage('Network error. Please try again.');
    }
  }

  if (!isAdminLoggedIn) {
    return (
      <div className="admin-page">
        <div className="page-header">
          <h2>⚙️ Admin Dashboard</h2>
          <p className="page-sub">Enter the admin password to access the dashboard.</p>
        </div>
        <form className="admin-login-form card" onSubmit={handleAdminLogin}>
          <h3>🔒 Admin Login</h3>
          <input
            className="form-input"
            type="password"
            placeholder="Admin password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            required
            autoFocus
          />
          {loginError && <p className="error-text">{loginError}</p>}
          <div className="card-actions">
            <button type="submit" className="btn btn-primary">Log In</button>
          </div>
        </form>
      </div>
    );
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
            👥 User Roles
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setShowChangePassword(!showChangePassword)}
          >
            🔑 Change Password
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => { setIsAdminLoggedIn(false); setAdminPassword(''); }}
          >
            🚪 Log Out
          </button>
        </div>
      </div>

      {showChangePassword && (
        <form className="admin-login-form card" onSubmit={handleChangePassword} style={{ marginBottom: '1.5rem' }}>
          <h3>🔑 Change Admin Password</h3>
          <input
            className="form-input"
            type="password"
            placeholder="Current password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
          />
          <input
            className="form-input"
            type="password"
            placeholder="New password (min 4 characters)"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={4}
          />
          {pwMessage && (
            <p className={pwMessage.includes('successfully') ? 'success-text' : 'error-text'}>
              {pwMessage}
            </p>
          )}
          <div className="card-actions">
            <button type="submit" className="btn btn-primary">Update Password</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setShowChangePassword(false); setPwMessage(''); }}>Cancel</button>
          </div>
        </form>
      )}

      {activeTab === 'restaurants' && (
        <>
          <p className="page-sub">
            Manage restaurant availability. Toggle status for any restaurant.
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
                        <button
                          className={`btn btn-sm ${r.active ? 'btn-ghost' : 'btn-primary'}`}
                          onClick={() => handleToggle(r.id)}
                        >
                          {r.active ? '🚫 Deactivate' : '✅ Activate'}
                        </button>
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
            Manage user roles. Admins can delete restaurants; guests cannot.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Current Role</th>
                  <th>Action</th>
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
                      {u.role === 'guest' ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleRoleChange(u.id, 'admin')}
                        >
                          Promote to Admin
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRoleChange(u.id, 'guest')}
                        >
                          Demote to Guest
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p className="empty-state">No users yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
