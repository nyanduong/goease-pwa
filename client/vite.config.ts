import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const apiPort = Number(process.env.GOEASE_API_PORT ?? '3000');
const webPort = Number(process.env.GOEASE_WEB_PORT ?? '5181');
if (
  ![apiPort, webPort].every(
    (port) => Number.isInteger(port) && port >= 1 && port <= 65535,
  )
) {
  throw new Error(
    'GOEASE_WEB_PORT and GOEASE_API_PORT must be integers between 1 and 65535.',
  );
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: webPort,
    strictPort: true,
    proxy: { '/api/': `http://localhost:${apiPort}` },
  },
});
