const WHEEL_R = 168;
const BALL_ORBIT_R = 190;
const OUTER_RING_R = 207;
const HUB_R = 28;
const SVG_SIZE = 218;

const CASINO_COLORS = [
  '#b71c1c',
  '#1a1a2e',
  '#1b5e20',
  '#4a148c',
  '#bf360c',
  '#0d47a1',
  '#b71c1c',
  '#1a1a2e',
];

function buildSegPath(i, n) {
  const sa = (2 * Math.PI) / n;
  const a0 = -Math.PI / 2 + i * sa;
  const a1 = a0 + sa;
  const x1 = (WHEEL_R * Math.cos(a0)).toFixed(3);
  const y1 = (WHEEL_R * Math.sin(a0)).toFixed(3);
  const x2 = (WHEEL_R * Math.cos(a1)).toFixed(3);
  const y2 = (WHEEL_R * Math.sin(a1)).toFixed(3);
  return `M 0 0 L ${x1} ${y1} A ${WHEEL_R} ${WHEEL_R} 0 ${sa > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`;
}

function clamp(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function priceLabel(n) {
  return n ? '$'.repeat(n) : '—';
}

function computeStopAngles(ballAngleCurrent, wheelAngleCurrent, winnerIndex, segmentAngle, ballSpeed, wheelSpeed, duration) {
  const TWO_PI = 2 * Math.PI;
  const idealBallTravel = ballSpeed * duration / 3;
  const idealWheelMag = wheelSpeed * duration / 3;

  const ballTopNorm = ((-Math.PI / 2 + TWO_PI) % TWO_PI);
  const curBallNorm = ((ballAngleCurrent % TWO_PI) + TWO_PI) % TWO_PI;
  let ballDelta = (ballTopNorm - curBallNorm + TWO_PI) % TWO_PI;
  if (ballDelta < 0.3) ballDelta += TWO_PI;
  let ballTravel = ballDelta;
  while (ballTravel + TWO_PI <= idealBallTravel) ballTravel += TWO_PI;
  if (ballTravel < TWO_PI) ballTravel += TWO_PI;

  const wheelFinal = -((winnerIndex + 0.5) * segmentAngle);
  let wheelFinalActual = wheelFinal + Math.floor((wheelAngleCurrent - wheelFinal) / TWO_PI) * TWO_PI;
  if (wheelFinalActual >= wheelAngleCurrent) wheelFinalActual -= TWO_PI;
  let wheelTravel = wheelFinalActual - wheelAngleCurrent;
  while (wheelTravel - TWO_PI >= -idealWheelMag) wheelTravel -= TWO_PI;

  return { ballTravel, wheelTravel };
}

export {
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
};
