import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import StarRating from '../components/StarRating';

function priceLabel(n) {
  return n ? '$'.repeat(n) : '—';
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
