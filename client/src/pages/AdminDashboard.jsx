import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import StarRating from '../components/StarRating';

function priceLabel(n) {
  return n ? '$'.repeat(n) : '—';
}

function ManageAdmins({ userName }) {
  const [admins, setAdmins] = useState([]);
  const [knownUsers, setKnownUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAdmins() {
    try {
      setError('');
      const [adminsRes, usersRes] = await Promise.all([
        fetch('/api/settings/admins'),
        fetch('/api/settings/known-users'),
      ]);
      if (!adminsRes.ok || !usersRes.ok) {
        setError('Failed to load admin data.');
        return;
      }
      const adminsData = await adminsRes.json();
      const usersData = await usersRes.json();
      setAdmins(adminsData);
      const adminUsernames = new Set(adminsData.map(a => a.username));
      const nonAdminUsers = usersData.filter(u => !adminUsernames.has(u));
      setKnownUsers(nonAdminUsers);
      setSelectedUser(nonAdminUsers[0] || '');
    } catch {
      setError('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAdmins(); }, []);

  async function handlePromote() {
    if (!selectedUser) return;
    try {
      setError('');
      const res = await fetch('/api/settings/admins/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, target: selectedUser }),
      });
      if (res.ok) {
        loadAdmins();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to promote user.');
      }
    } catch {
      setError('Failed to promote user.');
    }
  }

  async function handleDemote(target) {
    try {
      setError('');
      const res = await fetch('/api/settings/admins/demote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, target }),
      });
      if (res.ok) {
        loadAdmins();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to demote user.');
      }
    } catch {
      setError('Failed to demote user.');
    }
  }

  if (loading) return <div className="loading">Loading admins…</div>;

  return (
    <div className="manage-admins-section">
      <h3>👥 Manage Admins</h3>

      {error && <p className="admin-error" style={{ color: '#e53e3e', marginBottom: '0.5rem' }}>{error}</p>}

      <div className="admin-list">
        <h4>Current Admins</h4>
        {admins.length === 0 && <p className="empty-state">No admins configured.</p>}
        <ul className="admin-user-list">
          {admins.map(admin => (
            <li key={admin.username} className="admin-user-item">
              <span className="admin-user-name">
                {admin.username}
                {admin.username === userName && <span className="you-badge"> (you)</span>}
              </span>
              <button
                className="btn btn-sm btn-ghost"
                disabled={admin.username === userName}
                onClick={() => handleDemote(admin.username)}
                title={admin.username === userName ? 'You cannot demote yourself' : `Demote ${admin.username}`}
              >
                🚫 Demote
              </button>
            </li>
          ))}
        </ul>
      </div>

      {knownUsers.length > 0 && (
        <div className="promote-section">
          <h4>Promote User to Admin</h4>
          <div className="promote-controls">
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="admin-select"
            >
              {knownUsers.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <button className="btn btn-sm btn-primary" onClick={handlePromote}>
              ✅ Promote
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { userName, isAdmin, adminName, adminLoading } = useUser();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/restaurants');
      setRestaurants(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(id) {
    if (!isAdmin) return;
    await fetch(`/api/restaurants/${id}/toggle`, { method: 'PATCH' });
    load();
  }

  if (adminLoading || loading) return <div className="loading">Loading… 🍽️</div>;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>⚙️ Admin Dashboard</h2>
        {isAdmin && (
          <p className="page-sub">
            Toggle availability for any restaurant. Restaurants you added are marked 👑.
          </p>
        )}
      </div>

      {isAdmin && <ManageAdmins userName={userName} />}

      <div className="admin-content-wrap">
        <div className={`admin-table-wrap ${!isAdmin ? 'admin-locked' : ''}`}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Cuisine</th>
                <th>Price</th>
                <th>Rating</th>
                <th>Added by</th>
                <th>Status</th>
                {isAdmin && <th>Action</th>}
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
                    {isAdmin && (
                      <td>
                        <button
                          className={`btn btn-sm ${r.active ? 'btn-ghost' : 'btn-primary'}`}
                          onClick={() => handleToggle(r.id)}
                        >
                          {r.active ? '🚫 Deactivate' : '✅ Activate'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {restaurants.length === 0 && <p className="empty-state">No restaurants yet.</p>}
        </div>

        {!isAdmin && (
          <div className="admin-overlay">
            <div className="admin-overlay-badge">
              🔒 Admin Only{adminName ? ` — ${adminName}` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
