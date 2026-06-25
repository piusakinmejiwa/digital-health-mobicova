import { Request, Response } from 'express';
import { env } from '../config/env';
import { sendSms, smsConfigured } from '../lib/messaging';

// POST /diag/test-sms  { to }   header: x-diag-secret
// Sends one test SMS and returns Africa's Talking's *raw* outcome so we can see
// the exact rejection reason (which the OTP path swallows into an email
// fallback). Deliberately locked down:
//   • only works in SANDBOX mode  → can never trigger a real, billed send
//   • requires the same shared secret as the Health Tips cron
// Returns 404 when those guards aren't met so the endpoint is invisible.
export async function testSms(req: Request, res: Response): Promise<void> {
  const secret = env.healthTipsCronSecret;
  const presented = String(req.header('x-diag-secret') || '');
  if (!secret || presented !== secret || !env.atSandbox) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const to = String(req.body?.to || '').trim();
  if (!to) {
    res.status(400).json({ error: 'Provide { "to": "+234…" }.' });
    return;
  }

  if (!smsConfigured()) {
    res.json({ attempted: false, smsConfigured: false, reason: 'AT_USERNAME / AT_API_KEY not set' });
    return;
  }

  const outcome = await sendSms(to, 'MobiCova SMS diagnostic — please ignore.');
  // Non-secret view of the auth triplet, to localise a 401 without leaking the
  // key: username (not secret), which host we hit, and the *shape* of the key.
  const key = env.atApiKey;
  res.json({
    attempted: true,
    to,
    config: {
      username: env.atUsername,
      host: env.atSandbox ? 'sandbox' : 'live',
      keyLength: key.length,
      keyHasSurroundingWhitespace: key !== key.trim(),
      keyLooksLikeAtKey: key.startsWith('atsk_'),
    },
    outcome,
  });
}
