function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isDuplicate(place, existingRestaurants) {
  return existingRestaurants.some((r) => {
    if (r.google_place_id && place.place_id) {
      return r.google_place_id === place.place_id;
    }
    const nameMatch = normalizeString(r.name) === normalizeString(place.name);
    const addressMatch = normalizeString(r.address) === normalizeString(place.address);
    return nameMatch && addressMatch;
  });
}

function flagDuplicates(places, existingRestaurants) {
  return places.map((place) => ({
    ...place,
    already_added: isDuplicate(place, existingRestaurants),
  }));
}

module.exports = { normalizeString, isDuplicate, flagDuplicates };
