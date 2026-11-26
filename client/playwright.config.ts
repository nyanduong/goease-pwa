import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const workspaceRoot = fileURLToPath(new URL('..', import.meta.url));
const webUrl = 'http://localhost:5191';

export default defineConfig({
  testDir: './tests',
  outputDir: '../test-results/frontend-foundation',
  workers: 1,
  use: { baseURL: webUrl, channel: 'msedge' },
  webServer: {
    cwd: workspaceRoot,
    command: 'npm run dev',
    url: `${webUrl}/api/v1/health`,
    reuseExistingServer: false,
    env: { GOEASE_WEB_PORT: '5191', GOEASE_API_PORT: '3011' },
  },
});
