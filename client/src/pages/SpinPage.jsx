import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useTempDisable } from '../context/TempDisableContext';
import RouletteWheel from '../components/RouletteWheel';

import { shuffleArray, priceLabel, filterRestaurants } from '../components/rouletteUtils.jsx';

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
  const [wheelBusy, setWheelBusy] = useState(false);
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
  const [cuisineFilter, setCuisineFilter] = useState('');
  const [priceFilter, setPriceFilter] = useState(null);

  const [spinInfo, setSpinInfo] = useState(null);

  const wheelReady = !loadingRest && (!excludeRecent || !loadingRecent);

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

  const cuisineOptions = useMemo(() => [...new Set(
    allRestaurants.map((r) => r.cuisine).filter(Boolean)
  )].sort(), [allRestaurants]);

  const recentExcludedIdSet = useMemo(
    () => new Set(recentExcludedIds),
    [recentExcludedIds]
  );

  const filteredRestaurants = useMemo(
    () => filterRestaurants(allRestaurants, cuisineFilter, priceFilter),
    [allRestaurants, cuisineFilter, priceFilter]
  );

  const baseWheelRestaurants = useMemo(
    () => filteredRestaurants.filter((r) => !tempDisabled.has(r.id)),
    [filteredRestaurants, tempDisabled]
  );

  const eligibleRestaurants = useMemo(() => {
    if (!excludeRecent) return baseWheelRestaurants;
    return baseWheelRestaurants.filter((r) => !recentExcludedIdSet.has(r.id));
  }, [baseWheelRestaurants, excludeRecent, recentExcludedIdSet]);

  function clearFilters() {
    setCuisineFilter('');
    setPriceFilter(null);
  }

  async function doSpin(isVeto = false, vetoSpinId = null) {
    if (spinInProgress.current) return;
    spinInProgress.current = true;

    setError('');
    setWheelBusy(true);
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
              setWheelBusy(false);
              spinInProgress.current = false;
              return;
            }
          }
        }
      } catch (_) {}
    }

    if (!wheelReady) {
      setWheelBusy(false);
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
      setWheelBusy(false);
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
    const baseWheelIdSet = new Set(baseWheelRestaurants.map((r) => r.id));
    const constrainedOutIds = allRestaurants
      .filter((r) => !baseWheelIdSet.has(r.id))
      .map((r) => r.id);
    const extraSkips = available.filter((r) => !poolIdSet.has(r.id)).map((r) => r.id);
    const skipIds = [...new Set([...constrainedOutIds, ...extraSkips])];

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
        setWheelBusy(false);
        setSpinning(false);
        setVetoing(false);
        spinInProgress.current = false;
        fetchSpinInfo();
        return;
      }

      const idx = pool.findIndex((r) => r.id === data.restaurant.id);
      if (idx < 0) {
        setError(`"${data.restaurant.name}" was picked but is not on the wheel. Please spin again.`);
        setWheelBusy(false);
        setSpinning(false);
        setVetoing(false);
        spinInProgress.current = false;
        return;
      }

      pendingResultRef.current = data;
      setWinnerIndex(idx);
    } catch {
      setError('Network error. Please try again.');
      setWheelBusy(false);
      setSpinning(false);
      setVetoing(false);
      spinInProgress.current = false;
    }
  }

  function handleSpinComplete() {
    setWheelBusy(false);
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

  const filtersActive = cuisineFilter !== '' || priceFilter !== null;
  const noMatch = !loadingRest && filtersActive && baseWheelRestaurants.length === 0;
  const allExcludedByRecent =
    wheelReady &&
    excludeRecent &&
    baseWheelRestaurants.length >= 2 &&
    eligibleRestaurants.length === 0;
  const tooFew =
    wheelReady &&
    !noMatch &&
    !allExcludedByRecent &&
    eligibleRestaurants.length < 2;
  const atLimit = spinInfo ? !spinInfo.unlimited && spinInfo.remaining <= 0 : false;
  const hasParkedResult = !!result && !wheelBusy && !spinning && !vetoing;
  const wheelDisabled = !hasParkedResult && (tooFew || allExcludedByRecent);
  const controlsLocked = wheelBusy || hasParkedResult;
  const showPoolWarning = !hasParkedResult && (allExcludedByRecent || tooFew);
  const showSpinButton = !noMatch && (!showPoolWarning || hasParkedResult);

  useEffect(() => {
    if (!wheelReady || spinInProgress.current || spinning || vetoing || hasParkedResult) return;

    if (eligibleRestaurants.length === 0) {
      setWheelRestaurants([]);
      return;
    }

    if (eligibleRestaurants.length === 1) {
      setWheelRestaurants(eligibleRestaurants);
      return;
    }

    setWheelRestaurants(buildWheelPool(eligibleRestaurants));
  }, [wheelReady, eligibleRestaurants, spinning, vetoing, hasParkedResult]);

  return (
    <div className="spin-page">
      <div className="spin-hero">
        {!wheelReady || wheelRestaurants.length === 0 ? (
          <div className="roulette-loading">
            {!wheelReady ? 'Loading wheel…' : ''}
          </div>
        ) : (
          <RouletteWheel
            restaurants={wheelRestaurants}
            disabled={wheelDisabled}
            busy={wheelBusy}
            spinning={spinning}
            winnerIndex={winnerIndex}
            onSpinComplete={handleSpinComplete}
          />
        )}

        <div className="spin-controls">
          {!loadingRest && allRestaurants.length >= 2 && (
            <div className="spin-filters">
              <div className="spin-filter-row">
                <label className="spin-filter-label" htmlFor="cuisine-select">Cuisine</label>
                <select
                  id="cuisine-select"
                  className="spin-filter-select"
                  value={cuisineFilter}
                  onChange={(e) => setCuisineFilter(e.target.value)}
                  disabled={controlsLocked}
                >
                  <option value="">All cuisines</option>
                  {cuisineOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="spin-filter-row">
                <label className="spin-filter-label">Price</label>
                <div className="spin-price-btns">
                  {[null, 1, 2, 3].map((p) => (
                    <button
                      key={p ?? 'all'}
                      type="button"
                      className={`spin-price-btn${priceFilter === p ? ' active' : ''}`}
                      onClick={() => setPriceFilter(p)}
                      disabled={controlsLocked}
                      aria-pressed={priceFilter === p}
                    >
                      {p === null ? 'All' : priceLabel(p)}
                    </button>
                  ))}
                </div>
              </div>

              {filtersActive && (
                <button
                  type="button"
                  className="spin-filter-clear"
                  onClick={clearFilters}
                  disabled={controlsLocked}
                >
                  ✕ Clear filters
                </button>
              )}

              {hasParkedResult && (
                <p className="spin-parked-note">Start another spin to update filters or refresh the wheel pool.</p>
              )}
            </div>
          )}

          {noMatch ? (
            <p className="spin-no-match">
              😕 No restaurants match your filters!
            </p>
          ) : showPoolWarning && allExcludedByRecent ? (
            <p className="roulette-min-notice">
              ⚠️ {ALL_EXCLUDED_MESSAGE}
            </p>
          ) : showPoolWarning && tooFew ? (
            <p className="roulette-min-notice">
              🍽️ Add at least 2 restaurants to spin the wheel!
            </p>
          ) : showSpinButton ? (
            <button
              type="button"
              className="btn btn-spin"
              onClick={() => doSpin(false)}
              disabled={wheelBusy || atLimit || !wheelReady}
            >
              {wheelBusy && !vetoing
                ? '🎡 Spinning…'
                : vetoing
                ? '🔄 Re-spinning…'
                : atLimit
                ? '🚫 Limit Reached'
                : hasParkedResult
                ? '🎡 Spin Again!'
                : '🎡 Spin the Wheel!'}
            </button>
          ) : null}

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={excludeRecent}
              onChange={(e) => setExcludeRecent(e.target.checked)}
              disabled={controlsLocked}
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

      {hasParkedResult && result && (
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
            type="button"
            className="btn btn-veto"
            onClick={handleVeto}
            disabled={wheelBusy || !wheelReady}
          >
            {vetoing ? '🔄 Re-spinning…' : '🚫 Veto — Re-spin!'}
          </button>
        </div>
      )}
    </div>
  );
}
