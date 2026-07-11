/**
 * @module vite.config
 * @description Vite configuration for the React frontend application.
 * Configures React plugin, TypeScript support, path aliases, and proxy settings for API calls.
 * @since 2025-10-20
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, './src/components'),
      '@app-types': path.resolve(__dirname, './src/types'),
      '@services': path.resolve(__dirname, './src/services'),
    },
  },
});
