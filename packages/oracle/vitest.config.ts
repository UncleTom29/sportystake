import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // This package is a pure Node backend service — no React, no CSS
    // imports anywhere. Without this, Vite's CSS pipeline walks up from cwd
    // looking for a PostCSS config, finds the monorepo root's (the Next.js
    // frontend's own postcss.config.mjs), and tries to load it — which
    // needs @tailwindcss/postcss, a dependency this package doesn't have
    // and has no reason to. Only surfaced once real test files existed to
    // actually run the pipeline (previously always passWithNoTests-exited
    // first); the live EC2 deploy never showed it only because its root
    // node_modules happens to already have that package installed for the
    // frontend, unlike CI's scoped oracle-only install.
    css: false,
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    testTimeout: 10000,
  },
});
