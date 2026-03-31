const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5000',
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
  },
  webServer: {
    command: 'node server.js',
    cwd: './server',
    url: 'http://127.0.0.1:5000/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});