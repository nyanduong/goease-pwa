import { mergeConfig } from 'vite';
import clientConfig from '../client/vite.config.js';
// Stable review surface: reload manually after edits; never hot-reload a decision halfway through.
export default mergeConfig(clientConfig, {
  server: {
    port: 5182,
    hmr: false,
    proxy: { '/api': 'http://localhost:3002' },
  },
});
