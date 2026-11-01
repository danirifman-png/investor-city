import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any static host or sub-path.
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
} as any);
