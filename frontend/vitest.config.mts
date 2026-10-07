import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./shared/test/setup.ts'],
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:8020',
    },
    include: [
      'shared/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'features/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'widgets/**/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['node_modules', '.next', 'app/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', '.next', 'app/**', 'shared/test/**'],
    },
  },
});
