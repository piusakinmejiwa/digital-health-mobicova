import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import publicApiRoutes from './routes/publicApi.routes';

const app = express();

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

// Raw body needed so payment-provider webhook signatures can be verified.
// Must be registered before express.json() so these paths keep the unparsed body.
app.use(
  ['/api/v1/billing/stripe/webhook', '/api/v1/billing/paystack/webhook'],
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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

export default app;
