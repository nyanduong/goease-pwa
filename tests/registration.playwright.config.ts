import { defineConfig } from '@playwright/test';
import { e2eWebOrigin } from './ports.js';

export default defineConfig({
  testDir: '.',
  testMatch: 'registration-otp.spec.ts',
  workers: 1,
  outputDir: '../test-results/registration-browser',
  use: { baseURL: e2eWebOrigin, channel: 'msedge' },
  webServer: {
    command:
      'npm run dev --workspace @goease/client -- --config ../tests/vite.config.mts',
    url: e2eWebOrigin,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
