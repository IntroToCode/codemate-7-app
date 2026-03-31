const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '..');
const runId = `issue38${Date.now().toString(36)}`;
const firstName = `E2E${runId}`;
const profileName = `${firstName} Filter`;

function seed(command) {
  return execFileSync(
    'node',
    ['server/scripts/seedRecentFilterScenario.js', command, runId],
    { cwd: repoRoot, encoding: 'utf8' }
  );
}

test.beforeAll(() => {
  seed('seed');
});

test.afterAll(() => {
  seed('cleanup');
});

test('preserves cuisine/price filters while enforcing the 7-day exclusion flow', async ({ page }) => {
  await page.goto('/');

  await page.locator('select.name-entry-select').selectOption({ label: profileName });
  await page.getByPlaceholder('Enter your password').fill('pw1234');
  await page.getByRole('button', { name: /let's eat/i }).click();

  await page.getByLabel('Cuisine').selectOption('Italian');
  await page.locator('.spin-price-btn').filter({ hasText: /^\$\$$/ }).click();

  await expect(page.getByText(/all active restaurants were picked in the last 7 days/i)).toBeVisible();
  await expect(page.getByText(/no restaurants match your filters/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /spin the wheel/i })).toHaveCount(0);

  await page.getByLabel(/skip recently visited/i).uncheck();

  await expect(page.getByRole('button', { name: /spin the wheel/i })).toBeVisible();
  await expect(page.getByText(`${runId} Italian Recent A`)).toBeVisible();
  await expect(page.getByText(`${runId} Italian Recent B`)).toBeVisible();
  await expect(page.getByText(`${runId} Italian Premium`)).toHaveCount(0);
  await expect(page.getByText(`${runId} Mexican Budget`)).toHaveCount(0);

  await page.getByRole('button', { name: /spin the wheel/i }).click();
  await expect(page.getByText(/today's lunch pick is/i)).toBeVisible({ timeout: 15_000 });

  const resultName = page.locator('.result-name');
  await expect(resultName).toContainText(new RegExp(`${runId} Italian Recent (A|B)`));
});