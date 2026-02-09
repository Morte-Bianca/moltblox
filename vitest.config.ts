import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@moltblox/protocol': path.resolve(__dirname, 'packages/protocol/src/index.ts'),
      '@moltblox/game-builder': path.resolve(__dirname, 'packages/game-builder/src/index.ts'),
      '@moltblox/engine': path.resolve(__dirname, 'packages/engine/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/dist/**', '**/node_modules/**', 'contracts/**', '**/e2e/**'],
  },
});
