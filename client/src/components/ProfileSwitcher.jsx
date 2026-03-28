import { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';

export default function ProfileSwitcher() {
  const { userName, userId, saveUser, logout } = useUser();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    fetch('/api/users/all')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load profiles');
        return r.json();
      })
      .then((data) => setProfiles(data))
      .catch(() => setError('Could not load profiles.'))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleSwitch(profile) {
    saveUser(profile);
    setOpen(false);
  }

  return (
    <div className="profile-switcher" ref={ref}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((v) => !v)}
        title="Switch profile"
      >🔄</button>

      {open && (
        <div className="switcher-dropdown">
          <div className="switcher-header">Switch Profile</div>

          {loading && <div className="switcher-loading">Loading...</div>}
          {error && <div className="switcher-error">{error}</div>}

          {!loading && !error && profiles.length === 0 && (
            <div className="switcher-empty">No other profiles found.</div>
          )}

          {!loading && !error && (
            <ul className="switcher-list">
              {profiles.map((p) => {
                const isCurrent = p.id === userId;
                return (
                  <li key={p.id}>
                    <button
                      className={`switcher-item ${isCurrent ? 'switcher-item-current' : ''}`}
                      onClick={() => !isCurrent && handleSwitch(p)}
                      disabled={isCurrent}
                    >
                      <span className="switcher-name">
                        {p.first_name} {p.last_name}
                      </span>
                      {isCurrent && <span className="switcher-badge">current</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="switcher-footer">
            <button className="btn btn-ghost btn-sm switcher-logout" onClick={() => { logout(); setOpen(false); }}>
              Log out / Create new
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
