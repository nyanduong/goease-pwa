import { defineConfig } from '@playwright/test';
import { e2eApiOrigin, e2eApiPort, e2eWebOrigin } from './tests/ports.js';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['catalog-operations.spec.ts', 'geography.spec.ts'],
  workers: 1,
  use: { baseURL: e2eWebOrigin, channel: 'msedge' },
  webServer: [
    {
      command: 'npm run start --workspace @goease/server',
      url: `${e2eApiOrigin}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        NODE_ENV: 'development',
        SMTP_HOST: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        MAIL_FROM: '',
        GEOAPIFY_API_KEY: '',
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY:
          process.env.LIVE_GEMINI === '1'
            ? (process.env.GEMINI_API_KEY ?? '')
            : '',
        FULLDICHVU_API_KEY: '',
        // The full suite shares one loopback IP across many isolated accounts.
        AUTH_MAX_ATTEMPTS: '100',
        CLIENT_ORIGIN: e2eWebOrigin,
        MONGODB_URI:
          'mongodb://127.0.0.1:27020/goease_f0_test?replicaSet=goease_e2e',
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
