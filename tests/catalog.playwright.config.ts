import { defineConfig } from '@playwright/test';
import { e2eApiOrigin, e2eWebOrigin } from './ports.js';

export default defineConfig({
  testDir: '.',
  testMatch: [
    'catalog-operations.spec.ts',
    'geography.spec.ts',
    'province-import.spec.ts',
    'admin-campaigns.spec.ts',
    'admin-history.spec.ts',
    'admin-sources.spec.ts',
    'admin-settings.spec.ts',
  ],
  workers: 1,
  outputDir: '../test-results/catalog-browser',
  use: {
    baseURL: e2eWebOrigin,
    channel: 'msedge',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      cwd: process.cwd(),
      command: 'npm exec -- tsx tests/catalog-browser-server.mts',
      url: `${e2eApiOrigin}/api/v1/health/db`,
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      cwd: process.cwd(),
      command:
        'npm run dev --workspace @goease/client -- --config ../tests/vite.config.mts',
      url: e2eWebOrigin,
      timeout: 30000,
      reuseExistingServer: false,
    },
  ],
});
