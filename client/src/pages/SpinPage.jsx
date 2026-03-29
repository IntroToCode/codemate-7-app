import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useTempDisable } from '../context/TempDisableContext';
import RouletteWheel from '../components/RouletteWheel';

import { shuffleArray, priceLabel } from '../components/rouletteUtils.jsx';

const FOOD_EMOJIS = ['🍕', '🌮', '🍔', '🍣', '🥗', '🍜', '🥘', '🍛', '🌯', '🍱'];
const RECENT_EXCLUSION_DAYS = 7;
const ALL_EXCLUDED_MESSAGE = `All active restaurants were picked in the last ${RECENT_EXCLUSION_DAYS} days. Turn off the 7-day filter or wait for the window to pass.`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatTimeRemaining(resetTime) {
  if (!resetTime) return '';
  const diff = new Date(resetTime).getTime() - Date.now();
  if (diff <= 0) return '';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function buildWheelPool(restaurants) {
  return shuffleArray(restaurants).slice(0, 8);
}

export default function SpinPage({ onSpin }) {
  const { userName } = useUser();
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
  const [recentExcludedIds, setRecentExcludedIds] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [vetoing, setVetoing] = useState(false);
  const spinInProgress = useRef(false);

  const [spinInfo, setSpinInfo] = useState(null);

  const fetchSpinInfo = useCallback(() => {
    if (!userName) return;
    return fetch(`/api/spins/remaining?user_name=${encodeURIComponent(userName)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch spin info');
        return r.json();
      })
      .then((data) => {
        if (data && typeof data.remaining === 'number') {
          setSpinInfo(data);
        }
      })
      .catch(() => {});
  }, [userName]);

  const fetchRecentIds = useCallback(() => {
    setLoadingRecent(true);
    return fetch(`/api/spins/recent-ids?days=${RECENT_EXCLUSION_DAYS}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch recent spin ids');
        return r.json();
      })
      .then((data) => {
        setRecentExcludedIds(Array.isArray(data?.restaurant_ids) ? data.restaurant_ids : []);
      })
      .catch(() => {
        setRecentExcludedIds([]);
      })
      .finally(() => setLoadingRecent(false));
  }, []);

  const fetchRestaurants = useCallback(() => {
    setLoadingRest(true);
    return fetch('/api/restaurants')
      .then((r) => r.json())
      .then((data) => {
        const active = Array.isArray(data) ? data.filter((r) => r.active) : [];
        setAllRestaurants(active);
      })
      .catch(() => {
        setAllRestaurants([]);
      })
      .finally(() => setLoadingRest(false));
  }, []);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  useEffect(() => {
    if (!excludeRecent) {
      setLoadingRecent(false);
      return;
    }
    fetchRecentIds();
  }, [excludeRecent, fetchRecentIds]);

  useEffect(() => {
    fetchSpinInfo();
  }, [fetchSpinInfo]);

  const availableRestaurants = useMemo(
    () => allRestaurants.filter((r) => !tempDisabled.has(r.id)),
    [allRestaurants, tempDisabled]
  );

  const recentExcludedIdSet = useMemo(
    () => new Set(recentExcludedIds),
    [recentExcludedIds]
  );

  const eligibleRestaurants = useMemo(() => {
    if (!excludeRecent) return availableRestaurants;
    return availableRestaurants.filter((r) => !recentExcludedIdSet.has(r.id));
  }, [availableRestaurants, excludeRecent, recentExcludedIdSet]);

  const wheelReady = !loadingRest && (!excludeRecent || !loadingRecent);

  useEffect(() => {
    if (!wheelReady || spinInProgress.current) return;

    if (eligibleRestaurants.length < 2) {
      setWheelRestaurants([]);
      return;
    }

    setWheelRestaurants(buildWheelPool(eligibleRestaurants));
  }, [wheelReady, eligibleRestaurants]);

  const atLimit = spinInfo && !spinInfo.unlimited && spinInfo.remaining <= 0;
  const allExcludedByRecent = wheelReady
    && excludeRecent
    && availableRestaurants.length > 0
    && eligibleRestaurants.length === 0
    && recentExcludedIds.length > 0;
  const tooFew = wheelReady && eligibleRestaurants.length < 2 && !allExcludedByRecent;

  async function doSpin(isVeto = false, vetoSpinId = null) {
    if (spinInProgress.current) return;
    spinInProgress.current = true;

    setError('');
    setResult(null);
    pendingResultRef.current = null;
    setWinnerIndex(null);
    setSpinning(false);
    if (isVeto) setVetoing(true);

    if (!isVeto && userName) {
      try {
        const checkRes = await fetch(`/api/spins/remaining?user_name=${encodeURIComponent(userName)}`);
        if (checkRes.ok) {
          const freshInfo = await checkRes.json();
          if (freshInfo && typeof freshInfo.remaining === 'number') {
            setSpinInfo(freshInfo);
            if (!freshInfo.unlimited && freshInfo.remaining <= 0) {
              setError('You have reached your spin limit. Please wait for it to reset.');
              spinInProgress.current = false;
              return;
            }
          }
        }
      } catch (_) {}
    }

    if (!wheelReady) {
      spinInProgress.current = false;
      setVetoing(false);
      return;
    }

    const available = eligibleRestaurants;
    if (available.length < 2) {
      setError(
        allExcludedByRecent
          ? ALL_EXCLUDED_MESSAGE
          : 'You need at least 2 active restaurants to spin!'
      );
      spinInProgress.current = false;
      setVetoing(false);
      return;
    }

    const pool = buildWheelPool(available);
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
      await minSpinPromise;

      if (!res.ok) {
        if (res.status === 422) {
          await fetchRecentIds();
        }
        setError(data.error || 'Something went wrong.');
        setSpinning(false);
        setVetoing(false);
        spinInProgress.current = false;
        fetchSpinInfo();
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
    fetchSpinInfo();
    fetchRecentIds();
    if (onSpin) onSpin();
  }

  function handleVeto() {
    if (!result?.spin?.id) return;
    doSpin(true, result.spin.id);
  }

  return (
    <div className="spin-page">
      <div className="spin-hero">
        {!wheelReady || wheelRestaurants.length < 2 ? (
          <div className="roulette-loading">
            {!wheelReady ? 'Loading wheel…' : ''}
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
          {spinInfo && !spinInfo.unlimited && (
            <div className="spin-limit-info">
              {atLimit ? (
                <span className="spin-limit-reached">
                  🚫 Spin limit reached ({spinInfo.limit}/{spinInfo.limit})
                  {spinInfo.resetTime && (
                    <span className="reset-timer"> — resets in {formatTimeRemaining(spinInfo.resetTime)}</span>
                  )}
                </span>
              ) : (
                <span className="spin-limit-remaining">
                  🎰 {spinInfo.remaining} of {spinInfo.limit} spins remaining
                </span>
              )}
            </div>
          )}

          {allExcludedByRecent ? (
            <p className="roulette-min-notice">
              ⚠️ {ALL_EXCLUDED_MESSAGE}
            </p>
          ) : tooFew ? (
            <p className="roulette-min-notice">
              🍽️ Add at least 2 restaurants to spin the wheel!
            </p>
          ) : (
            <button
              className="btn btn-spin"
              onClick={() => doSpin(false)}
              disabled={spinning || vetoing || tooFew || atLimit || !wheelReady || allExcludedByRecent}
            >
              {spinning && !vetoing
                ? '🎡 Spinning…'
                : vetoing
                ? '🔄 Re-spinning…'
                : atLimit
                ? '🚫 Limit Reached'
                : '🎡 Spin the Wheel!'}
            </button>
          )}

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={excludeRecent}
              onChange={(e) => setExcludeRecent(e.target.checked)}
              disabled={spinning}
            />
            <span>Skip recently visited (7 days)</span>
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
            disabled={vetoing || spinning || tooFew || allExcludedByRecent || !wheelReady}
          >
            {vetoing ? '🔄 Re-spinning…' : '🚫 Veto — Re-spin!'}
          </button>
        </div>
      )}
    </div>
  );
}
