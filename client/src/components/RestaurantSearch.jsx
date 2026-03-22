import { useState, useRef } from 'react';

function priceLabel(n) {
  return n ? '$'.repeat(n) : '—';
}

export default function RestaurantSearch({ onSelect, onClose }) {
  const [step, setStep] = useState('zip');
  const [zipCode, setZipCode] = useState('');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchTimer = useRef(null);

  async function searchPlaces(zip, kw) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ zip });
      if (kw && kw.trim()) params.set('keyword', kw.trim());
      const res = await fetch(`/api/restaurants/search?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Search failed');
        setResults([]);
        return;
      }
      setResults(data);
    } catch {
      setError('Failed to search restaurants. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleZipSubmit(e) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zipCode.trim())) {
      setError('Please enter a valid 5-digit zip code.');
      return;
    }
    setStep('results');
    searchPlaces(zipCode.trim(), '');
  }

  function handleKeywordChange(e) {
    const value = e.target.value;
    setKeyword(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchPlaces(zipCode.trim(), value);
    }, 500);
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
              onClick={() => {
                setStep('zip');
                setResults([]);
                setKeyword('');
                setError('');
              }}
            >
              Change zip
            </button>
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
        </div>
      )}
    </div>
  );
}
