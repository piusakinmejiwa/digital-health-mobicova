// Client-side error tracking (Sentry). Gated on VITE_SENTRY_DSN: with no DSN this
// is inert — the ErrorBoundary still shows a friendly fallback on a crash, it just
// doesn't report anywhere. Set VITE_SENTRY_DSN at build time to switch on reporting.

import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export const sentryEnabled = Boolean(dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0),
    // Don't attach IP / cookies — this is a health product.
    sendDefaultPii: false,
  });
}
