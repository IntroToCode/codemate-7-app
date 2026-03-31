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
  return segmentCount <= 3 ? 15 : segmentCount <= 5 ? 13 : segmentCount <= 7 ? 12 : 11;
}

function getMinWheelLabelFontSize(segmentCount) {
  return segmentCount <= 1 ? 11 : segmentCount <= 3 ? 12 : segmentCount <= 5 ? 10 : 9;
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
  const effectiveRadius = Math.max(HUB_R + 6, radius - fontSize * 0.92);
  const tangentWidth = 2 * effectiveRadius * Math.tan(segmentAngle / 2);
  const usableOuterRadius = WHEEL_R - Math.max(10, fontSize * 1.1);
  const circleChordWidth = 2 * Math.sqrt(Math.max(0, usableOuterRadius * usableOuterRadius - effectiveRadius * effectiveRadius));
  const sideMargin = Math.max(8, fontSize * 0.72);
  const maxAllowedWidth = Math.min(tangentWidth, circleChordWidth);
  return Math.max(fontSize * 2.2, maxAllowedWidth - sideMargin * 2);
}

function getLabelAnchorRadius(innerRadius, outerRadius, lineHeight, lineCount) {
  const radialBand = Math.max(0, outerRadius - innerRadius);
  const outwardBiasRadius = innerRadius + radialBand * 0.66;
  const lineOffsetExtent = ((lineCount - 1) / 2) * lineHeight;
  const rimBuffer = Math.max(12, lineHeight * 1.35);
  const minAnchorRadius = innerRadius + lineOffsetExtent + Math.max(2, lineHeight * 0.1);
  const maxAnchorRadius = outerRadius - rimBuffer - lineOffsetExtent;
  return Math.max(minAnchorRadius, Math.min(maxAnchorRadius, outwardBiasRadius));
}

