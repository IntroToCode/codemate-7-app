import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RestaurantSearch from '../components/RestaurantSearch';

beforeEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

const mockResults = [
  { place_id: 'ChIJ_1', name: 'Pizza Palace', address: '123 Main St', cuisine: 'pizza', price_range: 2, rating: 4.5, already_added: false },
  { place_id: 'ChIJ_2', name: 'Existing Sushi', address: '456 Oak Ave', cuisine: 'japanese', price_range: 3, rating: 4.0, already_added: true },
  { place_id: 'ChIJ_3', name: 'Taco Spot', address: '789 Elm St', cuisine: 'mexican', price_range: 1, rating: 3.8, already_added: false },
];

function mockFetchResponse(results, nextPageToken = null) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ results, nextPageToken }),
  });
}

describe('RestaurantSearch zip code entry', () => {
  test('renders zip code input and search button', () => {
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByPlaceholderText(/zip code/i)).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  test('shows hint text about entering a zip code', () => {
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/enter a zip code/i)).toBeInTheDocument();
  });

  test('zip input has required attribute and pattern for 5 digits', () => {
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    const input = screen.getByPlaceholderText(/zip code/i);
    expect(input).toHaveAttribute('required');
    expect(input).toHaveAttribute('pattern', '\\d{5}');
    expect(input).toHaveAttribute('maxLength', '5');
  });

  test('calls close handler when close button is clicked', () => {
    const onClose = jest.fn();
    render(<RestaurantSearch onSelect={() => {}} onClose={onClose} />);
    const closeButtons = screen.getAllByText('✕');
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('saves zip code to localStorage on submit', async () => {
    global.fetch = mockFetchResponse(mockResults);
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));
    await waitFor(() => {
      expect(localStorage.getItem('lr_search_zipcode')).toBe('10001');
    });
  });

  test('pre-fills zip code from localStorage and skips to results', async () => {
    localStorage.setItem('lr_search_zipcode', '90210');
    global.fetch = mockFetchResponse(mockResults);
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('📍 90210')).toBeInTheDocument();
    });
  });
});

describe('RestaurantSearch results', () => {
  function submitZipAndLoadResults() {
    global.fetch = mockFetchResponse(mockResults);
    render(<RestaurantSearch onSelect={jest.fn()} onClose={() => {}} />);
    const input = screen.getByPlaceholderText(/zip code/i);
    fireEvent.change(input, { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));
  }

  test('transitions to results after valid zip submission', async () => {
    submitZipAndLoadResults();
    await waitFor(() => {
      expect(screen.getByText('Pizza Palace')).toBeInTheDocument();
    });
    expect(screen.getByText('📍 10001')).toBeInTheDocument();
  });

  test('shows keyword filter input after search', async () => {
    submitZipAndLoadResults();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/filter by keyword/i)).toBeInTheDocument();
    });
  });

  test('renders all search results', async () => {
    submitZipAndLoadResults();
    await waitFor(() => {
      expect(screen.getByText('Pizza Palace')).toBeInTheDocument();
      expect(screen.getByText('Existing Sushi')).toBeInTheDocument();
      expect(screen.getByText('Taco Spot')).toBeInTheDocument();
    });
  });

  test('greys out duplicate restaurants with label', async () => {
    submitZipAndLoadResults();
    await waitFor(() => {
      expect(screen.getByText('(already in list)')).toBeInTheDocument();
    });
    const duplicateItem = screen.getByText('Existing Sushi').closest('.search-result-item');
    expect(duplicateItem).toHaveClass('already-added');
  });

  test('non-duplicate items do not have already-added class', async () => {
    submitZipAndLoadResults();
    await waitFor(() => {
      const pizzaItem = screen.getByText('Pizza Palace').closest('.search-result-item');
      expect(pizzaItem).not.toHaveClass('already-added');
    });
  });

  test('shows add icon for non-duplicate items only', async () => {
    submitZipAndLoadResults();
    await waitFor(() => {
      const addIcons = screen.getAllByText('＋');
      expect(addIcons).toHaveLength(2);
    });
  });
});

describe('RestaurantSearch pagination', () => {
  test('shows pagination controls when results are present', async () => {
    global.fetch = mockFetchResponse(mockResults, 'next_token_123');
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('Page 1')).toBeInTheDocument();
      expect(screen.getByText('Next →')).toBeInTheDocument();
      expect(screen.getByText('← Previous')).toBeInTheDocument();
    });
  });

  test('Previous button is disabled on first page', async () => {
    global.fetch = mockFetchResponse(mockResults, 'next_token_123');
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('← Previous')).toBeDisabled();
    });
  });

  test('Next button is disabled when no nextPageToken', async () => {
    global.fetch = mockFetchResponse(mockResults, null);
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('Next →')).toBeDisabled();
    });
  });
});

describe('RestaurantSearch hide duplicates toggle', () => {
  test('shows hide duplicates toggle', async () => {
    global.fetch = mockFetchResponse(mockResults);
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('Hide already added')).toBeInTheDocument();
    });
  });

  test('persists hide duplicates preference to localStorage', async () => {
    global.fetch = mockFetchResponse(mockResults);
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('Hide already added')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(localStorage.getItem('lr_hide_duplicates')).toBe('true');
  });
});

describe('RestaurantSearch selection', () => {
  test('calls onSelect with correct payload when non-duplicate is clicked', async () => {
    const onSelect = jest.fn();
    global.fetch = mockFetchResponse(mockResults);
    render(<RestaurantSearch onSelect={onSelect} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('Pizza Palace')).toBeInTheDocument();
    });

    const pizzaItem = screen.getByText('Pizza Palace').closest('.search-result-item');
    fireEvent.click(pizzaItem);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      name: 'Pizza Palace',
      cuisine: 'pizza',
      price_range: 2,
      address: '123 Main St',
      google_place_id: 'ChIJ_1',
    });
  });

  test('does not call onSelect when duplicate is clicked', async () => {
    const onSelect = jest.fn();
    global.fetch = mockFetchResponse(mockResults);
    render(<RestaurantSearch onSelect={onSelect} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('Existing Sushi')).toBeInTheDocument();
    });

    const sushiItem = screen.getByText('Existing Sushi').closest('.search-result-item');
    fireEvent.click(sushiItem);

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('RestaurantSearch error handling', () => {
  test('shows error when API returns error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Google Places API is not configured.' }),
    });
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    });
  });

  test('shows error when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText(/failed to search/i)).toBeInTheDocument();
    });
  });

  test('shows empty state when no results found', async () => {
    global.fetch = mockFetchResponse([]);
    render(<RestaurantSearch onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), { target: { value: '10001' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText(/no restaurants found/i)).toBeInTheDocument();
    });
  });
});
