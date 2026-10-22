import { defineConfig } from '@playwright/test';
import { e2eApiOrigin, e2eApiPort, e2eWebOrigin } from './tests/ports.js';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: e2eWebOrigin, channel: 'msedge' },
  webServer: [
    {
      command: 'npm run start --workspace @goease/server',
      url: `${e2eApiOrigin}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        CLIENT_ORIGIN: e2eWebOrigin,
        MONGODB_URI: 'mongodb://127.0.0.1:27020/goease_f0_test',
        PORT: String(e2eApiPort),
        HOST: 'localhost',
      },
    },
    {
      command:
        'npm run dev --workspace @goease/client -- --config ../tests/vite.config.mts',
      url: e2eWebOrigin,
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
