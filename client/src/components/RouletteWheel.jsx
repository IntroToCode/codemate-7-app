import { useEffect, useRef, useState } from 'react';

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

const WHEEL_R = 168;
const BALL_ORBIT_R = 190;
const OUTER_RING_R = 207;
const HUB_R = 28;
const SVG_SIZE = 218;

let _audioCtx = null;
function getAudio() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  } catch {
    return null;
  }
}

function playTick(vol = 0.14) {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    const len = Math.floor(ctx.sampleRate * 0.012);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.003));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
  } catch {}
}

function playWin() {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch {}
}

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
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export default function RouletteWheel({ restaurants, spinning, winnerIndex, onSpinComplete }) {
  const ballRef = useRef(null);
  const ballShineRef = useRef(null);
  const rafRef = useRef(null);
  const ballAngle = useRef(-Math.PI / 2);
  const phase = useRef('idle');
  const fastStart = useRef(null);
  const stopData = useRef(null);
  const lastTick = useRef(0);
  const winnerRef = useRef(winnerIndex);
  const onCompleteRef = useRef(onSpinComplete);
  const [entering, setEntering] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onSpinComplete;
  }, [onSpinComplete]);

  const n = Math.max(2, Math.min(8, restaurants.length));
  const sa = (2 * Math.PI) / n;

  useEffect(() => {
    winnerRef.current = winnerIndex;
  }, [winnerIndex]);

  useEffect(() => {
    if (restaurants.length < 2) return;
    setDone(false);
    setEntering(true);
    const t = setTimeout(() => setEntering(false), restaurants.length * 100 + 500);
    return () => clearTimeout(t);
  }, [restaurants]);

  useEffect(() => {
    if (!spinning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      phase.current = 'idle';
      return;
    }

    setDone(false);
    phase.current = 'fast';
    fastStart.current = performance.now();
    stopData.current = null;
    lastTick.current = 0;
    winnerRef.current = null;

    function tick(now) {
      const isFast = phase.current === 'fast';
      const progress = stopData.current
        ? Math.min((now - stopData.current.startTime) / stopData.current.duration, 1)
        : 0;
      const interval = isFast ? 48 : 48 + progress * 580;

      if (now - lastTick.current >= interval) {
        lastTick.current = now;
        playTick(isFast ? 0.15 : 0.12 * (1 - progress * 0.6));
      }

      if (phase.current === 'fast') {
        const elapsed = now - fastStart.current;
        ballAngle.current = -Math.PI / 2 + (elapsed / 430) * (2 * Math.PI);
        moveBall();

        const wi = winnerRef.current;
        if (wi !== null && wi !== undefined) {
          const targetAngle = -Math.PI / 2 + (wi + 0.5) * sa;
          const curPos = ((ballAngle.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          const tgtPos = ((targetAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          let delta = (tgtPos - curPos + 2 * Math.PI) % (2 * Math.PI);
          if (delta < 0.15) delta += 2 * Math.PI;
          stopData.current = {
            startTime: now,
            startAngle: ballAngle.current,
            totalTravel: 3 * 2 * Math.PI + delta,
            duration: 3400,
          };
          phase.current = 'stopping';
        }
      } else if (phase.current === 'stopping') {
        const { startTime, startAngle, totalTravel, duration } = stopData.current;
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        ballAngle.current = startAngle + totalTravel * eased;
        moveBall();

        if (t >= 1) {
          phase.current = 'done';
          setDone(true);
          playWin();
          onCompleteRef.current();
          return;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [spinning, sa]);

  function moveBall() {
    const a = ballAngle.current;
    const x = (BALL_ORBIT_R * Math.cos(a)).toFixed(2);
    const y = (BALL_ORBIT_R * Math.sin(a)).toFixed(2);
    if (ballRef.current) {
      ballRef.current.setAttribute('cx', x);
      ballRef.current.setAttribute('cy', y);
    }
    if (ballShineRef.current) {
      ballShineRef.current.setAttribute('cx', (BALL_ORBIT_R * Math.cos(a) - 3).toFixed(2));
      ballShineRef.current.setAttribute('cy', (BALL_ORBIT_R * Math.sin(a) - 3).toFixed(2));
    }
  }

  const fontSize = n <= 3 ? 13 : n <= 5 ? 11 : n <= 7 ? 10 : 9;
  const maxLen = n <= 3 ? 13 : n <= 5 ? 11 : n <= 7 ? 9 : 8;
  const textR = WHEEL_R * 0.58;

  const rimDiamonds = Array.from({ length: 18 });

  return (
    <div className="roulette-wrap">
      <svg
        viewBox={`-${SVG_SIZE} -${SVG_SIZE} ${SVG_SIZE * 2} ${SVG_SIZE * 2}`}
        className="roulette-svg"
        aria-label="Casino roulette wheel"
      >
        <defs>
          <filter id="rw-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="rgba(0,0,0,0.55)" />
          </filter>
          <filter id="rw-ball" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="rgba(255,255,255,0.7)" />
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.5)" />
          </filter>
          <filter id="rw-text" x="-20%" y="-50%" width="140%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="rgba(0,0,0,0.95)" />
          </filter>
          <filter id="rw-winner" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="rw-hub" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#F5D76E" />
            <stop offset="55%" stopColor="#C9A84C" />
            <stop offset="100%" stopColor="#8B6914" />
          </radialGradient>
          <radialGradient id="rw-outer" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#8B6914" />
            <stop offset="100%" stopColor="#C9A84C" />
          </radialGradient>
        </defs>

        {/* Outer glow ring */}
        <circle r={OUTER_RING_R + 4} fill="#2a1a00" filter="url(#rw-shadow)" />

        {/* Outer brass ring */}
        <circle r={OUTER_RING_R} fill="url(#rw-outer)" />
        <circle r={OUTER_RING_R - 3} fill="#8B6914" />
        <circle r={OUTER_RING_R - 6} fill="#C9A84C" />
        <circle r={OUTER_RING_R - 10} fill="#8B6914" />

        {/* Rim diamond markers */}
        {rimDiamonds.map((_, i) => {
          const a = (i / 18) * 2 * Math.PI;
          const r = OUTER_RING_R - 6;
          const cx = (r * Math.cos(a)).toFixed(2);
          const cy = (r * Math.sin(a)).toFixed(2);
          const deg = ((a * 180) / Math.PI).toFixed(1);
          return (
            <rect
              key={`d-${i}`}
              x="-3.5" y="-3.5" width="7" height="7"
              fill={i % 3 === 0 ? '#111' : '#F5D76E'}
              transform={`translate(${cx},${cy}) rotate(${deg})`}
            />
          );
        })}

        {/* Ball track background */}
        <circle r={WHEEL_R + 22} fill="#0f0700" />
        <circle r={WHEEL_R + 21} fill="none" stroke="rgba(255,215,0,0.15)" strokeWidth="1" />
        <circle r={WHEEL_R + 1} fill="none" stroke="rgba(255,215,0,0.12)" strokeWidth="1" />

        {/* Wheel segments */}
        {restaurants.map((r, i) => {
          const midA = -Math.PI / 2 + (i + 0.5) * sa;
          const tx = (textR * Math.cos(midA)).toFixed(2);
          const ty = (textR * Math.sin(midA)).toFixed(2);
          const deg = ((midA * 180) / Math.PI + 90).toFixed(1);
          const color = CASINO_COLORS[i % CASINO_COLORS.length];
          const isWinner = done && winnerIndex === i;

          return (
            <g
              key={`seg-${i}-${r.id || i}`}
              className={`rw-seg${entering ? ' rw-seg-enter' : ''}${isWinner ? ' rw-seg-win' : ''}`}
              style={entering ? { animationDelay: `${i * 0.09}s` } : undefined}
            >
              <path
                d={buildSegPath(i, n)}
                fill={isWinner ? '#C9A84C' : color}
                stroke="#111"
                strokeWidth="2"
              />
              <text
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isWinner ? '#1a1a1a' : 'white'}
                fontSize={fontSize}
                fontWeight="700"
                fontFamily="'Segoe UI', system-ui, sans-serif"
                letterSpacing="0.01em"
                transform={`rotate(${deg},${tx},${ty})`}
                filter="url(#rw-text)"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {clamp(r.name, maxLen)}
              </text>
            </g>
          );
        })}

        {/* Segment divider lines */}
        {restaurants.map((_, i) => {
          const a = -Math.PI / 2 + i * sa;
          const x = (WHEEL_R * Math.cos(a)).toFixed(2);
          const y = (WHEEL_R * Math.sin(a)).toFixed(2);
          return (
            <line key={`dl-${i}`} x1="0" y1="0" x2={x} y2={y}
              stroke="#111" strokeWidth="2.5" />
          );
        })}

        {/* Wheel rim */}
        <circle r={WHEEL_R} fill="none" stroke="#2a1a00" strokeWidth="3" />

        {/* Center hub layers */}
        <circle r={HUB_R + 7} fill="#0f0700" />
        <circle r={HUB_R + 4} fill="#8B6914" />
        <circle r={HUB_R} fill="url(#rw-hub)" />
        <circle r={HUB_R - 9} fill="#1a0a00" />
        <circle r={HUB_R - 12} fill="#2a1a00" />
        <circle r={7} fill="#C9A84C" />
        <circle r={4} fill="#F5D76E" />

        {/* Pointer at top */}
        <polygon
          points={`0,${-(WHEEL_R + 2)} -8,${-(WHEEL_R + 20)} 8,${-(WHEEL_R + 20)}`}
          fill="#e53e3e"
          stroke="#c0392b"
          strokeWidth="1.5"
          filter="url(#rw-shadow)"
        />
        <line
          x1="0" y1={-(WHEEL_R + 20)}
          x2="0" y2={-(WHEEL_R + 4)}
          stroke="#c0392b" strokeWidth="2"
        />

        {/* Ball */}
        <circle
          ref={ballRef}
          cx={0}
          cy={-BALL_ORBIT_R}
          r={9}
          fill="white"
          stroke="#ccc"
          strokeWidth="1.5"
          filter="url(#rw-ball)"
        />
        {/* Ball shine */}
        <circle
          ref={ballShineRef}
          cx={-3}
          cy={-BALL_ORBIT_R - 3}
          r={3}
          fill="rgba(255,255,255,0.8)"
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    </div>
  );
}
