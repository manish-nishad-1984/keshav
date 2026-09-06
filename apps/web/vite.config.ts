import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    commonjsOptions: {
      // Workspace packages are symlinked in from outside node_modules, so
      // Rollup's default node_modules-only CJS detection misses them,
      // leaving their compiled CommonJS output untransformed.
      include: [/node_modules/, /packages\/(shared|types)\/dist/],
    },
  },
});