function ellipsizeToWidth(text, maxWidth, fontSize, forceEllipsis = false) {
  const normalized = normalizeLabel(text);
  if (!normalized) return '';
  const fitBuffer = Math.max(1.25, fontSize * 0.12);
  const usableWidth = Math.max(0, maxWidth - fitBuffer);
  if (!forceEllipsis && estimateLabelTextWidth(normalized, fontSize) <= usableWidth) return normalized;
  const ellipsis = '\u2026';
  const chars = Array.from(normalized);
  const originalLength = chars.length;
  while (
    chars.length > 0
    && (estimateLabelTextWidth(chars.join('') + ellipsis, fontSize) > usableWidth || (forceEllipsis && chars.length === originalLength))
  ) chars.pop();
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

function wrapWordsWithEllipsis(words, maxWidths, fontSize, forceEllipsisOnLastLine = false) {
  const lines = [];
  let wordIndex = 0;
  for (let lineIndex = 0; lineIndex < maxWidths.length; lineIndex++) {
    const remainingWords = words.slice(wordIndex);
    if (!remainingWords.length) break;
    if (lineIndex === maxWidths.length - 1) { lines.push(ellipsizeToWidth(remainingWords.join(' '), maxWidths[lineIndex], fontSize, forceEllipsisOnLastLine)); return lines; }
    let bestLine = '';
    let bestCount = 0;
    for (let count = 1; count <= remainingWords.length; count++) { const candidate = remainingWords.slice(0, count).join(' '); if (estimateLabelTextWidth(candidate, fontSize) <= maxWidths[lineIndex]) { bestLine = candidate; bestCount = count; } else break; }
    if (!bestLine) return null;
    lines.push(bestLine);
    wordIndex += bestCount;
  }
  return wordIndex >= words.length ? lines : null;
}

function createLabelLayout(lines, fontSize, lineHeight, anchorRadius) {
  const safeLines = lines.length ? lines : [''];
  return {
    lines: safeLines,
    fontSize,
    lineHeight,
    anchorRadius,
    isWrapped: safeLines.length > 1,
    isEllipsized: safeLines.some((line) => line.endsWith('\u2026')),
  };
}

function getLabelGeometry(segmentCount, fontSize) {
  const safeSegmentCount = Math.max(1, segmentCount);
  const segmentAngle = (2 * Math.PI) / safeSegmentCount;
  const lineHeight = fontSize * 1.08;
  const innerRadius = HUB_R + Math.max(12, fontSize * 1.05);
  const outerRadius = WHEEL_R - Math.max(10, fontSize * 1.1);
  const radialBand = Math.max(0, outerRadius - innerRadius);
  const maxLines = Math.min(3, Math.max(1, Math.floor((outerRadius - innerRadius) / lineHeight)));

  function getLayoutMetrics(lineCount) {
    const lineOffsetExtent = ((lineCount - 1) / 2) * lineHeight;
    const rimBuffer = Math.max(12, lineHeight * 1.35);
    const maxAnchorRadius = outerRadius - rimBuffer - lineOffsetExtent;
    let anchorRadius = getLabelAnchorRadius(innerRadius, outerRadius, lineHeight, lineCount);
    if (safeSegmentCount === 1) {
      anchorRadius = Math.min(maxAnchorRadius, innerRadius + radialBand * 0.54);
    }
    if (safeSegmentCount <= 2 && lineCount > 1) {
      anchorRadius = Math.min(maxAnchorRadius, anchorRadius + lineHeight * 0.9);
    }
    const maxWidths = getLineOffsets(lineCount, lineHeight).map((offset) => {
      const lineRadius = Math.max(innerRadius, Math.min(outerRadius, anchorRadius + offset));
      const maxWidth = getSliceLineMaxWidth(lineRadius, segmentAngle, fontSize);
      return safeSegmentCount === 1 ? Math.max(fontSize * 2, maxWidth - fontSize * 4) : maxWidth;
    });
    return { anchorRadius, maxWidths };
  }

  return { lineHeight, maxLines, getLayoutMetrics };
}

function getFittedLabelLayouts(name, segmentCount, fontSize) {
  const normalized = normalizeLabel(name);
  const geometry = getLabelGeometry(segmentCount, fontSize);
  const words = normalized ? normalized.split(' ') : [];
  const layouts = [];
  const seen = new Set();

  function pushLayout(lines, anchorRadius) {
    const key = `${fontSize}|${lines.join('\n')}`;
    if (seen.has(key)) return;
    seen.add(key);
    layouts.push(createLabelLayout(lines, fontSize, geometry.lineHeight, anchorRadius));
  }

  const singleLineLayout = geometry.getLayoutMetrics(1);
  if (!normalized) {
    pushLayout([''], singleLineLayout.anchorRadius);
    return layouts;
  }

  if (estimateLabelTextWidth(normalized, fontSize) <= singleLineLayout.maxWidths[0]) {
    pushLayout([normalized], singleLineLayout.anchorRadius);
  }

  if (words.length > 1) {
    for (let lineCount = 2; lineCount <= geometry.maxLines; lineCount++) {
      const lineLayout = geometry.getLayoutMetrics(lineCount);
      const fittedLines = findWrappedLines(words, lineLayout.maxWidths, fontSize);
      if (fittedLines) pushLayout(fittedLines, lineLayout.anchorRadius);
    }
  }

  return layouts;
}

function getEllipsizedLabelLayout(name, segmentCount, fontSize) {
  const normalized = normalizeLabel(name);
  const geometry = getLabelGeometry(segmentCount, fontSize);
  const words = normalized ? normalized.split(' ') : [];

  if (!normalized) {
    const singleLineLayout = geometry.getLayoutMetrics(1);
    return createLabelLayout([''], fontSize, geometry.lineHeight, singleLineLayout.anchorRadius);
  }

  if (words.length > 1) {
    const fallbackLayout = geometry.getLayoutMetrics(geometry.maxLines);
    const fallbackLines = wrapWordsWithEllipsis(words, fallbackLayout.maxWidths, fontSize, true);
    if (fallbackLines) return createLabelLayout(fallbackLines, fontSize, geometry.lineHeight, fallbackLayout.anchorRadius);
  }

  const singleLineLayout = geometry.getLayoutMetrics(1);
  const clippedLine = ellipsizeToWidth(normalized, singleLineLayout.maxWidths[0], fontSize, true);
  return createLabelLayout([clippedLine], fontSize, geometry.lineHeight, singleLineLayout.anchorRadius);
}

function getRestaurantLabelCandidates(name, segmentCount, baseFontSize = getWheelLabelFontSize(segmentCount), minFontSize = getMinWheelLabelFontSize(segmentCount)) {
  const candidates = [];
  const seen = new Set();
  const maxFontSize = Math.max(baseFontSize, minFontSize);
  const floorFontSize = Math.min(baseFontSize, minFontSize);

  function pushCandidate(layout) {
    const key = `${layout.fontSize}|${layout.lines.join('\n')}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(layout);
  }

  for (let fontSize = maxFontSize; fontSize >= floorFontSize; fontSize--) {
    getFittedLabelLayouts(name, segmentCount, fontSize).forEach(pushCandidate);
  }

  pushCandidate(getEllipsizedLabelLayout(name, segmentCount, floorFontSize));
  return candidates.length ? candidates : [getEllipsizedLabelLayout(name, segmentCount, floorFontSize)];
}

function getRestaurantLabelLayout(name, segmentCount, fontSize = getWheelLabelFontSize(segmentCount)) {
  return getRestaurantLabelCandidates(name, segmentCount, fontSize, fontSize)[0];
}

function hasSvgTextClipping(textElement) {
  if (!textElement || typeof textElement.getNumberOfChars !== 'function' || typeof textElement.getExtentOfChar !== 'function') return false;

  const clipPathValue = textElement.getAttribute?.('clip-path');
  const clipId = clipPathValue?.match(/#([^)]+)/)?.[1];
  if (!clipId) return false;

  const clipShape = textElement.ownerDocument?.getElementById?.(clipId)?.querySelector?.('path');
  const svg = textElement.ownerSVGElement;
  if (!clipShape || typeof clipShape.isPointInFill !== 'function' || !svg || typeof svg.createSVGPoint !== 'function') return false;

  let totalChars = 0;
  try {
    totalChars = textElement.getNumberOfChars();
  } catch {
    return false;
  }

  const rendered = textElement.textContent || '';
  for (let index = 0; index < totalChars; index++) {
    const ch = rendered[index];
    if (!ch || /\s/.test(ch)) continue;

    let box;
    try {
      box = textElement.getExtentOfChar(index);
    } catch {
      return false;
    }

    if (!box || box.width <= 0 || box.height <= 0) continue;

    const insetX = Math.min(0.6, Math.max(0.2, box.width * 0.05));
    const insetY = Math.min(0.6, Math.max(0.2, box.height * 0.05));
    const points = [
      [box.x + insetX, box.y + insetY],
      [box.x + box.width - insetX, box.y + insetY],
      [box.x + insetX, box.y + box.height - insetY],
      [box.x + box.width - insetX, box.y + box.height - insetY],
      [box.x + box.width / 2, box.y + box.height / 2],
    ];

    for (const [x, y] of points) {
      const point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      if (!clipShape.isPointInFill(point)) return true;
    }
  }

  return false;
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

/**
 * Filter restaurants by cuisine and/or price range.
 *
 * @param {Array}  restaurants  - Full list of restaurant objects
 * @param {string} cuisine      - Cuisine string to match (case-insensitive), or '' for all
 * @param {number|null} price   - Price range integer (1-3) to match, or null for all
 * @returns {Array} Filtered list
 */
function filterRestaurants(restaurants, cuisine, price) {
  return restaurants.filter((r) => {
    const cuisineMatch =
      !cuisine || (r.cuisine && r.cuisine.toLowerCase() === cuisine.toLowerCase());
    const priceMatch = price == null || r.price_range === price;
    return cuisineMatch && priceMatch;
  });
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
  getMinWheelLabelFontSize,
  getRestaurantLabelCandidates,
  getRestaurantLabelLayout,
  getWheelLabelFontSize,
  hasSvgTextClipping,
  shuffleArray,
  priceLabel,
  computeStopAngles,
  filterRestaurants,
};
