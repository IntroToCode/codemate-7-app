import { useState, useEffect, useCallback } from 'react';

const PAGE_SIZE = 50;

export default function SpinLog() {
  const [spins, setSpins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (currentOffset = 0, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const res = await fetch(`/api/spins?limit=${PAGE_SIZE}&offset=${currentOffset}`);
      const data = await res.json();
      setSpins((prev) => append ? [...prev, ...data] : data);
      setHasMore(data.length === PAGE_SIZE);
      setOffset(currentOffset + data.length);
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  useEffect(() => { load(0, false); }, [load]);

  function loadMore() {
    load(offset, true);
  }

  if (loading) return <div className="loading">Loading log… 📜</div>;

  return (
    <div className="spin-log-page">
      <div className="page-header">
        <h2>📜 Spin Log</h2>
        <p className="page-sub">The full history of every lunch pick.</p>
      </div>

      {spins.length === 0 && <p className="empty-state">No spins yet — hit the Spin button to get started! 🎰</p>}

      <div className="log-table-wrap">
        <table className="log-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Restaurant</th>
              <th>Spun by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {spins.map((s) => (
              <tr key={s.id} className={s.is_vetoed ? 'row-vetoed' : ''}>
                <td className="td-date">{new Date(s.created_at).toLocaleString()}</td>
                <td className="td-restaurant">{s.restaurant_name || <em>(deleted)</em>}</td>
                <td>{s.spun_by}</td>
                <td>
                  {s.is_vetoed
                    ? <span className="badge badge-veto">🚫 Vetoed</span>
                    : <span className="badge badge-active">✅ Picked</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="load-more-wrap">
          <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : '⬇️ Load more'}
          </button>
        </div>
      )}

      {!hasMore && spins.length > 0 && (
        <p className="log-end">You've reached the beginning of history 🏁</p>
      )}
    </div>
  );
}
