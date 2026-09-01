import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The TOUR journeys mock Wikipedia with page.route(). A previously registered
    // service worker can satisfy requests before Playwright routing sees them,
    // especially in WebKit, which makes the privacy assertion non-deterministic.
    // The service-worker asset itself is verified independently by FF-ESC-008.
    serviceWorkers: 'block',
    geolocation: { latitude: 29.7382, longitude: -98.1047 },
    permissions: ['geolocation']
  },
  projects: [
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } }
  ],
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI
  }
});
