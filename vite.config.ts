import { defineConfig } from 'vite';

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
