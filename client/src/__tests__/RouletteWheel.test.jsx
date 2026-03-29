import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RouletteWheel from '../components/RouletteWheel';

const mockRestaurants = [
  { id: 1, name: 'Pizza Palace' },
  { id: 2, name: 'Taco Town' },
  { id: 3, name: 'Burger Barn' },
  { id: 4, name: 'Sushi Spot' },
];

beforeAll(() => {
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
});

describe('RouletteWheel rendering', () => {
  test('renders svg with correct aria-label', () => {
    const { container } = render(
      <RouletteWheel
        restaurants={mockRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', 'Casino roulette wheel');
  });

  test('marks the wheel wrapper as disabled when disabled is true', () => {
    const { container } = render(
      <RouletteWheel
        restaurants={[{ id: 1, name: 'Solo Spot' }]}
        disabled
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const wrapper = container.querySelector('.roulette-wrap');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('is-disabled');
    expect(wrapper).toHaveAttribute('aria-disabled', 'true');
  });

  test('renders correct number of segments', () => {
    const { container } = render(
      <RouletteWheel
        restaurants={mockRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const segments = container.querySelectorAll('.rw-seg');
    expect(segments).toHaveLength(4);
  });

  test('displays restaurant names in segments', () => {
    const { container } = render(
      <RouletteWheel
        restaurants={mockRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const texts = container.querySelectorAll('.rw-seg text');
    const names = Array.from(texts).map((t) => t.textContent);
    expect(names).toContain('Pizza Pala\u2026');
    expect(names).toContain('Taco Town');
    expect(names).toContain('Burger Barn');
    expect(names).toContain('Sushi Spot');
  });

  test('renders with 2 restaurants (minimum)', () => {
    const twoRestaurants = [
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ];
    const { container } = render(
      <RouletteWheel
        restaurants={twoRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const segments = container.querySelectorAll('.rw-seg');
    expect(segments).toHaveLength(2);
  });

  test('renders with 8 restaurants (maximum)', () => {
    const eightRestaurants = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: `Restaurant ${i + 1}`,
    }));
    const { container } = render(
      <RouletteWheel
        restaurants={eightRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const segments = container.querySelectorAll('.rw-seg');
    expect(segments).toHaveLength(8);
  });

  test('renders the ball element', () => {
    const { container } = render(
      <RouletteWheel
        restaurants={mockRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const circles = container.querySelectorAll('circle[filter="url(#rw-ball)"]');
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });

  test('renders 18 rim diamond markers', () => {
    const { container } = render(
      <RouletteWheel
        restaurants={mockRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const rects = container.querySelectorAll('rect');
    expect(rects).toHaveLength(18);
  });

  test('renders the fixed pointer at the top', () => {
    const { container } = render(
      <RouletteWheel
        restaurants={mockRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const pointer = container.querySelector('polygon');
    expect(pointer).toBeInTheDocument();
    expect(pointer).toHaveAttribute('fill', '#e53e3e');
  });

  test('renders a rotating wheel group', () => {
    const { container } = render(
      <RouletteWheel
        restaurants={mockRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const groups = container.querySelectorAll('svg > g');
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });

  test('segments get entrance animation class on initial render', () => {
    const { container } = render(
      <RouletteWheel
        restaurants={mockRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const enteringSegs = container.querySelectorAll('.rw-seg-enter');
    expect(enteringSegs.length).toBe(4);
  });

  test('renders segment divider lines', () => {
    const { container } = render(
      <RouletteWheel
        restaurants={mockRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(4);
  });

  test('truncates long restaurant names', () => {
    const longNameRestaurants = [
      { id: 1, name: 'Extremely Long Restaurant Name That Is Way Too Long' },
      { id: 2, name: 'Another Very Long Name Here' },
      { id: 3, name: 'Short' },
      { id: 4, name: 'Also Short' },
    ];
    const { container } = render(
      <RouletteWheel
        restaurants={longNameRestaurants}
        spinning={false}
        winnerIndex={null}
        onSpinComplete={() => {}}
      />
    );
    const texts = container.querySelectorAll('.rw-seg text');
    const firstName = texts[0].textContent;
    expect(firstName.length).toBeLessThanOrEqual(11);
    expect(firstName).toMatch(/…$/);
  });
});
