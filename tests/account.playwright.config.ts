import { defineConfig } from '@playwright/test';
import { e2eWebOrigin } from './ports.js';

// Browser routes mock account/provider responses; no API or MongoDB needed.
export default defineConfig({
  testDir: '.',
  testMatch: ['account-avatar-upload.spec.ts', 'connection-recovery.spec.ts'],
  workers: 1,
  outputDir: '../test-results/account-browser',
  use: { baseURL: e2eWebOrigin, channel: 'msedge' },
  webServer: {
    command:
      'npm run dev --workspace @goease/client -- --config ../tests/vite.config.mts',
    url: e2eWebOrigin,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
