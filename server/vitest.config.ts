import { defineConfig } from 'vitest/config';

// Smoke tests are hermetic: pure logic only, no database and no network. They run
// in CI before the build to catch regressions on the money paths (PHI gating,
// claim lifecycle, plan caps, auth tokens, AI-off fallbacks).
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
  },
});
