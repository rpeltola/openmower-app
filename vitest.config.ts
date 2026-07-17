import react from '@vitejs/plugin-react';
import path from 'node:path';
import {defineConfig} from 'vitest/config';

// Minimal, CI-runnable component-test setup (Next.js app, App Router — no next/jest since we
// don't need Next's build pipeline for these unit/component tests, just React + jsdom).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
    css: false,
  },
});
