/**
 * Pure, independently-testable spin selection algorithm.
 *
 * @param {Array}   restaurants   - All restaurant objects (must have `id` and `active` fields).
 * @param {Array}   recentSpins   - Recent spin records supplied by the caller (must have `restaurant_id` field).
 * @param {boolean} excludeRecent - Whether to exclude restaurants found in the supplied recent spins.
 * @param {Array}   skipIds       - IDs of restaurants temporarily disabled for this spin only.
 * @returns {Object|null}         - The selected restaurant, or null if no eligible restaurants.
 */
function selectRestaurant(restaurants, recentSpins, excludeRecent = true, skipIds = []) {
  const skipSet = new Set(Array.isArray(skipIds) ? skipIds : []);

  const activeRestaurants = restaurants.filter((r) => r.active && !skipSet.has(r.id));

  if (activeRestaurants.length === 0) {
    const fallback = restaurants.filter((r) => r.active);
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  let eligible = activeRestaurants;

  if (excludeRecent && recentSpins.length > 0) {
    const recentIds = new Set(recentSpins.map((s) => s.restaurant_id));
    eligible = activeRestaurants.filter((r) => !recentIds.has(r.id));
  }

  if (eligible.length === 0) return null;

  const index = Math.floor(Math.random() * eligible.length);
  return eligible[index];
}

module.exports = { selectRestaurant };
