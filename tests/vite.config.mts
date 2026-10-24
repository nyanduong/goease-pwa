import { mergeConfig } from 'vite';
import clientConfig from '../client/vite.config.js';
import { e2eApiOrigin, e2eWebPort } from './ports.js';

// Test-only override: keep the dev server and its default ports untouched.
export default mergeConfig(clientConfig, {
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(e2eApiOrigin) },
  server: { port: e2eWebPort, proxy: { '/api': e2eApiOrigin } },
});
