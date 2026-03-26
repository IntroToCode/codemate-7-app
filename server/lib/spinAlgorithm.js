function selectRestaurant(restaurants, recentSpinIds, excludeRecent = true, skipIds = []) {
  const skipSet = new Set(Array.isArray(skipIds) ? skipIds : []);

  const activeRestaurants = restaurants.filter((r) => r.active && !skipSet.has(r.id));

  if (activeRestaurants.length === 0) {
    const fallback = restaurants.filter((r) => r.active);
    if (fallback.length === 0) return { selected: null, allExcluded: false };
    return { selected: fallback[Math.floor(Math.random() * fallback.length)], allExcluded: false };
  }

  if (excludeRecent && recentSpinIds.length > 0) {
    const recentSet = new Set(recentSpinIds);
    const filtered = activeRestaurants.filter((r) => !recentSet.has(r.id));

    if (filtered.length > 0) {
      const index = Math.floor(Math.random() * filtered.length);
      return { selected: filtered[index], allExcluded: false };
    }

    return { selected: null, allExcluded: true };
  }

  const index = Math.floor(Math.random() * activeRestaurants.length);
  return { selected: activeRestaurants[index], allExcluded: false };
}

module.exports = { selectRestaurant };
