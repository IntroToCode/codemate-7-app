/**
 * Pure, independently-testable spin selection algorithm.
 *
 * @param {Array}   restaurants   - All restaurant objects (must have `id` and `active` fields).
 * @param {Array}   recentSpins   - Ordered spin records, newest-first (must have `restaurant_id` field).
 * @param {boolean} excludeRecent - Whether to exclude restaurants from the last 5 spins.
 * @returns {Object|null}         - The selected restaurant, or null if no eligible restaurants.
 */
function selectRestaurant(restaurants, recentSpins, excludeRecent = true) {
  const activeRestaurants = restaurants.filter((r) => r.active);

  if (activeRestaurants.length === 0) return null;

  let eligible = activeRestaurants;

  if (excludeRecent && recentSpins.length > 0) {
    const lastFiveIds = new Set(
      recentSpins.slice(0, 5).map((s) => s.restaurant_id)
    );
    const filtered = activeRestaurants.filter((r) => !lastFiveIds.has(r.id));
    eligible = filtered.length > 0 ? filtered : activeRestaurants;
  }

  const index = Math.floor(Math.random() * eligible.length);
  return eligible[index];
}

module.exports = { selectRestaurant };
