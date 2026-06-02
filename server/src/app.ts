import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));

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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

export default app;
