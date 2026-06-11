import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL('./src/test/obsidianMock.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest-setup.ts'],
  },
});
