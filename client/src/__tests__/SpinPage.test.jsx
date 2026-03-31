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
  filterRestaurants: (restaurants, cuisine, price) => restaurants.filter((restaurant) => {
    const cuisineMatch = !cuisine || (restaurant.cuisine && restaurant.cuisine.toLowerCase() === cuisine.toLowerCase());
    const priceMatch = price == null || restaurant.price_range === price;
    return cuisineMatch && priceMatch;
  }),
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

  test('shows the 7-day warning instead of no-match when filters still match but recent exclusion removes all filtered options', async () => {
    restaurants = [
      { id: 'a', name: 'Alpha Cafe', cuisine: 'Italian', active: true },
      { id: 'b', name: 'Bravo Bistro', cuisine: 'Italian', active: true },
      { id: 'c', name: 'Charlie Deli', cuisine: 'Mexican', active: true },
    ];
    recentIds = ['a', 'b'];

    renderSpinPage();

    await waitFor(() => expect(screen.getByLabelText(/cuisine/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/cuisine/i), { target: { value: 'Italian' } });

    await waitFor(() => {
      expect(screen.getByText(/all active restaurants were picked in the last 7 days/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/no restaurants match your filters/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /spin the wheel/i })).not.toBeInTheDocument();
  });

  test('turning off the 7-day toggle keeps the active filters and restores only the filtered restaurants', async () => {
    restaurants = [
      { id: 'a', name: 'Alpha Cafe', cuisine: 'Italian', active: true },
      { id: 'b', name: 'Bravo Bistro', cuisine: 'Italian', active: true },
      { id: 'c', name: 'Charlie Deli', cuisine: 'Mexican', active: true },
    ];
    recentIds = ['a', 'b'];

    renderSpinPage();

    await waitFor(() => expect(screen.getByLabelText(/cuisine/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/cuisine/i), { target: { value: 'Italian' } });

    await waitFor(() => {
      expect(screen.getByText(/all active restaurants were picked in the last 7 days/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(screen.getByText('Alpha Cafe')).toBeInTheDocument());
    expect(screen.getByText('Bravo Bistro')).toBeInTheDocument();
    expect(screen.queryByText('Charlie Deli')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /spin the wheel/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/cuisine/i)).toHaveValue('Italian');
  });

  test('sends skip_ids that preserve the active filter and visible wheel pool during a spin', async () => {
    restaurants = [
      { id: 'i1', name: 'Italian 1', cuisine: 'Italian', active: true },
      { id: 'i2', name: 'Italian 2', cuisine: 'Italian', active: true },
      { id: 'i3', name: 'Italian 3', cuisine: 'Italian', active: true },
      { id: 'i4', name: 'Italian 4', cuisine: 'Italian', active: true },
      { id: 'i5', name: 'Italian 5', cuisine: 'Italian', active: true },
      { id: 'i6', name: 'Italian 6', cuisine: 'Italian', active: true },
      { id: 'i7', name: 'Italian 7', cuisine: 'Italian', active: true },
      { id: 'i8', name: 'Italian 8', cuisine: 'Italian', active: true },
      { id: 'i9', name: 'Italian 9', cuisine: 'Italian', active: true },
      { id: 'm1', name: 'Mexican 1', cuisine: 'Mexican', active: true },
    ];

    global.fetch = jest.fn((url, options) => {
      if (url === '/api/restaurants') return okJson(restaurants);
      if (String(url).startsWith('/api/spins/recent-ids')) return okJson({ restaurant_ids: [] });
      if (String(url).startsWith('/api/spins/remaining')) return okJson(spinInfo);
      if (url === '/api/spins' && options?.method === 'POST') {
        return okJson({
          spin: { id: 'spin-1' },
          restaurant: { id: 'i1', name: 'Italian 1' },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderSpinPage();

    await waitFor(() => expect(screen.getByLabelText(/cuisine/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/cuisine/i), { target: { value: 'Italian' } });

    await waitFor(() => expect(screen.getByRole('button', { name: /spin the wheel/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /spin the wheel/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/spins', expect.any(Object));
    }, { timeout: 2500 });

    const [, options] = global.fetch.mock.calls.find(([url]) => url === '/api/spins');
    const body = JSON.parse(options.body);

    expect(body.skip_ids).toEqual(expect.arrayContaining(['m1', 'i9']));
    expect(body.skip_ids).not.toEqual(expect.arrayContaining(['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8']));
  });

});