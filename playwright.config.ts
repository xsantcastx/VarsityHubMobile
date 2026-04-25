import { defineConfig, devices } from '@playwright/test';

const skipEmbeddedServer = process.env.PLAYWRIGHT_SKIP_SERVER === '1';
process.env.API_URL = process.env.API_URL || 'http://localhost:4000';

const webServerConfig = skipEmbeddedServer
  ? undefined
  : [
      {
        command: 'NODE_ENV=development ENABLE_DEV_CODES=1 npm run server:dev',
        url: `${process.env.API_URL}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
      {
        command: 'npm run web:playwright',
        url: 'http://localhost:8081',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
    ];

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/server/**',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/smoke-results.json' }],
    ['junit', { outputFile: 'test-results/smoke-results.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  ...(webServerConfig ? { webServer: webServerConfig } : {}),

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalTimeout: 10 * 60 * 1000,
});
