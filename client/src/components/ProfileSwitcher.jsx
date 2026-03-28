import { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';

export default function ProfileSwitcher() {
  const { userName, userId, saveUser, logout } = useUser();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [switchTarget, setSwitchTarget] = useState(null);
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [switchLoading, setSwitchLoading] = useState(false);
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
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSwitchTarget(null);
        setSwitchPassword('');
        setSwitchError('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleSwitchClick(profile) {
    if (!profile.has_password) {
      logout();
      setOpen(false);
      return;
    }
    setSwitchTarget(profile);
    setSwitchPassword('');
    setSwitchError('');
  }

  async function handleSwitchConfirm(e) {
    e.preventDefault();
    if (!switchTarget) return;
    setSwitchError('');
    setSwitchLoading(true);
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: switchTarget.first_name,
          lastName: switchTarget.last_name,
          password: switchPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSwitchError(data.error || 'Login failed.');
        return;
      }
      saveUser(data);
      setOpen(false);
      setSwitchTarget(null);
      setSwitchPassword('');
    } catch {
      setSwitchError('Network error.');
    } finally {
      setSwitchLoading(false);
    }
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

          {!loading && !error && !switchTarget && (
            <ul className="switcher-list">
              {profiles.map((p) => {
                const isCurrent = p.id === userId;
                return (
                  <li key={p.id}>
                    <button
                      className={`switcher-item ${isCurrent ? 'switcher-item-current' : ''}`}
                      onClick={() => !isCurrent && handleSwitchClick(p)}
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

          {switchTarget && (
            <form className="switcher-password-form" onSubmit={handleSwitchConfirm}>
              <div className="switcher-password-label">
                Password for {switchTarget.first_name} {switchTarget.last_name}:
              </div>
              <input
                className="form-input form-input-sm"
                type="password"
                placeholder="Enter password"
                value={switchPassword}
                onChange={(e) => setSwitchPassword(e.target.value)}
                autoFocus
              />
              {switchError && <div className="switcher-error">{switchError}</div>}
              <div className="switcher-password-actions">
                <button
                  className="btn btn-primary btn-sm"
                  type="submit"
                  disabled={!switchPassword || switchLoading}
                >
                  {switchLoading ? '...' : 'Switch'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => { setSwitchTarget(null); setSwitchPassword(''); setSwitchError(''); }}
                >
                  Cancel
                </button>
              </div>
            </form>
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
