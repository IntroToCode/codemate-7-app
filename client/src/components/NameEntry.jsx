import { useState } from 'react';
import { useUser } from '../context/UserContext';

export default function NameEntry() {
  const { saveName } = useUser();
  const [input, setInput] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (input.trim()) saveName(input.trim());
  }

  return (
    <div className="name-entry-overlay">
      <div className="name-entry-card">
        <div className="name-entry-emoji">🍔</div>
        <h1>Lunch Roulette</h1>
        <p>What's your name? We'll track your spins and picks.</p>
        <form onSubmit={handleSubmit}>
          <input
            className="name-entry-input"
            type="text"
            placeholder="e.g. Alex"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            maxLength={60}
          />
          <button className="btn btn-primary btn-large" type="submit" disabled={!input.trim()}>
            Let's eat 🎲
          </button>
        </form>
      </div>
    </div>
  );
}
