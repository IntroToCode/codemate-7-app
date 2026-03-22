import { useState, useRef, useEffect } from 'react';

const ZIP_STORAGE_KEY = 'lr_search_zipcode';
const HIDE_DUPES_STORAGE_KEY = 'lr_hide_duplicates';

function getSavedZip() {
  return localStorage.getItem(ZIP_STORAGE_KEY) || '';
}

function saveZip(zip) {
  if (zip) {
    localStorage.setItem(ZIP_STORAGE_KEY, zip);
  } else {
    localStorage.removeItem(ZIP_STORAGE_KEY);
  }
}

function getSavedHideDupes() {
  return localStorage.getItem(HIDE_DUPES_STORAGE_KEY) === 'true';
}

function saveHideDupes(val) {
  localStorage.setItem(HIDE_DUPES_STORAGE_KEY, String(val));
}

function priceLabel(n) {
  return n ? '$'.repeat(n) : '—';
}

export default function RestaurantSearch({ onSelect, onClose }) {
  const savedZip = getSavedZip();
  const [step, setStep] = useState(savedZip ? 'results' : 'zip');
  const [zipCode, setZipCode] = useState(savedZip);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hideDuplicates, setHideDuplicates] = useState(getSavedHideDupes());
  const [nextPageToken, setNextPageToken] = useState(null);
  const [pageHistory, setPageHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (savedZip && step === 'results') {
      searchPlaces(savedZip, '', null, hideDuplicates);
    }
  }, []);

  async function searchPlaces(zip, kw, pageToken, hideDupes) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ zip });
      if (kw && kw.trim()) params.set('keyword', kw.trim());
      if (pageToken) params.set('page_token', pageToken);
      if (hideDupes) params.set('hide_duplicates', 'true');
      const res = await fetch(`/api/restaurants/search?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Search failed');
        setResults([]);
        return;
      }
      setResults(data.results || []);
      setNextPageToken(data.nextPageToken || null);
    } catch {
      setError('Failed to search restaurants. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleZipSubmit(e) {
    e.preventDefault();
    const zip = zipCode.trim();
    if (!/^\d{5}$/.test(zip)) {
      setError('Please enter a valid 5-digit zip code.');
      return;
    }
    saveZip(zip);
    setStep('results');
    setPageHistory([]);
    setCurrentPage(0);
    searchPlaces(zip, '', null, hideDuplicates);
  }

  function handleKeywordChange(e) {
    const value = e.target.value;
    setKeyword(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPageHistory([]);
      setCurrentPage(0);
      searchPlaces(zipCode.trim(), value, null, hideDuplicates);
    }, 500);
  }

  function handleNextPage() {
    if (!nextPageToken) return;
    setPageHistory((prev) => [...prev, { results, nextPageToken }]);
    setCurrentPage((p) => p + 1);
    searchPlaces(zipCode.trim(), keyword, nextPageToken, hideDuplicates);
  }

  function handlePrevPage() {
    if (pageHistory.length === 0) return;
    const prev = [...pageHistory];
    const lastPage = prev.pop();
    setPageHistory(prev);
    setCurrentPage((p) => p - 1);
    setResults(lastPage.results);
    setNextPageToken(lastPage.nextPageToken);
  }

  function handleToggleHideDuplicates() {
    const newVal = !hideDuplicates;
    setHideDuplicates(newVal);
    saveHideDupes(newVal);
    setPageHistory([]);
    setCurrentPage(0);
    searchPlaces(zipCode.trim(), keyword, null, newVal);
  }

  function handleChangeZip() {
    setStep('zip');
    setResults([]);
    setKeyword('');
    setError('');
    setPageHistory([]);
    setCurrentPage(0);
    setNextPageToken(null);
  }

  function handleClearZip() {
    saveZip('');
    setZipCode('');
    handleChangeZip();
  }

  function handleSelect(place) {
    if (place.already_added) return;
    onSelect({
      name: place.name,
      cuisine: place.cuisine,
      price_range: place.price_range,
      address: place.address,
      google_place_id: place.place_id,
    });
  }

  return (
    <div className="restaurant-search card">
      <div className="search-header">
        <h3>Find a Restaurant</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>

      {step === 'zip' && (
        <form className="zip-form" onSubmit={handleZipSubmit}>
          <p className="search-hint">Enter a zip code to search for nearby restaurants.</p>
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Zip code (e.g. 10001)"
              value={zipCode}
              onChange={(e) => {
                setZipCode(e.target.value);
                setError('');
              }}
              maxLength={5}
              pattern="\d{5}"
              required
              autoFocus
            />
            <button className="btn btn-primary" type="submit">Search</button>
          </div>
          {error && <p className="search-error">{error}</p>}
        </form>
      )}

      {step === 'results' && (
        <div className="search-results-container">
          <div className="search-controls">
            <span className="zip-badge">📍 {zipCode}</span>
            <input
              className="form-input"
              placeholder="Filter by keyword (e.g. sushi, italian)"
              value={keyword}
              onChange={handleKeywordChange}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleChangeZip}
            >
              Change zip
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClearZip}
              title="Clear saved zip code"
            >
              Clear zip
            </button>
          </div>

          <div className="search-filter-row">
            <label className="hide-dupes-toggle">
              <input
                type="checkbox"
                checked={hideDuplicates}
                onChange={handleToggleHideDuplicates}
              />
              Hide already added
            </label>
          </div>

          {error && <p className="search-error">{error}</p>}

          {loading && <p className="search-loading">Searching nearby restaurants...</p>}

          {!loading && results.length === 0 && !error && (
            <p className="search-empty">No restaurants found. Try a different keyword or zip code.</p>
          )}

          <div className="search-results-list">
            {results.map((place) => (
              <div
                key={place.place_id}
                className={`search-result-item ${place.already_added ? 'already-added' : ''}`}
                onClick={() => handleSelect(place)}
                role="button"
                tabIndex={place.already_added ? -1 : 0}
              >
                <div className="result-info">
                  <span className="result-name">{place.name}</span>
                  {place.already_added && <span className="duplicate-label">(already in list)</span>}
                  <span className="result-meta">
                    {place.cuisine && <span className="meta-chip">{place.cuisine}</span>}
                    {place.price_range && <span className="meta-chip">{priceLabel(place.price_range)}</span>}
                    {place.rating && <span className="meta-chip">⭐ {place.rating}</span>}
                  </span>
                  {place.address && <span className="result-address">📍 {place.address}</span>}
                </div>
                {!place.already_added && <span className="result-add-icon">＋</span>}
              </div>
            ))}
          </div>

          {!loading && results.length > 0 && (
            <div className="search-pagination">
              <button
                className="btn btn-ghost btn-sm"
                onClick={handlePrevPage}
                disabled={currentPage === 0}
              >
                ← Previous
              </button>
              <span className="page-indicator">Page {currentPage + 1}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleNextPage}
                disabled={!nextPageToken}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
