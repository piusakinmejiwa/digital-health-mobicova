// Sentry initialisation. This file MUST be imported before anything else in the
// entrypoint (server.ts) so the SDK can instrument http, pg, express, etc. as
// their modules load. Gated on SENTRY_DSN: with no DSN this is inert — errors
// still fall through to the console, nothing breaks, no data leaves the server.

import * as Sentry from '@sentry/node';
import { env } from './config/env';

export const sentryEnabled = Boolean(env.sentryDsn);

if (sentryEnabled) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.appEnv,
    tracesSampleRate: env.sentryTracesSampleRate,
    // Health platform: never ship request bodies / headers that could carry PHI.
    sendDefaultPii: false,
  });
}
