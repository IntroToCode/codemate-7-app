import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

export default function NameEntry() {
  const { loginUser } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('select');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
        if (!Array.isArray(data) || data.length === 0) {
          setMode('create');
        }
      })
      .catch(() => setMode('create'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSelectLogin(e) {
    e.preventDefault();
    if (!selectedUserId) return;
    const user = users.find((u) => u.id === selectedUserId);
    if (user) await loginUser(user);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create profile');
        return;
      }
      await loginUser(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="name-entry-overlay">
        <div className="name-entry-card">
          <div className="name-entry-emoji">🍔</div>
          <h1>Lunch Roulette</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="name-entry-overlay">
      <div className="name-entry-card">
        <div className="name-entry-emoji">🍔</div>
        <h1>Lunch Roulette</h1>

        {mode === 'select' && users.length > 0 && (
          <>
            <p>Welcome back! Select your profile to continue.</p>
            <form onSubmit={handleSelectLogin}>
              <select
                className="name-entry-input"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">-- Select your profile --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary btn-large"
                type="submit"
                disabled={!selectedUserId}
              >
                Let's eat 🎲
              </button>
            </form>
            <div className="name-entry-divider">
              <span>or</span>
            </div>
            <button
              className="btn btn-ghost btn-large name-entry-switch"
              onClick={() => setMode('create')}
            >
              Create new profile
            </button>
          </>
        )}

        {mode === 'create' && (
          <>
            <p>Create your profile to get started.</p>
            <form onSubmit={handleCreate}>
              <input
                className="name-entry-input"
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                maxLength={100}
              />
              <input
                className="name-entry-input"
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={100}
              />
              {error && <p className="name-entry-error">{error}</p>}
              <button
                className="btn btn-primary btn-large"
                type="submit"
                disabled={!firstName.trim() || !lastName.trim() || submitting}
              >
                {submitting ? 'Creating...' : "Let's eat 🎲"}
              </button>
            </form>
            {users.length > 0 && (
              <>
                <div className="name-entry-divider">
                  <span>or</span>
                </div>
                <button
                  className="btn btn-ghost btn-large name-entry-switch"
                  onClick={() => setMode('select')}
                >
                  Use existing profile
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
