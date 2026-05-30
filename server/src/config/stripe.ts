import Stripe from 'stripe';
import { env } from './env';

export const stripe = env.stripeSecretKey
  ? new Stripe(env.stripeSecretKey)
  : null;

export const stripeEnabled = !!stripe;
