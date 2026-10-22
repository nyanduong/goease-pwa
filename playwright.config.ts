import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5180', channel: 'msedge' },
  webServer: [
    {
      command: 'pnpm --filter @goease/server start',
      url: 'http://127.0.0.1:3000/api/v1/health',
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        CLIENT_ORIGIN: 'http://127.0.0.1:5180',
        MONGODB_URI: 'mongodb://127.0.0.1:27020/goease_f0_test',
        PORT: '3000',
        HOST: '127.0.0.1',
      },
    },
    {
      command: 'pnpm --filter @goease/client dev',
      url: 'http://127.0.0.1:5180',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
