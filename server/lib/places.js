const GOOGLE_PLACES_API_KEY = process.env.google_place_api_key;

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const NEARBY_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

const PAGE_SIZE = 20;
const PAGINATION_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 2000;

function validateZipCode(zip) {
  if (!zip || typeof zip !== 'string') return false;
  return /^\d{5}$/.test(zip.trim());
}

function buildGeocodingUrl(zipCode) {
  const params = new URLSearchParams({
    address: zipCode.trim(),
    key: GOOGLE_PLACES_API_KEY,
  });
  return `${GEOCODE_URL}?${params}`;
}

function buildNearbySearchUrl(lat, lng, keyword, pageToken) {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: '8000',
    type: 'restaurant',
    key: GOOGLE_PLACES_API_KEY,
  });
  if (keyword && keyword.trim()) {
    params.set('keyword', keyword.trim());
  }
  if (pageToken) {
    params.set('pagetoken', pageToken);
  }
  return `${NEARBY_SEARCH_URL}?${params}`;
}

function mapPriceLevel(priceLevel) {
  if (priceLevel === undefined || priceLevel === null) return null;
  const mapped = Math.max(1, Math.min(4, priceLevel));
  return mapped || null;
}

function formatPlaceResult(place) {
  return {
    place_id: place.place_id,
    name: place.name,
    address: place.vicinity || '',
    cuisine: (place.types || [])
      .filter((t) => !['restaurant', 'food', 'point_of_interest', 'establishment'].includes(t))
      .map((t) => t.replace(/_/g, ' '))
      .slice(0, 1)
      .join(', ') || '',
    price_range: mapPriceLevel(place.price_level),
    rating: place.rating || null,
  };
}

async function geocodeZipCode(zipCode) {
  const url = buildGeocodingUrl(zipCode);
  const response = await fetch(url);
  const data = await response.json();
  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    return null;
  }
  const location = data.results[0].geometry.location;
  return { lat: location.lat, lng: location.lng };
}

async function searchNearbyRestaurants(lat, lng, keyword, pageToken) {
  const url = buildNearbySearchUrl(lat, lng, keyword, pageToken);
  const response = await fetch(url);
  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${data.status}`);
  }
  return {
    results: (data.results || []).map(formatPlaceResult),
    nextPageToken: data.next_page_token || null,
  };
}

async function searchByZipCode(zipCode, keyword, pageToken) {
  if (!validateZipCode(zipCode)) {
    throw new Error('Invalid zip code. Please enter a 5-digit US zip code.');
  }

  if (pageToken) {
    return searchNearbyRestaurants(0, 0, keyword, pageToken);
  }

  const coords = await geocodeZipCode(zipCode);
  if (!coords) {
    throw new Error('Could not find location for the given zip code.');
  }
  return searchNearbyRestaurants(coords.lat, coords.lng, keyword);
}

async function searchWithSmartFill(zipCode, keyword, pageToken, existingRestaurants, hideDuplicates) {
  const { flagDuplicates } = require('./duplicates');

  if (!hideDuplicates) {
    const result = await searchByZipCode(zipCode, keyword, pageToken);
    const flagged = flagDuplicates(result.results, existingRestaurants);
    return {
      results: flagged,
      nextPageToken: result.nextPageToken,
    };
  }

  let collected = [];
  let currentToken = pageToken;
  let lastNextToken = null;
  const MAX_GOOGLE_PAGES = 3;
  let pagesConsumed = 0;

  while (pagesConsumed < MAX_GOOGLE_PAGES) {
    const result = await searchByZipCode(zipCode, keyword, currentToken);
    pagesConsumed++;

    const flagged = flagDuplicates(result.results, existingRestaurants);
    const nonDupes = flagged.filter((p) => !p.already_added);
    collected = collected.concat(nonDupes);

    lastNextToken = result.nextPageToken;

    if (collected.length >= PAGE_SIZE || !result.nextPageToken) {
      break;
    }

    currentToken = result.nextPageToken;

    await new Promise((resolve) => setTimeout(resolve, PAGINATION_DELAY_MS));
  }

  const page = collected.slice(0, PAGE_SIZE);
  const hasMore = collected.length > PAGE_SIZE || !!lastNextToken;

  return {
    results: page,
    nextPageToken: hasMore ? lastNextToken : null,
    _overflow: collected.slice(PAGE_SIZE),
  };
}

module.exports = {
  validateZipCode,
  buildGeocodingUrl,
  buildNearbySearchUrl,
  mapPriceLevel,
  formatPlaceResult,
  geocodeZipCode,
  searchNearbyRestaurants,
  searchByZipCode,
  searchWithSmartFill,
  PAGE_SIZE,
};
