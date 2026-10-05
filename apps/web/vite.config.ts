import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Dev server only: the workspace packages' dist is CommonJS (for the API), and Vite's dev
      // server serves linked packages as-is, so the browser can't read their named exports
      // ("does not provide an export named …"). Point dev at the TypeScript source instead.
      // Production builds keep using dist via the commonjsOptions below.
      ...(command === 'serve'
        ? {
            '@ckfast/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
            '@ckfast/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
          }
        : {}),
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
}));
