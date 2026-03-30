import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpinPage from '../pages/SpinPage';
import { UserProvider } from '../context/UserContext';
import { TempDisableProvider } from '../context/TempDisableContext';

jest.mock('../components/RouletteWheel', () => function MockRouletteWheel({ restaurants, disabled }) {
  return (
    <div
      data-testid="wheel"
      data-disabled={disabled ? 'true' : 'false'}
      aria-disabled={disabled ? 'true' : 'false'}
    >
      {restaurants.map((restaurant) => (
        <span key={restaurant.id}>{restaurant.name}</span>
      ))}
    </div>
  );
});

jest.mock('../components/rouletteUtils.jsx', () => ({
  shuffleArray: (items) => items,
  priceLabel: (value) => `$${value}`,
}));

function okJson(data, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

function renderSpinPage() {
  localStorage.setItem('lr_username', 'Bob');
  return render(
    <UserProvider>
      <TempDisableProvider>
        <SpinPage />
      </TempDisableProvider>
    </UserProvider>
  );
}

describe('SpinPage recent exclusion UI', () => {
  let restaurants;
  let recentIds;
  let spinInfo;

  beforeEach(() => {
    restaurants = [];
    recentIds = [];
    spinInfo = { remaining: -1, limit: -1, used: 0, unlimited: true };
    localStorage.clear();

    global.fetch = jest.fn((url) => {
      if (url === '/api/restaurants') return okJson(restaurants);
      if (String(url).startsWith('/api/spins/recent-ids')) {
        return okJson({ restaurant_ids: recentIds });
      }
      if (String(url).startsWith('/api/spins/remaining')) return okJson(spinInfo);
      throw new Error(`Unexpected fetch: ${url}`);
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('hides recently visited restaurants from the wheel when exclusion is on', async () => {
    restaurants = [
      { id: 'a', name: 'Alpha Cafe', active: true },
      { id: 'b', name: 'Bravo Bistro', active: true },
      { id: 'c', name: 'Charlie Deli', active: true },
    ];
    recentIds = ['a'];

    renderSpinPage();

    await waitFor(() => expect(screen.getByTestId('wheel')).toBeInTheDocument());
    expect(screen.queryByText('Alpha Cafe')).not.toBeInTheDocument();
    expect(screen.getByText('Bravo Bistro')).toBeInTheDocument();
    expect(screen.getByText('Charlie Deli')).toBeInTheDocument();
  });

  test('shows a clear warning when all active restaurants are excluded by the 7-day rule', async () => {
    restaurants = [
      { id: 'a', name: 'Alpha Cafe', active: true },
      { id: 'b', name: 'Bravo Bistro', active: true },
    ];
    recentIds = ['a', 'b'];

    renderSpinPage();

    await waitFor(() => {
      expect(screen.getByText(/all active restaurants were picked in the last 7 days/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /spin the wheel/i })).not.toBeInTheDocument();
  });

  test('keeps the add-more-restaurants warning when only one eligible restaurant remains', async () => {
    restaurants = [
      { id: 'a', name: 'Alpha Cafe', active: true },
      { id: 'b', name: 'Bravo Bistro', active: true },
      { id: 'c', name: 'Charlie Deli', active: true },
    ];
    recentIds = ['a', 'b'];

    renderSpinPage();

    await waitFor(() => {
      expect(screen.getByText(/add at least 2 restaurants to spin the wheel/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('wheel')).toHaveAttribute('data-disabled', 'true');
    expect(screen.getByText('Charlie Deli')).toBeInTheDocument();
  });

  test('removes the disabled wheel state when the 7-day toggle is turned off and enough restaurants return', async () => {
    restaurants = [
      { id: 'a', name: 'Alpha Cafe', active: true },
      { id: 'b', name: 'Bravo Bistro', active: true },
      { id: 'c', name: 'Charlie Deli', active: true },
    ];
    recentIds = ['a', 'b'];

    renderSpinPage();

    await waitFor(() => expect(screen.getByTestId('wheel')).toBeInTheDocument());
    expect(screen.getByTestId('wheel')).toHaveAttribute('data-disabled', 'true');
    expect(screen.queryByText('Alpha Cafe')).not.toBeInTheDocument();
    expect(screen.queryByText('Bravo Bistro')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(screen.getByText('Alpha Cafe')).toBeInTheDocument());
    expect(screen.getByTestId('wheel')).toHaveAttribute('data-disabled', 'false');
    expect(screen.getByText('Bravo Bistro')).toBeInTheDocument();
    expect(screen.getByText('Charlie Deli')).toBeInTheDocument();
  });

});