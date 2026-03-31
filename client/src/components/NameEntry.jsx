import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

export default function NameEntry() {
  const { saveUser } = useUser();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    fetch('/api/users/all')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProfiles(data))
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false));
  }, []);

  function handleSelectProfile(e) {
    setSelectedId(e.target.value);
    setError('');
  }

  async function handleLoginWithSelection(e) {
    e.preventDefault();
    const profile = profiles.find((p) => p.id === selectedId);
    if (!profile) return;

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: profile.first_name,
          lastName: profile.last_name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }
      saveUser(data);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      saveUser(data);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="name-entry-overlay">
      <div className="name-entry-card">
        <div className="name-entry-emoji">🍔</div>
        <h1>Lunch Roulette</h1>
        <p>{mode === 'login' ? 'Select your profile to log in.' : 'Create a new profile.'}</p>

        <div className="mode-tabs">
          <button
            type="button"
            className={`mode-tab ${mode === 'login' ? 'mode-tab-active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Log In
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'register' ? 'mode-tab-active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Create Profile
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLoginWithSelection}>
            {profilesLoading ? (
              <div className="name-entry-loading">Loading profiles...</div>
            ) : profiles.length === 0 ? (
              <div className="name-entry-empty">
                No profiles yet. Create one to get started!
              </div>
            ) : (
              <select
                className="name-entry-select"
                value={selectedId}
                onChange={handleSelectProfile}
              >
                <option value="">-- Select your profile --</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            )}

            {error && <div className="name-entry-error">{error}</div>}

            <button
              className="btn btn-primary btn-large"
              type="submit"
              disabled={!selectedId || profilesLoading || loading}
            >
              {loading ? 'Please wait...' : "Let's eat 🎲"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <input
              className="name-entry-input"
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              maxLength={50}
            />
            <input
              className="name-entry-input"
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={50}
            />

            {error && <div className="name-entry-error">{error}</div>}

            <button
              className="btn btn-primary btn-large"
              type="submit"
              disabled={!firstName.trim() || !lastName.trim() || loading}
            >
              {loading ? 'Please wait...' : 'Create & Go 🎲'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
