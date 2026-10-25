import { defineConfig } from '@playwright/test';
import catalog from './catalog.playwright.config.js';
// Separate owned fixture server: this test creates a place and must not affect catalog count assertions.
export default defineConfig({
  ...catalog,
  testMatch: ['admin-visit-editor.spec.ts'],
  outputDir: '../test-results/price-editor',
});
