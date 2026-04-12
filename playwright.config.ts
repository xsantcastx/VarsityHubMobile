import { defineConfig, devices } from '@playwright/test';

const skipEmbeddedServer = process.env.PLAYWRIGHT_SKIP_SERVER === '1';
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';
const expoApiUrl = process.env.EXPO_PUBLIC_API_URL || apiUrl;

process.env.API_URL = apiUrl;
process.env.EXPO_PUBLIC_API_URL = expoApiUrl;

const webServerConfig = skipEmbeddedServer
  ? undefined
  : [
      {
        command: 'bash scripts/start-smoke-api.sh',
        url: `${apiUrl}/health`,
        reuseExistingServer: false,
        timeout: 120 * 1000,
      },
      {
        command: `EXPO_PUBLIC_API_URL=${expoApiUrl} npm run web:playwright`,
        url: 'http://localhost:8081',
        reuseExistingServer: !process.env.CI,
        timeout: 300 * 1000,
      },
    ];

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/server/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
