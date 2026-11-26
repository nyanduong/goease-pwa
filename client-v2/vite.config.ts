import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 5181,
    strictPort: true,
    proxy: {
      '/api/':
        loadEnv(mode, process.cwd(), 'GOEASE_').GOEASE_API_TARGET ??
        'http://localhost:3001',
    },
  },
}));
