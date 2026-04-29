const { defineConfig, devices } = require('@playwright/test');

const webBaseUrl = process.env.WEB_PANEL_BASE_URL || 'http://localhost:3000';

module.exports = defineConfig({
  testDir: './tests/smoke',
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
