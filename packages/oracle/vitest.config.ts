import { defineConfig } from 'vitest/config';

export default defineConfig({
  // This package is a pure Node backend service — no React, no CSS imports
  // anywhere. Vite resolves its `css.postcss` option eagerly as part of
  // building the resolved config, regardless of whether tests ever touch
  // CSS (test.css:false does not prevent this — that only governs test-time
  // CSS *transform* behavior, a separate, later step). Left unset, that
  // resolution walks up from cwd looking for a postcss config, finds the
  // monorepo root's (the Next.js frontend's own postcss.config.mjs), and
  // tries to load it — needing @tailwindcss/postcss, a dependency this
  // package doesn't have and has no reason to. An explicit (empty) inline
  // value here short-circuits that filesystem search entirely. Only
  // surfaced once real test files existed to run (previously every CI run
  // exited via passWithNoTests before Vite ever resolved this far); the
  // live EC2 deploy never showed it only because its root node_modules
  // happens to already have that package installed for the frontend,
  // unlike CI's scoped oracle-only install.
  css: { postcss: {} },
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    testTimeout: 10000,
  },
});
