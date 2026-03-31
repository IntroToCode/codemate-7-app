import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

const ACTION_META = {
  restaurant_added:    { icon: '➕', label: (d) => `added ${d?.restaurant_name || 'a restaurant'}${d?.cuisine ? ` (${d.cuisine})` : ''}` },
  restaurant_edited:   { icon: '✏️', label: (d) => `edited ${d?.restaurant_name || 'a restaurant'}` },
  restaurant_deleted:  { icon: '🗑️', label: (d) => `deleted ${d?.restaurant_name || 'a restaurant'}` },
  restaurant_activated:   { icon: '✅', label: (d) => `activated ${d?.restaurant_name || 'a restaurant'}` },
  restaurant_deactivated: { icon: '🚫', label: (d) => `deactivated ${d?.restaurant_name || 'a restaurant'}` },
  rating_cast:   { icon: '⭐', label: (d) => `gave ${d?.score ? `${d.score}/5 stars` : 'a rating'}` },
  tag_added:     { icon: '🏷️', label: (d) => `added tag "${d?.label || ''}"` },
  tag_removed:   { icon: '✂️', label: (d) => `removed tag "${d?.label || ''}"` },
  spin_created:  { icon: '🎰', label: (d) => `spun the wheel → ${d?.restaurant_name || 'a pick'}` },
  spin_vetoed:   { icon: '🚫', label: (d) => `vetoed a pick → ${d?.new_restaurant || 'new pick'}` },
  user_registered: { icon: '👋', label: () => 'joined the team' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ActivityFeed() {
  const { userName } = useUser();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (userFilter) params.set('user_name', userFilter);
      const res = await fetch(`/api/activity?${params}`);
      if (res.ok) setEntries(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [userFilter]);

  const actionGroups = {
    all: null,
    restaurants: ['restaurant_added', 'restaurant_edited', 'restaurant_deleted', 'restaurant_activated', 'restaurant_deactivated'],
    ratings: ['rating_cast'],
    tags: ['tag_added', 'tag_removed'],
    spins: ['spin_created', 'spin_vetoed'],
    people: ['user_registered'],
  };

  const filtered = filter === 'all'
    ? entries
    : entries.filter((e) => actionGroups[filter]?.includes(e.action));

  const uniqueUsers = [...new Set(entries.map((e) => e.user_name))].sort();

  return (
    <div className="activity-feed-page">
      <div className="page-header">
        <h2>📋 Activity</h2>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      <div className="activity-filters">
        <div className="filter-tabs">
          {Object.keys(actionGroups).map((key) => (
            <button
              key={key}
              className={`filter-tab ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
        <select
          className="form-input form-input-sm user-filter"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option value="">All team members</option>
          {uniqueUsers.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {loading && <div className="loading">Loading activity…</div>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <p>No activity recorded yet. Start spinning! 🎰</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="activity-timeline">
          {filtered.map((entry, i) => {
            const meta = ACTION_META[entry.action] || { icon: '•', label: () => entry.action };
            const isMe = entry.user_name === userName;
            return (
              <div key={entry.id} className={`activity-entry ${isMe ? 'activity-entry--me' : ''}`}>
                <div className="activity-icon">{meta.icon}</div>
                <div className="activity-body">
                  <span className="activity-actor">{entry.user_name}</span>
                  {' '}
                  <span className="activity-text">{meta.label(entry.details)}</span>
                </div>
                <div className="activity-time" title={new Date(entry.created_at).toLocaleString()}>
                  {timeAgo(entry.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
