import express from 'express';
import * as Sentry from '@sentry/node';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { sentryEnabled } from './instrument';
import { query } from './config/database';
import { getMigrationStatus } from './lib/migrationStatus';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import publicApiRoutes from './routes/publicApi.routes';
import { smsConfigured, whatsappConfigured } from './lib/messaging';
import { pharmarunConfigured } from './lib/pharmacyFulfilment';
import { storageEnabled } from './config/storage';

const app = express();

// Render (and most PaaS) front the app with a proxy that sets X-Forwarded-For.
// Trust the first hop so express-rate-limit can see the real client IP instead
// of throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and lumping everyone together.
app.set('trust proxy', 1);

app.use(helmet());
// Allow the configured client origins (custom domain, Render URL, localhost).
// Requests without an Origin header (server-to-server, curl, the public API) are
// permitted — CORS only governs browsers.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || env.clientUrls.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Global throttle across the whole API as a baseline DoS / abuse guard. Inbound
// provider traffic (USSD/WhatsApp aggregators, payment webhooks) arrives from a
// small set of IPs and can legitimately burst, so it is exempted here — those
// endpoints verify signatures / session state of their own.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => req.originalUrl.includes('/channels/') || req.originalUrl.includes('/webhook'),
});
app.use('/api/v1', apiLimiter);

// Stricter limit on the auth endpoints to blunt credential brute-forcing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/v1/auth', authLimiter);

// Raw body needed so webhook signatures can be verified over the exact bytes the
// provider signed. Must be registered before express.json() so these paths keep
// the unparsed body: Stripe/Paystack (payments), Meta (WhatsApp X-Hub-Signature),
// PharmaRun (HMAC).
app.use(
  [
    '/api/v1/billing/stripe/webhook',
    '/api/v1/billing/paystack/webhook',
    '/api/v1/channels/whatsapp/webhook',
    '/api/v1/pharmarun/webhook',
  ],
  express.raw({ type: '*/*' })
);
// 2 MB accommodates a bulk member import (up to ~1,000 rows) while still
// bounding request size as an abuse guard.
app.use(express.json({ limit: '2mb' }));
// USSD gateways (Africa's Talking et al.) post application/x-www-form-urlencoded.
app.use(express.urlencoded({ extended: false }));

app.use('/api/v1', routes);

// Public, API-key-authenticated REST surface for partner integrations. Its own
// versioned path, separate from the dashboard's internal /api/v1. Gets the same
// baseline throttle as the rest of the API.
app.use('/api/public/v1', apiLimiter, publicApiRoutes);

app.get('/health', async (_req, res) => {
  // Booleans only — confirms which integrations the running service can see,
  // without ever exposing a secret value. Handy for go-live ("is SMS wired?").
  // Also reports migration drift: applied vs total + any pending file names.
  const mig = await getMigrationStatus().catch(() => null);
  res.json({
    status: 'ok',
    version: env.gitCommit,
    integrations: {
      sms: smsConfigured(),
      smsSandbox: env.atSandbox,
      whatsapp: whatsappConfigured(),
      video: !!env.dailyApiKey,
      geocode: !!env.geocodeApiKey,
      pharmarun: pharmarunConfigured(),
      documents: storageEnabled,
      email: !!env.resendApiKey,
      reportsCron: !!env.reportsCronSecret,
      errorTracking: sentryEnabled,
      otpDevMode: env.otpDevMode,
    },
    migrations: mig && mig.available
      ? { applied: mig.applied, total: mig.total, ok: mig.ok, pending: mig.pending, unknown: mig.unknown }
      : { available: false },
  });
});

// Liveness — the process is up and serving. Cheap and dependency-free; point an
// uptime monitor (UptimeRobot / Better Stack) and the platform health check here.
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

// Readiness — the database is reachable, and (in strict mode) the schema matches
// the code. 503 lets a monitor distinguish "process alive but not ready" from healthy.
app.get('/readyz', async (_req, res) => {
  try {
    await query('SELECT 1');
  } catch {
    res.status(503).json({ status: 'unavailable', db: false });
    return;
  }
  if (env.migrationsStrict) {
    const mig = await getMigrationStatus().catch(() => null);
    if (mig && mig.available && mig.pending.length > 0) {
      res.status(503).json({ status: 'unavailable', db: true, pendingMigrations: mig.pending });
      return;
    }
  }
  res.json({ status: 'ok', db: true });
});

// Sentry's Express error handler must sit after the routes and before our own —
// it captures the error, then passes it on so errorHandler still sends the 500.
if (sentryEnabled) Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

export default app;
