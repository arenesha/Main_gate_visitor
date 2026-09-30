import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Main_gate_visitor/',

  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api/dispatch-email': {
        target: 'http://localhost:8005',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true
      }
    }
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});