/**
 * Pure, independently-testable spin selection algorithm.
 *
 * @param {Array}   restaurants       - All restaurant objects (must have `id` and `active` fields).
 * @param {Array}   recentSpinIds     - Array of restaurant_id values to exclude (already filtered by caller).
 * @param {boolean} excludeRecent     - Whether to exclude the provided recent restaurant IDs.
 * @param {Array}   skipIds           - IDs of restaurants temporarily disabled for this spin only.
 * @param {Object}  lastVisitMap      - Map of restaurant_id → Date of last non-vetoed visit (optional).
 * @returns {Object|null}             - The selected restaurant, or null if no eligible restaurants.
 */
function selectRestaurant(restaurants, recentSpinIds, excludeRecent = true, skipIds = [], lastVisitMap = {}) {
  const skipSet = new Set(Array.isArray(skipIds) ? skipIds : []);

  const activeRestaurants = restaurants.filter((r) => r.active && !skipSet.has(r.id));

  if (activeRestaurants.length === 0) {
    const fallback = restaurants.filter((r) => r.active);
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  let eligible = activeRestaurants;

  if (excludeRecent && recentSpinIds.length > 0) {
    const recentSet = new Set(recentSpinIds);
    const filtered = activeRestaurants.filter((r) => !recentSet.has(r.id));

    if (filtered.length > 0) {
      eligible = filtered;
    } else if (Object.keys(lastVisitMap).length > 0) {
      const sorted = [...activeRestaurants].sort((a, b) => {
        const aTime = lastVisitMap[a.id] ? new Date(lastVisitMap[a.id]).getTime() : 0;
        const bTime = lastVisitMap[b.id] ? new Date(lastVisitMap[b.id]).getTime() : 0;
        return aTime - bTime;
      });
      const halfCount = Math.max(1, Math.ceil(sorted.length / 3));
      eligible = sorted.slice(0, halfCount);
    }
  }

  const index = Math.floor(Math.random() * eligible.length);
  return eligible[index];
}

module.exports = { selectRestaurant };
