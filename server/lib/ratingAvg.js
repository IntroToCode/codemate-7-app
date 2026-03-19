/**
 * Calculate average rating from an array of rating objects.
 *
 * @param {Array} ratings - Array of objects with a `score` field (number 1-5).
 * @returns {number|null}  - Average rounded to 1 decimal, or null if no ratings.
 */
function calcAverageRating(ratings) {
  if (!Array.isArray(ratings) || ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r.score, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

module.exports = { calcAverageRating };
