import { useState } from 'react';

export default function StarRating({ value, onRate, readOnly = false, size = 'md' }) {
  const [hover, setHover] = useState(0);
  const stars = [1, 2, 3, 4, 5];

  if (readOnly) {
    return (
      <span className={`stars stars-${size}`} aria-label={`${value} out of 5 stars`}>
        {stars.map((s) => (
          <span key={s} className={s <= Math.round(value || 0) ? 'star filled' : 'star empty'}>★</span>
        ))}
      </span>
    );
  }

  return (
    <span className={`stars stars-${size} stars-interactive`}>
      {stars.map((s) => (
        <span
          key={s}
          className={s <= (hover || value || 0) ? 'star filled' : 'star empty'}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate && onRate(s)}
          role="button"
          aria-label={`Rate ${s} star${s > 1 ? 's' : ''}`}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onRate && onRate(s)}
        >★</span>
      ))}
    </span>
  );
}
