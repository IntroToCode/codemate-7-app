import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

export default function NameEntry() {
  const { saveUser } = useUser();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [needsPasswordUserId, setNeedsPasswordUserId] = useState('');

  useEffect(() => {
    fetch('/api/users/all')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProfiles(data))
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false));
  }, []);

  function handleSelectProfile(e) {
    const id = e.target.value;
    setSelectedId(id);
    setError('');
    setPassword('');
    setNeedsPassword(false);
  }

  async function handleLoginWithSelection(e) {
    e.preventDefault();
    const profile = profiles.find((p) => p.id === selectedId);
    if (!profile) return;

    if (!profile.has_password) {
      setNeedsPassword(true);
      setNeedsPasswordUserId(profile.id);
      setError('');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: profile.first_name,
          lastName: profile.last_name,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsPassword) {
          setNeedsPassword(true);
          setNeedsPasswordUserId(data.userId);
          setError('');
        } else {
          setError(data.error || 'Login failed.');
        }
        return;
      }
      saveUser(data);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/users/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: needsPasswordUserId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to set password.');
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
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), password }),
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

  if (needsPassword) {
    const profile = profiles.find((p) => p.id === needsPasswordUserId);
    return (
      <div className="name-entry-overlay">
        <div className="name-entry-card">
          <div className="name-entry-emoji">🔐</div>
          <h1>Create Password</h1>
          <p>
            Welcome, <strong>{profile ? `${profile.first_name} ${profile.last_name}` : 'user'}</strong>!
            Your profile needs a password. Please create one to continue.
          </p>
          <form onSubmit={handleSetPassword}>
            <input
              className="name-entry-input"
              type="password"
              placeholder="Create password (min 4 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              minLength={4}
            />
            <input
              className="name-entry-input"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={4}
            />
            {error && <div className="name-entry-error">{error}</div>}
            <button
              className="btn btn-primary btn-large"
              type="submit"
              disabled={!password || !confirmPassword || loading}
            >
              {loading ? 'Please wait...' : 'Set Password & Continue 🎲'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-large"
              onClick={() => { setNeedsPassword(false); setPassword(''); setConfirmPassword(''); setError(''); }}
              style={{ marginTop: '0.5rem' }}
            >
              Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  const selectedProfile = profiles.find((p) => p.id === selectedId);

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
            onClick={() => { setMode('login'); setError(''); setPassword(''); setConfirmPassword(''); }}
          >
            Log In
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'register' ? 'mode-tab-active' : ''}`}
            onClick={() => { setMode('register'); setError(''); setPassword(''); setConfirmPassword(''); }}
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
              <>
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
                {selectedId && selectedProfile?.has_password && (
                  <input
                    className="name-entry-input"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                )}
              </>
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
            <input
              className="name-entry-input"
              type="password"
              placeholder="Password (min 4 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={4}
            />
            <input
              className="name-entry-input"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={4}
            />

            {error && <div className="name-entry-error">{error}</div>}

            <button
              className="btn btn-primary btn-large"
              type="submit"
              disabled={!firstName.trim() || !lastName.trim() || !password || !confirmPassword || loading}
            >
              {loading ? 'Please wait...' : 'Create & Go 🎲'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
