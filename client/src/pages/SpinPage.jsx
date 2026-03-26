import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { useTempDisable } from '../context/TempDisableContext';
import RouletteWheel from '../components/RouletteWheel';

import { shuffleArray, priceLabel } from '../components/rouletteUtils.jsx';

const FOOD_EMOJIS = ['🍕', '🌮', '🍔', '🍣', '🥗', '🍜', '🥘', '🍛', '🌯', '🍱'];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sevenDaysAgo() {
  return Date.now() - 7 * 24 * 60 * 60 * 1000;
}

export default function SpinPage({ onSpin }) {
  const { userName, isAdmin, adminLoading } = useUser();
  const { tempDisabled, clearAll } = useTempDisable();

  const [allRestaurants, setAllRestaurants] = useState([]);
  const [recentRestaurantIds, setRecentRestaurantIds] = useState(new Set());
  const [loadingRest, setLoadingRest] = useState(true);
  const [wheelRestaurants, setWheelRestaurants] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState(null);
  const pendingResultRef = useRef(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [excludeRecent, setExcludeRecent] = useState(true);
  const [vetoing, setVetoing] = useState(false);
  const spinInProgress = useRef(false);

  useEffect(() => {
    if (!userName) return;

    Promise.all([
      fetch('/api/restaurants').then((r) => r.json()),
      fetch(`/api/settings?user=${encodeURIComponent(userName)}`).then((r) => r.json()),
      fetch('/api/spins?limit=200').then((r) => r.json()),
    ])
      .then(([restaurantData, settingsData, spinsData]) => {
        const active = Array.isArray(restaurantData)
          ? restaurantData.filter((r) => r.active)
          : [];

        const cutoff = sevenDaysAgo();
        const recentIds = new Set(
          Array.isArray(spinsData)
            ? spinsData
                .filter((s) => !s.is_vetoed && new Date(s.created_at).getTime() >= cutoff)
                .map((s) => s.restaurant_id)
            : []
        );

        const exclude = settingsData.exclude_recent_7_days ?? true;
        setExcludeRecent(exclude);
        setAllRestaurants(active);
        setRecentRestaurantIds(recentIds);

        const initial = buildWheel(active, recentIds, exclude, new Set());
        setWheelRestaurants(initial);
      })
      .catch(() => {})
      .finally(() => setLoadingRest(false));
  }, [userName]);

  function buildWheel(active, recentIds, exclude, skipped) {
    const candidates = active.filter((r) => !skipped.has(r.id));
    if (!exclude || recentIds.size === 0) {
      return shuffleArray(candidates).slice(0, 8);
    }
    const eligible = candidates.filter((r) => !recentIds.has(r.id));
    const pool = eligible.length >= 2 ? eligible : candidates;
    return shuffleArray(pool).slice(0, 8);
  }

  const activeOnWheel = useCallback(() => {
    return allRestaurants.filter((r) => !tempDisabled.has(r.id));
  }, [allRestaurants, tempDisabled]);

  async function handleToggleExclude(e) {
    const newVal = e.target.checked;
    const oldVal = excludeRecent;
    setExcludeRecent(newVal);
    const newWheel = buildWheel(allRestaurants, recentRestaurantIds, newVal, tempDisabled);
    setWheelRestaurants(newWheel);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, exclude_recent_7_days: newVal }),
      });
      if (!res.ok) {
        setExcludeRecent(oldVal);
        const revertWheel = buildWheel(allRestaurants, recentRestaurantIds, oldVal, tempDisabled);
        setWheelRestaurants(revertWheel);
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

    const pool = buildWheel(available, recentRestaurantIds, excludeRecent, new Set());
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
    const winner = pendingResultRef.current;
    setResult(winner);
    if (winner) {
      setRecentRestaurantIds((prev) => new Set([...prev, winner.restaurant.id]));
    }
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

          <label
            className={`toggle-label${(!adminLoading && !isAdmin) ? ' toggle-label-disabled' : ''}`}
            title={adminLoading ? 'Checking permissions…' : (!isAdmin ? 'Admin only' : undefined)}
          >
            <input
              type="checkbox"
              checked={excludeRecent}
              onChange={handleToggleExclude}
              disabled={spinning || adminLoading || !isAdmin}
            />
            <span>Exclude restaurants visited in the last 7 days</span>
            {!adminLoading && !isAdmin && <span className="toggle-admin-note"> (Admin only)</span>}
          </label>
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
