import {
  WHEEL_R,
  BALL_ORBIT_R,
  OUTER_RING_R,
  HUB_R,
  SVG_SIZE,
  CASINO_COLORS,
  buildSegPath,
  clamp,
  shuffleArray,
  priceLabel,
  computeStopAngles,
} from '../components/rouletteUtils.jsx';

describe('rouletteUtils constants', () => {
  test('WHEEL_R is a positive number', () => {
    expect(WHEEL_R).toBeGreaterThan(0);
  });

  test('BALL_ORBIT_R is larger than WHEEL_R (ball orbits outside wheel)', () => {
    expect(BALL_ORBIT_R).toBeGreaterThan(WHEEL_R);
  });

  test('OUTER_RING_R is larger than BALL_ORBIT_R', () => {
    expect(OUTER_RING_R).toBeGreaterThan(BALL_ORBIT_R);
  });

  test('HUB_R is smaller than WHEEL_R', () => {
    expect(HUB_R).toBeLessThan(WHEEL_R);
  });

  test('SVG_SIZE is positive', () => {
    expect(SVG_SIZE).toBeGreaterThan(0);
  });

  test('CASINO_COLORS has 8 entries', () => {
    expect(CASINO_COLORS).toHaveLength(8);
  });
});

describe('buildSegPath', () => {
  test('returns a valid SVG path string starting with M', () => {
    const path = buildSegPath(0, 4);
    expect(path).toMatch(/^M 0 0 L/);
    expect(path).toMatch(/Z$/);
  });

  test('generates different paths for different segment indices', () => {
    const p0 = buildSegPath(0, 4);
    const p1 = buildSegPath(1, 4);
    expect(p0).not.toBe(p1);
  });

  test('uses large-arc flag when n is 1 (full circle)', () => {
    const path = buildSegPath(0, 1);
    expect(path).toContain(' 1 1 ');
  });

  test('uses small-arc flag when n >= 3', () => {
    const path = buildSegPath(0, 4);
    expect(path).toContain(' 0 1 ');
  });

  test('contains WHEEL_R in the arc command', () => {
    const path = buildSegPath(0, 4);
    expect(path).toContain(`${WHEEL_R} ${WHEEL_R}`);
  });
});

describe('clamp', () => {
  test('returns original string when shorter than max', () => {
    expect(clamp('Pizza', 10)).toBe('Pizza');
  });

  test('returns original string when exactly at max', () => {
    expect(clamp('Hello', 5)).toBe('Hello');
  });

  test('truncates and adds ellipsis when string exceeds max', () => {
    const result = clamp('Really Long Restaurant Name', 10);
    expect(result).toHaveLength(10);
    expect(result).toMatch(/…$/);
  });

  test('handles empty string', () => {
    expect(clamp('', 5)).toBe('');
  });

  test('handles max of 1', () => {
    expect(clamp('abc', 1)).toBe('…');
  });
});

describe('shuffleArray', () => {
  test('returns array with same length', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleArray(arr)).toHaveLength(5);
  });

  test('contains all original elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('does not mutate original array', () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(copy);
  });

  test('returns a new array reference', () => {
    const arr = [1, 2, 3];
    expect(shuffleArray(arr)).not.toBe(arr);
  });

  test('handles empty array', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  test('handles single element', () => {
    expect(shuffleArray([42])).toEqual([42]);
  });

  test('produces different orderings over many calls', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const results = new Set();
    for (let i = 0; i < 50; i++) {
      results.add(JSON.stringify(shuffleArray(arr)));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('priceLabel', () => {
  test('returns ? for falsy values', () => {
    expect(priceLabel(0)).toBe('?');
    expect(priceLabel(null)).toBe('?');
    expect(priceLabel(undefined)).toBe('?');
  });

  test('returns correct number of $ signs', () => {
    expect(priceLabel(1)).toBe('$');
    expect(priceLabel(2)).toBe('$$');
    expect(priceLabel(3)).toBe('$$$');
    expect(priceLabel(4)).toBe('$$$$');
  });
});

describe('computeStopAngles', () => {
  const sa = (2 * Math.PI) / 4;

  test('returns ballTravel and wheelTravel as numbers', () => {
    const result = computeStopAngles(-Math.PI / 2, 0, 0, sa);
    expect(typeof result.ballTravel).toBe('number');
    expect(typeof result.wheelTravel).toBe('number');
  });

  test('ballTravel is positive (ball continues forward)', () => {
    const result = computeStopAngles(5, -2, 1, sa);
    expect(result.ballTravel).toBeGreaterThan(0);
  });

  test('wheelTravel is negative (wheel continues counter-clockwise)', () => {
    const result = computeStopAngles(5, -2, 1, sa);
    expect(result.wheelTravel).toBeLessThan(0);
  });

  test('ball travels at least 3 full rotations', () => {
    const result = computeStopAngles(3, -1, 2, sa);
    expect(result.ballTravel).toBeGreaterThanOrEqual(3 * 2 * Math.PI);
  });

  test('wheel travels at least 1 extra full rotation', () => {
    const result = computeStopAngles(3, -1, 2, sa);
    expect(Math.abs(result.wheelTravel)).toBeGreaterThanOrEqual(1 * 2 * Math.PI);
  });

  test('ball final angle ends at the top (-PI/2 mod 2PI)', () => {
    const ballStart = 10;
    const result = computeStopAngles(ballStart, -3, 0, sa);
    const finalAngle = ballStart + result.ballTravel;
    const normalized = ((finalAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const topNorm = ((-Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI));
    expect(normalized).toBeCloseTo(topNorm, 5);
  });

  test('wheel final rotation aligns winner with top', () => {
    const winnerIndex = 2;
    const wheelStart = -5;
    const result = computeStopAngles(8, wheelStart, winnerIndex, sa);
    const finalWheelAngle = wheelStart + result.wheelTravel;
    const expectedTarget = -((winnerIndex + 0.5) * sa);
    const diff = ((finalWheelAngle - expectedTarget) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    expect(diff).toBeCloseTo(0, 5);
  });

  test('works for all winner indices 0-7', () => {
    const n = 8;
    const segAngle = (2 * Math.PI) / n;
    for (let wi = 0; wi < n; wi++) {
      const result = computeStopAngles(12, -4, wi, segAngle);
      expect(result.ballTravel).toBeGreaterThan(0);
      expect(result.wheelTravel).toBeLessThan(0);
    }
  });
});
