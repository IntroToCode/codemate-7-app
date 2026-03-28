import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminDashboard from '../pages/AdminDashboard';
import { UserProvider } from '../context/UserContext';

beforeEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

function renderWithUser(isAdmin, userName = 'Alice') {
  const mockContext = { userName, isAdmin, adminName: 'Alice', adminLoading: false };
  jest.spyOn(require('../context/UserContext'), 'useUser').mockReturnValue(mockContext);
}

function mockFetchSequence(responses) {
  let callIndex = 0;
  global.fetch = jest.fn(() => {
    const response = responses[callIndex] || { ok: true, json: () => Promise.resolve([]) };
    callIndex++;
    return Promise.resolve({
      ok: response.ok !== undefined ? response.ok : true,
      json: () => Promise.resolve(response.data),
    });
  });
}

const mockAdmins = [
  { username: 'Alice', promoted_by: 'Alice', created_at: '2024-01-01T00:00:00Z' },
];

const mockKnownUsers = ['Alice', 'Bob', 'Charlie'];

const mockRestaurants = [
  { id: '1', name: 'Test Burgers', cuisine: 'American', price_range: 2, address: '123 St', created_by: 'Alice', active: true, tags: [], avg_rating: null, rating_count: 0 },
];

describe('AdminDashboard - non-admin view', () => {
  test('shows locked overlay for non-admin', async () => {
    renderWithUser(false, 'Bob');
    mockFetchSequence([{ data: mockRestaurants }]);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Admin Only/)).toBeInTheDocument();
    });
  });

  test('does not show Manage Admins section for non-admin', async () => {
    renderWithUser(false, 'Bob');
    mockFetchSequence([{ data: mockRestaurants }]);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.queryByText('👥 Manage Admins')).not.toBeInTheDocument();
    });
  });
});

describe('AdminDashboard - admin view', () => {
  test('shows Manage Admins section for admin', async () => {
    renderWithUser(true);
    mockFetchSequence([
      { data: mockRestaurants },
      { data: mockAdmins },
      { data: mockKnownUsers },
    ]);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('👥 Manage Admins')).toBeInTheDocument();
    });
  });

  test('renders current admins list', async () => {
    renderWithUser(true);
    mockFetchSequence([
      { data: mockRestaurants },
      { data: mockAdmins },
      { data: mockKnownUsers },
    ]);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Current Admins')).toBeInTheDocument();
      expect(screen.getAllByText(/Alice/).length).toBeGreaterThanOrEqual(1);
    });
  });

  test('shows (you) badge next to current admin', async () => {
    renderWithUser(true);
    mockFetchSequence([
      { data: mockRestaurants },
      { data: mockAdmins },
      { data: mockKnownUsers },
    ]);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('(you)')).toBeInTheDocument();
    });
  });

  test('disables demote button for own entry', async () => {
    renderWithUser(true);
    mockFetchSequence([
      { data: mockRestaurants },
      { data: mockAdmins },
      { data: mockKnownUsers },
    ]);

    render(<AdminDashboard />);

    await waitFor(() => {
      const demoteButtons = screen.getAllByText('🚫 Demote');
      const ownDemote = demoteButtons[0];
      expect(ownDemote).toBeDisabled();
    });
  });

  test('renders dropdown with non-admin users', async () => {
    renderWithUser(true);
    mockFetchSequence([
      { data: mockRestaurants },
      { data: mockAdmins },
      { data: mockKnownUsers },
    ]);

    render(<AdminDashboard />);

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(2);
      expect(options[0].textContent).toBe('Bob');
      expect(options[1].textContent).toBe('Charlie');
    });
  });

  test('promote button calls correct API', async () => {
    renderWithUser(true);
    mockFetchSequence([
      { data: mockRestaurants },
      { data: mockAdmins },
      { data: mockKnownUsers },
      { data: { promoted: 'Bob' } },
      { data: [...mockAdmins, { username: 'Bob', promoted_by: 'Alice', created_at: '2024-01-02T00:00:00Z' }] },
      { data: mockKnownUsers },
    ]);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('✅ Promote')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✅ Promote'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/admins/promote', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user: 'Alice', target: 'Bob' }),
      }));
    });
  });

  test('demote button calls correct API for other admins', async () => {
    const twoAdmins = [
      ...mockAdmins,
      { username: 'Bob', promoted_by: 'Alice', created_at: '2024-01-02T00:00:00Z' },
    ];
    renderWithUser(true);
    mockFetchSequence([
      { data: mockRestaurants },
      { data: twoAdmins },
      { data: mockKnownUsers },
      { data: { demoted: 'Bob' } },
      { data: mockAdmins },
      { data: mockKnownUsers },
    ]);

    render(<AdminDashboard />);

    await waitFor(() => {
      const demoteButtons = screen.getAllByText('🚫 Demote');
      expect(demoteButtons).toHaveLength(2);
      expect(demoteButtons[1]).not.toBeDisabled();
    });

    const demoteButtons = screen.getAllByText('🚫 Demote');
    fireEvent.click(demoteButtons[1]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/admins/demote', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user: 'Alice', target: 'Bob' }),
      }));
    });
  });
});
