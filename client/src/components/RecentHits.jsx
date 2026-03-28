import { useEffect, useState } from 'react';

const FOOD_EMOJIS = ['🍕', '🌮', '🍜', '🍣', '🥗', '🍔', '🌯', '🥘', '🍛', '🍱'];

function randomEmoji(str) {
  const code = [...(str || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return FOOD_EMOJIS[code % FOOD_EMOJIS.length];
}

export default function RecentHits({ refresh }) {
  const [hits, setHits] = useState([]);

  async function load() {
    try {
      const res = await fetch('/api/spins?limit=5&exclude_vetoed=true');
      const data = await res.json();
      setHits(data);
    } catch {
      /* silent */
    }
  }

  useEffect(() => { load(); }, [refresh]);

  return (
    <div className="recent-hits">
      <h3 className="sidebar-title">🔥 Recent Hits</h3>
      {hits.length === 0 && <p className="sidebar-empty">No spins yet — be the first! 🎉</p>}
      <ul className="hits-list">
        {hits.map((hit) => (
          <li key={hit.id} className="hit-item">
            <span className="hit-emoji">{randomEmoji(hit.restaurant_name)}</span>
            <div className="hit-info">
              <span className="hit-name">{hit.restaurant_name || '(deleted)'}</span>
              <span className="hit-meta">{hit.spun_by} · {new Date(hit.created_at).toLocaleDateString()}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
