import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import StarRating from '../components/StarRating';

function priceLabel(n) {
  return n ? '$'.repeat(n) : '—';
}

export default function AdminDashboard() {
  const { userName, isAdmin, adminLoading } = useUser();
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
    await fetch(`/api/restaurants/${id}/toggle`, { method: 'PATCH' });
    load();
  }

  if (adminLoading || loading) return <div className="loading">Loading… 🍽️</div>;

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="page-header">
          <h2>⚙️ Admin Dashboard</h2>
        </div>
        <div className="access-denied">
          <p>🔒 Admin access only. You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>⚙️ Admin Dashboard</h2>
        <p className="page-sub">
          You can toggle availability for restaurants <em>you added</em> (marked 👑).
          Other rows are view-only.
        </p>
      </div>

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
                <tr key={r.id} className={`${r.active ? '' : 'row-inactive'} ${!isOwner ? 'row-readonly' : ''}`}>
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
                    {isOwner ? (
                      <button
                        className={`btn btn-sm ${r.active ? 'btn-ghost' : 'btn-primary'}`}
                        onClick={() => handleToggle(r.id)}
                      >
                        {r.active ? '🚫 Deactivate' : '✅ Activate'}
                      </button>
                    ) : (
                      <span className="td-readonly">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {restaurants.length === 0 && <p className="empty-state">No restaurants yet.</p>}
      </div>
    </div>
  );
}
