import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: 'http://localhost:5180', channel: 'msedge' },
  webServer: [
    {
      command: 'npm run start --workspace @goease/server',
      url: 'http://localhost:3000/api/v1/health',
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        CLIENT_ORIGIN: 'http://localhost:5180',
        MONGODB_URI: 'mongodb://127.0.0.1:27020/goease_f0_test',
        PORT: '3000',
        HOST: 'localhost',
      },
    },
    {
      command: 'npm run dev --workspace @goease/client',
      url: 'http://localhost:5180',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
