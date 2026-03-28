const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5000',
    headless: true,
  },
  webServer: {
    command: 'cd .. && node server/server.js',
    port: 5000,
    reuseExistingServer: true,
    timeout: 10000,
  },
});
