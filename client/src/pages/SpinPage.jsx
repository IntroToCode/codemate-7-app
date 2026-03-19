import { useState, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useTempDisable } from '../context/TempDisableContext';

const SLOT_SYMBOLS = ['🍕', '🌮', '🍔', '🍣', '🥗', '🍜', '🥘', '🍛', '🌯', '🍱'];

function priceLabel(n) {
  return n ? '$'.repeat(n) : '?';
}

export default function SpinPage({ onSpin }) {
  const { userName } = useUser();
  const { tempDisabled, clearAll } = useTempDisable();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [excludeRecent, setExcludeRecent] = useState(true);
  const [slotSymbol, setSlotSymbol] = useState('🎰');
  const [vetoing, setVetoing] = useState(false);
  const intervalRef = useRef(null);

  async function doSpin(isVeto = false, vetoSpinId = null) {
    setError('');
    setSpinning(true);
    setResult(null);

    let symbolIdx = 0;
    intervalRef.current = setInterval(() => {
      symbolIdx = (symbolIdx + 1) % SLOT_SYMBOLS.length;
      setSlotSymbol(SLOT_SYMBOLS[symbolIdx]);
    }, 80);

    const skipIds = Array.from(tempDisabled);

    try {
      let res;
      if (isVeto && vetoSpinId) {
        res = await fetch(`/api/spins/${vetoSpinId}/veto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spun_by: userName, exclude_recent: excludeRecent, skip_ids: skipIds }),
        });
      } else {
        res = await fetch('/api/spins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spun_by: userName, exclude_recent: excludeRecent, skip_ids: skipIds }),
        });
      }

      const data = await res.json();

      await new Promise((r) => setTimeout(r, 900));

      clearInterval(intervalRef.current);

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        setSlotSymbol('🎰');
      } else {
        setResult(data);
        setSlotSymbol('🎉');
        clearAll();
        if (onSpin) onSpin();
      }
    } catch (err) {
      clearInterval(intervalRef.current);
      setError('Network error. Please try again.');
      setSlotSymbol('🎰');
    } finally {
      setSpinning(false);
      setVetoing(false);
    }
  }

  function handleVeto() {
    if (!result?.spin?.id) return;
    setVetoing(true);
    doSpin(true, result.spin.id);
  }

  return (
    <div className="spin-page">
      <div className="spin-hero">
        <div className={`slot-display ${spinning ? 'spinning' : ''}`}>
          <span className="slot-symbol">{slotSymbol}</span>
        </div>

        <div className="spin-controls">
          <button
            className="btn btn-spin"
            onClick={() => doSpin(false)}
            disabled={spinning || vetoing}
          >
            {spinning && !vetoing ? '🎲 Spinning...' : '🎲 Spin the Wheel!'}
          </button>

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={excludeRecent}
              onChange={(e) => setExcludeRecent(e.target.checked)}
              disabled={spinning}
            />
            <span>Skip last 5 visited</span>
          </label>

          {tempDisabled.size > 0 && (
            <p className="skip-notice">
              ⏸️ {tempDisabled.size} restaurant{tempDisabled.size > 1 ? 's' : ''} skipped this spin
              (set on the Restaurants page — clears after spin)
            </p>
          )}
        </div>

        {error && <div className="spin-error">{error}</div>}
      </div>

      {result && !spinning && (
        <div className="spin-result">
          <h2 className="result-label">Today's lunch pick is…</h2>
          <div className="result-card">
            <div className="result-emoji">
              {SLOT_SYMBOLS[result.restaurant.name.length % SLOT_SYMBOLS.length]}
            </div>
            <div className="result-info">
              <h3 className="result-name">{result.restaurant.name}</h3>
              {result.restaurant.cuisine && (
                <span className="result-tag">{result.restaurant.cuisine}</span>
              )}
              {result.restaurant.price_range && (
                <span className="result-tag price">{priceLabel(result.restaurant.price_range)}</span>
              )}
              {result.restaurant.address && (
                <p className="result-address">📍 {result.restaurant.address}</p>
              )}
            </div>
          </div>

          <button
            className="btn btn-veto"
            onClick={handleVeto}
            disabled={vetoing || spinning}
          >
            {vetoing ? '🔄 Re-spinning...' : '🚫 Veto — Re-spin!'}
          </button>
        </div>
      )}
    </div>
  );
}
