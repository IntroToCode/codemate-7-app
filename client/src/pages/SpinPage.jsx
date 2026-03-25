import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { useTempDisable } from '../context/TempDisableContext';
import RouletteWheel from '../components/RouletteWheel';

import { shuffleArray, priceLabel } from '../components/rouletteUtils.jsx';

const FOOD_EMOJIS = ['🍕', '🌮', '🍔', '🍣', '🥗', '🍜', '🥘', '🍛', '🌯', '🍱'];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function SpinPage({ onSpin }) {
  const { userName, isAdmin } = useUser();
  const { tempDisabled, clearAll } = useTempDisable();

  const [allRestaurants, setAllRestaurants] = useState([]);
  const [loadingRest, setLoadingRest] = useState(true);
  const [wheelRestaurants, setWheelRestaurants] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState(null);
  const pendingResultRef = useRef(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [excludeRecent, setExcludeRecent] = useState(true);
  const [loadingSetting, setLoadingSetting] = useState(true);
  const [vetoing, setVetoing] = useState(false);
  const spinInProgress = useRef(false);

  useEffect(() => {
    fetch('/api/restaurants')
      .then((r) => r.json())
      .then((data) => {
        const active = Array.isArray(data) ? data.filter((r) => r.active) : [];
        setAllRestaurants(active);
        const initial = shuffleArray(active).slice(0, 8);
        setWheelRestaurants(initial);
      })
      .catch(() => {})
      .finally(() => setLoadingRest(false));
  }, []);

  useEffect(() => {
    if (!userName) return;
    fetch(`/api/settings?user=${encodeURIComponent(userName)}`)
      .then((r) => r.json())
      .then((data) => {
        setExcludeRecent(data.exclude_recent_7_days);
      })
      .catch(() => {})
      .finally(() => setLoadingSetting(false));
  }, [userName]);

  const activeOnWheel = useCallback(() => {
    return allRestaurants.filter((r) => !tempDisabled.has(r.id));
  }, [allRestaurants, tempDisabled]);

  async function handleToggleExclude(e) {
    const newVal = e.target.checked;
    const oldVal = excludeRecent;
    setExcludeRecent(newVal);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, exclude_recent_7_days: newVal }),
      });
      if (!res.ok) {
        setExcludeRecent(oldVal);
      }
    } catch {
      setExcludeRecent(oldVal);
    }
  }

  async function doSpin(isVeto = false, vetoSpinId = null) {
    if (spinInProgress.current) return;
    spinInProgress.current = true;

    setError('');
    setResult(null);
    pendingResultRef.current = null;
    setWinnerIndex(null);
    setSpinning(false);
    if (isVeto) setVetoing(true);

    const available = activeOnWheel();
    if (available.length < 2) {
      setError('You need at least 2 active restaurants to spin!');
      spinInProgress.current = false;
      setVetoing(false);
      return;
    }

    const pool = shuffleArray(available).slice(0, 8);
    setWheelRestaurants(pool);

    const entranceDuration = pool.length * 100 + 450;
    await sleep(entranceDuration);

    setSpinning(true);

    const poolIdSet = new Set(pool.map((r) => r.id));
    const extraSkips = available.filter((r) => !poolIdSet.has(r.id)).map((r) => r.id);
    const skipIds = [...Array.from(tempDisabled), ...extraSkips];

    const minSpinPromise = sleep(3600);

    try {
      let res;
      if (isVeto && vetoSpinId) {
        res = await fetch(`/api/spins/${vetoSpinId}/veto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spun_by: userName, skip_ids: skipIds }),
        });
      } else {
        res = await fetch('/api/spins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spun_by: userName, skip_ids: skipIds }),
        });
      }

      const data = await res.json();
      await minSpinPromise;

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        setSpinning(false);
        setVetoing(false);
        spinInProgress.current = false;
        return;
      }

      const idx = pool.findIndex((r) => r.id === data.restaurant.id);
      if (idx < 0) {
        setError(`"${data.restaurant.name}" was picked but is not on the wheel. Please spin again.`);
        setSpinning(false);
        setVetoing(false);
        spinInProgress.current = false;
        return;
      }

      pendingResultRef.current = data;
      setWinnerIndex(idx);
    } catch {
      setError('Network error. Please try again.');
      setSpinning(false);
      setVetoing(false);
      spinInProgress.current = false;
    }
  }

  function handleSpinComplete() {
    setSpinning(false);
    setVetoing(false);
    setResult(pendingResultRef.current);
    clearAll();
    spinInProgress.current = false;
    if (onSpin) onSpin();
  }

  function handleVeto() {
    if (!result?.spin?.id) return;
    doSpin(true, result.spin.id);
  }

  const available = activeOnWheel();
  const tooFew = !loadingRest && available.length < 2;

  return (
    <div className="spin-page">
      <div className="spin-hero">
        {loadingRest || wheelRestaurants.length < 2 ? (
          <div className="roulette-loading">
            {loadingRest ? 'Loading wheel…' : ''}
          </div>
        ) : (
          <RouletteWheel
            restaurants={wheelRestaurants}
            spinning={spinning}
            winnerIndex={winnerIndex}
            onSpinComplete={handleSpinComplete}
          />
        )}

        <div className="spin-controls">
          {tooFew ? (
            <p className="roulette-min-notice">
              🍽️ Add at least 2 restaurants to spin the wheel!
            </p>
          ) : (
            <button
              className="btn btn-spin"
              onClick={() => doSpin(false)}
              disabled={spinning || vetoing || tooFew}
            >
              {spinning && !vetoing
                ? '🎡 Spinning…'
                : vetoing
                ? '🔄 Re-spinning…'
                : '🎡 Spin the Wheel!'}
            </button>
          )}

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={excludeRecent}
              onChange={handleToggleExclude}
              disabled={spinning || !isAdmin}
            />
            <span>Exclude restaurants visited in the last 7 days</span>
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
          <h2 className="result-label">🎉 Today's lunch pick is…</h2>
          <div className="result-card">
            <div className="result-emoji">
              {FOOD_EMOJIS[result.restaurant.name.length % FOOD_EMOJIS.length]}
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
            {vetoing ? '🔄 Re-spinning…' : '🚫 Veto — Re-spin!'}
          </button>
        </div>
      )}
    </div>
  );
}
