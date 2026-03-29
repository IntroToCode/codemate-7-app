import { useEffect, useRef, useState } from 'react';
import {
  WHEEL_R,
  OUTER_RING_R,
  HUB_R,
  SVG_SIZE,
  CASINO_COLORS,
  buildSegPath,
  clamp,
} from './rouletteUtils.jsx';

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

const WHEEL_SPEED = (2 * Math.PI) / 900;

export default function RouletteWheel({ restaurants, spinning, winnerIndex, onSpinComplete }) {
  const wheelGroupRef = useRef(null);
  const rafRef = useRef(null);
  const wheelAngle = useRef(0);
  const phase = useRef('idle');
  const fastStart = useRef(null);
  const stopData = useRef(null);
  const winnerRef = useRef(winnerIndex);
  const onCompleteRef = useRef(onSpinComplete);
  const lastSeg = useRef(-1);
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
    winnerRef.current = null;
    wheelAngle.current = 0;
    lastSeg.current = -1;

    function tick(now) {
      if (phase.current === 'fast') {
        const elapsed = now - fastStart.current;
        wheelAngle.current = -(elapsed * WHEEL_SPEED);
        checkTick();
        moveWheel();

        const wi = winnerRef.current;
        if (wi !== null && wi !== undefined) {
          const stopDuration = 3400;
          const targetAngle = -((wi + 0.5) * sa);
          const TWO_PI = 2 * Math.PI;
          let wheelFinalActual = targetAngle + Math.floor((wheelAngle.current - targetAngle) / TWO_PI) * TWO_PI;
          if (wheelFinalActual >= wheelAngle.current) wheelFinalActual -= TWO_PI;
          let wheelTravel = wheelFinalActual - wheelAngle.current;
          const idealMag = WHEEL_SPEED * stopDuration / 3;
          while (wheelTravel - TWO_PI >= -idealMag) wheelTravel -= TWO_PI;

          stopData.current = {
            startTime: now,
            wheelStart: wheelAngle.current,
            wheelTravel,
            duration: stopDuration,
          };
          phase.current = 'stopping';
        }
      } else if (phase.current === 'stopping') {
        const { startTime, wheelStart, wheelTravel, duration } = stopData.current;
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        wheelAngle.current = wheelStart + wheelTravel * eased;
        checkTick();
        moveWheel();

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

  function checkTick() {
    const norm = (((-wheelAngle.current + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const seg = Math.floor(norm / sa);
    if (lastSeg.current !== -1 && seg !== lastSeg.current) {
      const isStopping = phase.current === 'stopping';
      const vol = isStopping ? 0.22 : 0.10;
      playTick(vol);
    }
    lastSeg.current = seg;
  }

  function moveWheel() {
    if (wheelGroupRef.current) {
      const deg = (wheelAngle.current * 180 / Math.PI).toFixed(2);
      wheelGroupRef.current.setAttribute('transform', `rotate(${deg})`);
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

        {/* Track background */}
        <circle r={WHEEL_R + 22} fill="#0f0700" />
        <circle r={WHEEL_R + 21} fill="none" stroke="rgba(255,215,0,0.15)" strokeWidth="1" />
        <circle r={WHEEL_R + 1} fill="none" stroke="rgba(255,215,0,0.12)" strokeWidth="1" />

        {/* Rotating wheel group: segments + dividers + rim */}
        <g ref={wheelGroupRef}>
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
        </g>

        {/* Center hub layers (fixed, radially symmetric) */}
        <circle r={HUB_R + 7} fill="#0f0700" />
        <circle r={HUB_R + 4} fill="#8B6914" />
        <circle r={HUB_R} fill="url(#rw-hub)" />
        <circle r={HUB_R - 9} fill="#1a0a00" />
        <circle r={HUB_R - 12} fill="#2a1a00" />
        <circle r={7} fill="#C9A84C" />
        <circle r={4} fill="#F5D76E" />

        {/* Fixed pointer arrow at top */}
        <polygon
          points={`0,${-(WHEEL_R + 2)} -8,${-(WHEEL_R + 20)} 8,${-(WHEEL_R + 20)}`}
          fill="#e53e3e"
          stroke="#c0392b"
          strokeWidth="1.5"
          filter="url(#rw-shadow)"
        />
      </svg>
    </div>
  );
}
