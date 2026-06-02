import { Request, Response } from 'express';
import crypto from 'crypto';
import type Stripe from 'stripe';
import { stripe, stripeEnabled } from '../config/stripe';
import { paystackSecretKey, paystackEnabled } from '../config/paystack';
import { env } from '../config/env';
import { query } from '../config/database';

async function markEnrolmentPaid(enrolmentId: string, reference: string, provider: string): Promise<void> {
  await query(`UPDATE enrolments SET payment_status = 'paid' WHERE id = $1`, [enrolmentId]);
  console.log(`Premium paid for enrolment ${enrolmentId} via ${provider} (ref ${reference}).`);
}

// Stripe calls this server-to-server after a Checkout session resolves. It is the
// authoritative source of truth for payment — the browser redirect to
// success_url is just UX and must never be trusted to mark a premium paid.
//
// The raw (unparsed) request body is required for signature verification; that
// is wired up in app.ts via express.raw() on this exact path, registered before
// express.json().
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!stripeEnabled || !stripe) {
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }
  if (!env.stripeWebhookSecret) {
    console.error('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set.');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw Buffer from express.raw()
      signature as string,
      env.stripeWebhookSecret
    );
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const enrolmentId = session.metadata?.enrolmentId;
    if (enrolmentId) {
      await markEnrolmentPaid(enrolmentId, session.id, 'stripe');
    }
  }

  // Acknowledge receipt so Stripe stops retrying.
  res.json({ received: true });
}

// Paystack calls this server-to-server after a transaction resolves. Authenticity
// is verified with an HMAC-SHA512 of the raw body using the secret key (Paystack
// has no separate webhook secret). The raw body is provided by express.raw() —
// wired in app.ts on this exact path, before express.json().
export async function handlePaystackWebhook(req: Request, res: Response): Promise<void> {
  if (!paystackEnabled) {
    res.status(503).json({ error: 'Paystack not configured' });
    return;
  }

  const signature = req.headers['x-paystack-signature'];
  const expected = crypto
    .createHmac('sha512', paystackSecretKey)
    .update(req.body) // raw Buffer from express.raw()
    .digest('hex');
  if (typeof signature !== 'string' || signature !== expected) {
    console.error('Paystack webhook signature verification failed.');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const event = JSON.parse(req.body.toString('utf8')) as {
    event: string;
    data: { reference?: string; metadata?: { enrolmentId?: string } };
  };

  if (event.event === 'charge.success') {
    const enrolmentId = event.data.metadata?.enrolmentId;
    if (enrolmentId) {
      await markEnrolmentPaid(enrolmentId, event.data.reference || '', 'paystack');
    }
  }

  // Acknowledge receipt so Paystack stops retrying.
  res.json({ received: true });
}
