import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: '[name]-[hash].mjs',
        chunkFileNames: '[name]-[hash].mjs',
        assetFileNames: '[name]-[hash].[ext]'
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api/apartments': {
        target: 'https://vilpas.kiinteistomaailma.fi',
        changeOrigin: true,
        rewrite: (path) => '/export/km/listings/baseline.json',
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('X-Client-Info', 'norr3-marketing-dashboard');
            proxyReq.setHeader('Accept', 'application/json');
            proxyReq.setHeader('Origin', 'https://vilpas.kiinteistomaailma.fi');
          });
          proxy.on('error', (err, req, res) => {
            console.error('Proxy error:', err);
            // Send a proper error response
            res.writeHead(500, {
              'Content-Type': 'application/json',
            });
            res.end(JSON.stringify({ error: 'Proxy error occurred' }));
          });
          // Handle CORS preflight
          proxy.on('proxyRes', (proxyRes, req, res) => {
            proxyRes.headers['access-control-allow-origin'] = '*';
            proxyRes.headers['access-control-allow-methods'] = 'GET, OPTIONS';
            proxyRes.headers['access-control-allow-headers'] = 'X-Client-Info, Accept';
          });
        }
      },
    },
  },
});
