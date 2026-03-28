import { useState } from 'react';
import { useUser } from '../context/UserContext';

export default function NameEntry() {
  const { saveUser } = useUser();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setError('');
    setLoading(true);

    const endpoint = mode === 'login' ? '/api/users/login' : '/api/users/register';

    try {
      const res = await fetch(endpoint, {
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

  const isValid = firstName.trim() && lastName.trim();

  return (
    <div className="name-entry-overlay">
      <div className="name-entry-card">
        <div className="name-entry-emoji">🍔</div>
        <h1>Lunch Roulette</h1>
        <p>{mode === 'login' ? 'Log in to your profile.' : 'Create a new profile.'}</p>

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

        <form onSubmit={handleSubmit}>
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
            disabled={!isValid || loading}
          >
            {loading ? 'Please wait...' : mode === 'login' ? "Let's eat 🎲" : 'Create & Go 🎲'}
          </button>
        </form>
      </div>
    </div>
  );
}
