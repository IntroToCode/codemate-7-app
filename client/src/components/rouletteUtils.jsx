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

function normalizeLabel(name = '') {
  return name.trim().replace(/\s+/g, ' ');
}

function getWheelLabelFontSize(segmentCount) {
  return segmentCount <= 3 ? 13 : segmentCount <= 5 ? 11 : segmentCount <= 7 ? 10 : 9;
}

function estimateLabelTextWidth(text, fontSize) {
  return Array.from(text).reduce((total, char) => total + getCharWidthFactor(char) * fontSize, 0);
}

function getCharWidthFactor(char) {
  if (char === ' ') return 0.33;
  if (".,:;|!ilI'`".includes(char)) return 0.28;
  if ('()[]{}ftjr'.includes(char)) return 0.42;
  if ('mwMW@%#&QO'.includes(char)) return 0.88;
  if (/[A-Z]/.test(char)) return 0.68;
  if (/[0-9]/.test(char)) return 0.56;
  return 0.58;
}

function getLineOffsets(lineCount, lineHeight) {
  return Array.from({ length: lineCount }, (_, index) => (index - (lineCount - 1) / 2) * lineHeight);
}

function getSliceLineMaxWidth(radius, segmentAngle, fontSize) {
  const tangentWidth = 2 * radius * Math.tan(segmentAngle / 2);
  const sideMargin = Math.max(10, fontSize * 0.95);
  return Math.max(fontSize * 2.4, tangentWidth - sideMargin * 2);
}

function ellipsizeToWidth(text, maxWidth, fontSize) {
  const normalized = normalizeLabel(text);
  if (!normalized) return '';
  if (estimateLabelTextWidth(normalized, fontSize) <= maxWidth) return normalized;
  const ellipsis = '\u2026';
  const chars = Array.from(normalized);
  while (chars.length > 0 && estimateLabelTextWidth(chars.join('') + ellipsis, fontSize) > maxWidth) chars.pop();
  return chars.length ? chars.join('').trimEnd() + ellipsis : ellipsis;
}

function findWrappedLines(words, maxWidths, fontSize) {
  const candidates = [];
  function search(startIndex, lineIndex, lines) {
    const remainingLines = maxWidths.length - lineIndex;
    const remainingWords = words.length - startIndex;
    if (remainingWords < remainingLines) return;
    if (lineIndex === maxWidths.length - 1) {
      const lastLine = words.slice(startIndex).join(' ');
      if (estimateLabelTextWidth(lastLine, fontSize) <= maxWidths[lineIndex]) candidates.push([...lines, lastLine]);
      return;
    }
    for (let endIndex = startIndex + 1; endIndex <= words.length - (remainingLines - 1); endIndex++) {
      const line = words.slice(startIndex, endIndex).join(' ');
      if (estimateLabelTextWidth(line, fontSize) > maxWidths[lineIndex]) break;
      search(endIndex, lineIndex + 1, [...lines, line]);
    }
  }
  search(0, 0, []);
  if (!candidates.length) return null;
  return candidates.map((lines) => { const usage = lines.map((line, index) => estimateLabelTextWidth(line, fontSize) / maxWidths[index]); const avg = usage.reduce((sum, value) => sum + value, 0) / usage.length; const variance = usage.reduce((sum, value) => sum + (value - avg) ** 2, 0) / usage.length; const emptyPenalty = usage.reduce((sum, value) => sum + (1 - value) ** 2, 0) / usage.length; return { lines, score: variance + emptyPenalty * 0.35 }; }).sort((a, b) => a.score - b.score)[0].lines;
}

function wrapWordsWithEllipsis(words, maxWidths, fontSize) {
  const lines = [];
  let wordIndex = 0;
  for (let lineIndex = 0; lineIndex < maxWidths.length; lineIndex++) {
    const remainingWords = words.slice(wordIndex);
    if (!remainingWords.length) break;
    if (lineIndex === maxWidths.length - 1) { lines.push(ellipsizeToWidth(remainingWords.join(' '), maxWidths[lineIndex], fontSize)); return lines; }
    let bestLine = '';
    let bestCount = 0;
    for (let count = 1; count <= remainingWords.length; count++) { const candidate = remainingWords.slice(0, count).join(' '); if (estimateLabelTextWidth(candidate, fontSize) <= maxWidths[lineIndex]) { bestLine = candidate; bestCount = count; } else break; }
    if (!bestLine) return null;
    lines.push(bestLine);
    wordIndex += bestCount;
  }
  return wordIndex >= words.length ? lines : null;
}

function getRestaurantLabelLayout(name, segmentCount, fontSize = getWheelLabelFontSize(segmentCount)) {
  const safeSegmentCount = Math.max(2, segmentCount);
  const segmentAngle = (2 * Math.PI) / safeSegmentCount;
  const lineHeight = fontSize * 1.06;
  const innerRadius = HUB_R + Math.max(16, fontSize * 1.65);
  const outerRadius = WHEEL_R - Math.max(14, fontSize * 1.45);
  const anchorRadius = (innerRadius + outerRadius) / 2;
  const maxLines = Math.min(3, Math.max(1, Math.floor((outerRadius - innerRadius) / lineHeight)));
  const normalized = normalizeLabel(name);
  const getMaxWidths = (lineCount) => getLineOffsets(lineCount, lineHeight).map((offset) => { const lineRadius = Math.max(innerRadius, Math.min(outerRadius, anchorRadius + offset)); return getSliceLineMaxWidth(lineRadius, segmentAngle, fontSize); });
  if (!normalized) return { lines: [''], fontSize, lineHeight, anchorRadius, isWrapped: false, isEllipsized: false };
  const singleLineWidths = getMaxWidths(1);
  if (estimateLabelTextWidth(normalized, fontSize) <= singleLineWidths[0]) return { lines: [normalized], fontSize, lineHeight, anchorRadius, isWrapped: false, isEllipsized: false };
  const words = normalized.split(' ');
  if (words.length > 1) {
    for (let lineCount = 2; lineCount <= maxLines; lineCount++) { const fittedLines = findWrappedLines(words, getMaxWidths(lineCount), fontSize); if (fittedLines) return { lines: fittedLines, fontSize, lineHeight, anchorRadius, isWrapped: true, isEllipsized: false }; }
    const fallbackLines = wrapWordsWithEllipsis(words, getMaxWidths(maxLines), fontSize);
    if (fallbackLines) return { lines: fallbackLines, fontSize, lineHeight, anchorRadius, isWrapped: fallbackLines.length > 1, isEllipsized: fallbackLines.some((line) => line.endsWith('\u2026')) };
  }
  const clippedLine = ellipsizeToWidth(normalized, singleLineWidths[0], fontSize);
  return { lines: [clippedLine], fontSize, lineHeight, anchorRadius, isWrapped: false, isEllipsized: clippedLine.endsWith('\u2026') };
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
  estimateLabelTextWidth,
  getRestaurantLabelLayout,
  getWheelLabelFontSize,
  shuffleArray,
  priceLabel,
  computeStopAngles,
};
