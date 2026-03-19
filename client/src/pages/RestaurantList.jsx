import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import StarRating from '../components/StarRating';

function priceLabel(n) {
  return n ? '$'.repeat(n) : '—';
}

export default function RestaurantList() {
  const { userName } = useUser();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newTag, setNewTag] = useState({});
  const [form, setForm] = useState({ name: '', cuisine: '', price_range: '', address: '' });
  const [autofilling, setAutofilling] = useState(false);
  const [tempDisabled, setTempDisabled] = useState(new Set());

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

  async function autofill(name) {
    if (!name.trim()) return;
    setAutofilling(true);
    try {
      const res = await fetch(`/api/restaurants/autofill?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      setForm((f) => ({
        ...f,
        cuisine: data.cuisine || f.cuisine,
        price_range: data.price_range || f.price_range,
        address: data.address || f.address,
      }));
    } finally {
      setAutofilling(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    await fetch('/api/restaurants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, added_by: userName }),
    });
    setShowAdd(false);
    setForm({ name: '', cuisine: '', price_range: '', address: '' });
    load();
  }

  async function handleEdit(r) {
    setEditId(r.id);
    setForm({ name: r.name, cuisine: r.cuisine || '', price_range: r.price_range || '', address: r.address || '' });
  }

  async function handleSaveEdit(id) {
    await fetch(`/api/restaurants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setEditId(null);
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this restaurant?')) return;
    await fetch(`/api/restaurants/${id}`, { method: 'DELETE' });
    load();
  }

  async function handleToggle(id) {
    await fetch(`/api/restaurants/${id}/toggle`, { method: 'PATCH' });
    load();
  }

  function handleTempDisable(id) {
    setTempDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAddTag(restaurantId) {
    const label = newTag[restaurantId];
    if (!label?.trim()) return;
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, label: label.trim() }),
    });
    setNewTag((t) => ({ ...t, [restaurantId]: '' }));
    load();
  }

  async function handleDeleteTag(tagId) {
    await fetch(`/api/tags/${tagId}`, { method: 'DELETE' });
    load();
  }

  async function handleRate(restaurantId, score) {
    await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, rated_by: userName, score }),
    });
    load();
  }

  if (loading) return <div className="loading">Loading restaurants… 🍽️</div>;

  return (
    <div className="restaurant-list-page">
      <div className="page-header">
        <h2>🗂️ Restaurants</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '✕ Cancel' : '＋ Add Restaurant'}
        </button>
      </div>

      {showAdd && (
        <form className="add-form card" onSubmit={handleAdd}>
          <h3>New Restaurant</h3>
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onBlur={(e) => autofill(e.target.value)}
              required
            />
            {autofilling && <span className="autofill-badge">✨ Autofilling…</span>}
          </div>
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Cuisine"
              value={form.cuisine}
              onChange={(e) => setForm((f) => ({ ...f, cuisine: e.target.value }))}
            />
            <select
              className="form-input"
              value={form.price_range}
              onChange={(e) => setForm((f) => ({ ...f, price_range: e.target.value }))}
            >
              <option value="">Price range</option>
              <option value="1">$ Budget</option>
              <option value="2">$$ Mid-range</option>
              <option value="3">$$$ Upscale</option>
              <option value="4">$$$$ Fine dining</option>
            </select>
          </div>
          <input
            className="form-input"
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <button className="btn btn-primary" type="submit">Add 🎉</button>
        </form>
      )}

      {restaurants.length === 0 && !showAdd && (
        <div className="empty-state">
          <p>No restaurants yet! Add your first spot 🍔</p>
        </div>
      )}

      <div className="restaurant-cards">
        {restaurants.map((r) => (
          <div key={r.id} className={`restaurant-card card ${!r.active || tempDisabled.has(r.id) ? 'inactive' : ''}`}>
            {editId === r.id ? (
              <div className="edit-form">
                <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                <input className="form-input" value={form.cuisine} onChange={(e) => setForm((f) => ({ ...f, cuisine: e.target.value }))} />
                <select className="form-input" value={form.price_range} onChange={(e) => setForm((f) => ({ ...f, price_range: e.target.value }))}>
                  <option value="">Price</option>
                  <option value="1">$</option>
                  <option value="2">$$</option>
                  <option value="3">$$$</option>
                  <option value="4">$$$$</option>
                </select>
                <input className="form-input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                <div className="card-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(r.id)}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="card-top">
                  <div className="card-title-row">
                    <h4 className="card-name">{r.name}</h4>
                    <div className="status-badges">
                      <span className={`badge ${r.active ? 'badge-active' : 'badge-inactive'}`}>
                        {r.active ? 'Active' : 'Inactive'}
                      </span>
                      {tempDisabled.has(r.id) && <span className="badge badge-temp">Skip next</span>}
                    </div>
                  </div>
                  <div className="card-meta">
                    {r.cuisine && <span className="meta-chip">🍴 {r.cuisine}</span>}
                    {r.price_range && <span className="meta-chip price-chip">{priceLabel(r.price_range)}</span>}
                    {r.address && <span className="meta-address">📍 {r.address}</span>}
                  </div>
                  <div className="card-rating">
                    <StarRating
                      value={parseFloat(r.avg_rating) || 0}
                      onRate={(score) => handleRate(r.id, score)}
                    />
                    {r.avg_rating && (
                      <span className="rating-label">{parseFloat(r.avg_rating).toFixed(1)} ({r.rating_count})</span>
                    )}
                  </div>
                </div>

                <div className="tag-section">
                  <div className="tag-list">
                    {(r.tags || []).map((t) => (
                      <span key={t.id} className="tag">
                        {t.label}
                        <button className="tag-delete" onClick={() => handleDeleteTag(t.id)}>×</button>
                      </span>
                    ))}
                  </div>
                  <div className="tag-add-row">
                    <input
                      className="form-input form-input-sm"
                      placeholder="Add tag…"
                      value={newTag[r.id] || ''}
                      onChange={(e) => setNewTag((t) => ({ ...t, [r.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag(r.id))}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={() => handleAddTag(r.id)}>+</button>
                  </div>
                </div>

                <div className="card-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)}>✏️ Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(r.id)}>
                    {r.active ? '🚫 Deactivate' : '✅ Activate'}
                  </button>
                  <button
                    className={`btn btn-sm ${tempDisabled.has(r.id) ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleTempDisable(r.id)}
                    title="Temporarily skip this restaurant for the next spin"
                  >
                    {tempDisabled.has(r.id) ? '↩️ Re-enable' : '⏸️ Skip next'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>🗑️</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
