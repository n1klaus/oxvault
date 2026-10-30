import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@oxvault/shared': path.resolve(import.meta.dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: 8000,
    strictPort: true,
    cors: false, // Always enable CORS for local dev; origin check in production
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
