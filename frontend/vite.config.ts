import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({ open: false, filename: 'stats.html', gzipSize: true, brotliSize: true }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;

          // Heavy components
          if (id.includes('emoji-picker-react')) {
            return 'vendor-emoji';
          }

          // Core React libraries
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'vendor-core';
          }

          // UI and Icons
          if (id.includes('lucide-react')) {
            return 'vendor-ui';
          }

          // Utilities
          if (id.includes('lodash') || id.includes('date-fns') || id.includes('axios')) {
            return 'vendor-utils';
          }

          return 'vendor';

        },
      },
    },
  },
});

