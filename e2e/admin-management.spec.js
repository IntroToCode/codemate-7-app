const { test, expect } = require('@playwright/test');

test.describe('Admin Management E2E', () => {
  test('first user registers as admin', async ({ request }) => {
    const res = await request.post('/api/settings/register', {
      data: { user: 'AdminUser' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.is_admin).toBe(true);
  });

  test('admin can promote another user to admin', async ({ request }) => {
    await request.post('/api/settings/register', { data: { user: 'AdminUser' } });

    const promoteRes = await request.post('/api/settings/admins/promote', {
      data: { user: 'AdminUser', target: 'RegularUser' },
    });
    expect(promoteRes.ok()).toBeTruthy();
    const body = await promoteRes.json();
    expect(body.promoted).toBe('RegularUser');
  });

  test('promoted user gains admin access', async ({ request }) => {
    const settingsRes = await request.get('/api/settings?user=RegularUser');
    expect(settingsRes.ok()).toBeTruthy();
    const body = await settingsRes.json();
    expect(body.is_admin).toBe(true);
  });

  test('admin can demote another admin', async ({ request }) => {
    const demoteRes = await request.post('/api/settings/admins/demote', {
      data: { user: 'AdminUser', target: 'RegularUser' },
    });
    expect(demoteRes.ok()).toBeTruthy();
    const body = await demoteRes.json();
    expect(body.demoted).toBe('RegularUser');
  });

  test('demoted user loses admin access', async ({ request }) => {
    const settingsRes = await request.get('/api/settings?user=RegularUser');
    expect(settingsRes.ok()).toBeTruthy();
    const body = await settingsRes.json();
    expect(body.is_admin).toBe(false);
  });

  test('admin cannot demote themselves', async ({ request }) => {
    const demoteRes = await request.post('/api/settings/admins/demote', {
      data: { user: 'AdminUser', target: 'AdminUser' },
    });
    expect(demoteRes.status()).toBe(400);
  });

  test('non-admin cannot promote users', async ({ request }) => {
    const promoteRes = await request.post('/api/settings/admins/promote', {
      data: { user: 'RegularUser', target: 'AnotherUser' },
    });
    expect(promoteRes.status()).toBe(403);
  });

  test('non-admin cannot demote admins', async ({ request }) => {
    const demoteRes = await request.post('/api/settings/admins/demote', {
      data: { user: 'RegularUser', target: 'AdminUser' },
    });
    expect(demoteRes.status()).toBe(403);
  });

  test('admins list endpoint returns current admins', async ({ request }) => {
    const res = await request.get('/api/settings/admins');
    expect(res.ok()).toBeTruthy();
    const admins = await res.json();
    expect(Array.isArray(admins)).toBe(true);
    const usernames = admins.map(a => a.username);
    expect(usernames).toContain('AdminUser');
  });

  test('known-users endpoint returns aggregated users', async ({ request }) => {
    const res = await request.get('/api/settings/known-users');
    expect(res.ok()).toBeTruthy();
    const users = await res.json();
    expect(Array.isArray(users)).toBe(true);
  });
});
