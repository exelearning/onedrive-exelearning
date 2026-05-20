import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/onedrive-exelearning/',
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
