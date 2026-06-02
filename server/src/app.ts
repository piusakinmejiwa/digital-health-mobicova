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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/v1/auth', authLimiter);

// Raw body needed so payment-provider webhook signatures can be verified.
// Must be registered before express.json() so these paths keep the unparsed body.
app.use(
  ['/api/v1/billing/stripe/webhook', '/api/v1/billing/paystack/webhook'],
  express.raw({ type: '*/*' })
);
app.use(express.json());
// USSD gateways (Africa's Talking et al.) post application/x-www-form-urlencoded.
app.use(express.urlencoded({ extended: false }));

app.use('/api/v1', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

export default app;
