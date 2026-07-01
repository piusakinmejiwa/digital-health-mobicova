import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { sendEmail } from '../lib/email';
import { sendSms, sendWhatsApp, smsConfigured, whatsappConfigured } from '../lib/messaging';
import { constantTimeEqual } from '../lib/safeCompare';

const CHANNELS = ['sms', 'whatsapp', 'email'] as const;
type Channel = (typeof CHANNELS)[number];

// ── Public: subscribe ──────────────────────────────────────────────────────
// Register for Daily Health Tips. Name + at least one contact channel. Dedupes
// on email (then SMS) so re-registering updates rather than duplicating.
export async function subscribeHealthTips(req: Request, res: Response): Promise<void> {
  const fullName = String(req.body?.fullName || '').trim().slice(0, 160);
  const sms = String(req.body?.smsNumber || '').trim().slice(0, 40);
  const whatsapp = String(req.body?.whatsappNumber || '').trim().slice(0, 40);
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 255);
  const consent = Boolean(req.body?.consent);

  const requested: Channel[] = Array.isArray(req.body?.channels)
    ? req.body.channels.filter((c: string): c is Channel => (CHANNELS as readonly string[]).includes(c))
    : [];
  // Only keep channels the subscriber actually gave a destination for.
  const channels = requested.filter((c) =>
    (c === 'sms' && sms) || (c === 'whatsapp' && whatsapp) || (c === 'email' && email));

  if (!fullName) { res.status(400).json({ error: 'Please enter your full name.' }); return; }
  if (email && !/.+@.+\..+/.test(email)) { res.status(400).json({ error: 'Enter a valid email address.' }); return; }
  if (channels.length === 0) {
    res.status(400).json({ error: 'Add at least one contact (SMS, WhatsApp or email) and tick the channel(s) to receive tips on.' });
    return;
  }
  if (!consent) { res.status(400).json({ error: 'Please agree to receive health tips.' }); return; }

  // Find an existing subscriber to update (email is the most stable key).
  let existing = null as { id: string } | null;
  if (email) {
    const r = await query('SELECT id FROM health_tip_subscribers WHERE email = $1 LIMIT 1', [email]);
    existing = r.rows[0] ?? null;
  }
  if (!existing && sms) {
    const r = await query('SELECT id FROM health_tip_subscribers WHERE sms_number = $1 LIMIT 1', [sms]);
    existing = r.rows[0] ?? null;
  }

  if (existing) {
    await query(
      `UPDATE health_tip_subscribers
          SET full_name = $2, sms_number = $3, whatsapp_number = $4, email = $5,
              channels = $6, consent = $7, is_active = true
        WHERE id = $1`,
      [existing.id, fullName, sms, whatsapp, email, channels, consent]
    );
  } else {
    await query(
      `INSERT INTO health_tip_subscribers (full_name, sms_number, whatsapp_number, email, channels, consent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fullName, sms, whatsapp, email, channels, consent]
    );
  }

  res.status(201).json({ subscribed: true, channels });
}

// ── Public: unsubscribe ────────────────────────────────────────────────────
export async function unsubscribeHealthTips(req: Request, res: Response): Promise<void> {
  const token = String(req.body?.token || req.query?.token || '').trim();
  if (!token) { res.status(400).json({ error: 'Missing unsubscribe token.' }); return; }
  const r = await query(
    `UPDATE health_tip_subscribers SET is_active = false WHERE unsubscribe_token = $1 RETURNING id`,
    [token]
  );
  res.json({ unsubscribed: r.rows.length > 0 });
}

// ── The daily send engine ──────────────────────────────────────────────────
type SendSummary = {
  tip: { id: string; title: string } | null;
  subscribers: number;
  sent: Record<string, number>;
  failed: Record<string, number>;
  skipped: number;
  configured: { email: boolean; sms: boolean; whatsapp: boolean };
};

function plainText(tip: { title: string; body: string }): string {
  return `MobiCova Daily Health Tip — ${tip.title}\n\n${tip.body}`;
}

async function deliver(channel: Channel, dest: string, tip: { title: string; body: string }, unsubToken: string) {
  if (channel === 'email') {
    const unsub = `${env.clientUrl}/health-tips/unsubscribe?token=${unsubToken}`;
    return sendEmail({
      to: dest,
      subject: `Your daily health tip — ${tip.title}`,
      html: `<div style="font:15px/1.6 Arial,sans-serif;color:#1f2d2b;max-width:560px">
        <h2 style="color:#0a7b7b;margin:0 0 6px">${tip.title}</h2>
        <p style="margin:0 0 16px">${tip.body}</p>
        <hr style="border:none;border-top:1px solid #e3eded;margin:18px 0">
        <p style="color:#5e6e6e;font-size:12px">You’re receiving MobiCova Daily Health Tips. This is general guidance, not a diagnosis.
        <a href="${unsub}" style="color:#5e6e6e">Unsubscribe</a>.</p>
      </div>`,
      text: `${plainText(tip)}\n\nUnsubscribe: ${unsub}`,
    }).then((r) => ({ ok: r.sent, error: r.error }));
  }
  if (channel === 'sms') return sendSms(dest, `${plainText(tip)}\nReply STOP to opt out.`);
  return sendWhatsApp(dest, plainText(tip));
}

// Send today's tip to every active subscriber on their chosen channels. Idempotent
// per (subscriber, channel, day): a UNIQUE row is claimed before sending, so re-running
// (manual + cron on the same day) never double-sends.
export async function sendDailyTips(): Promise<SendSummary> {
  const configured = { email: true, sms: smsConfigured(), whatsapp: whatsappConfigured() };
  const summary: SendSummary = {
    tip: null, subscribers: 0,
    sent: { email: 0, sms: 0, whatsapp: 0 },
    failed: { email: 0, sms: 0, whatsapp: 0 },
    skipped: 0, configured,
  };

  const tipsRes = await query(`SELECT id, title, body FROM health_tips WHERE is_active = true ORDER BY seq`);
  if (tipsRes.rows.length === 0) return summary;
  // Rotate through the library by calendar day so everyone gets the same tip and
  // it advances daily without any stored pointer.
  const dayIndex = Math.floor(Date.now() / 86_400_000) % tipsRes.rows.length;
  const tip = tipsRes.rows[dayIndex];
  summary.tip = { id: tip.id, title: tip.title };

  const subs = await query(
    `SELECT id, full_name, sms_number, whatsapp_number, email, channels, unsubscribe_token
       FROM health_tip_subscribers WHERE is_active = true`
  );
  summary.subscribers = subs.rows.length;

  for (const s of subs.rows) {
    const channels: Channel[] = Array.isArray(s.channels) ? s.channels : [];
    for (const channel of channels) {
      const dest = channel === 'email' ? s.email : channel === 'sms' ? s.sms_number : s.whatsapp_number;
      if (!dest) { summary.skipped++; continue; }
      if (!configured[channel]) { summary.skipped++; continue; }

      // Claim the (subscriber, channel, day) slot atomically; 0 rows ⇒ already done today.
      const claim = await query(
        `INSERT INTO health_tip_sends (subscriber_id, tip_id, channel, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (subscriber_id, channel, sent_on) DO NOTHING
         RETURNING id`,
        [s.id, tip.id, channel]
      );
      if (claim.rows.length === 0) { summary.skipped++; continue; }
      const sendId = claim.rows[0].id;

      const outcome = await deliver(channel, dest, tip, s.unsubscribe_token);
      if (outcome.ok) {
        summary.sent[channel]++;
        await query(`UPDATE health_tip_sends SET status = 'sent' WHERE id = $1`, [sendId]);
      } else {
        summary.failed[channel]++;
        await query(`UPDATE health_tip_sends SET status = 'failed', error = $2 WHERE id = $1`,
          [sendId, String(outcome.error || '').slice(0, 300)]);
      }
    }
  }
  return summary;
}

// ── Cron trigger ───────────────────────────────────────────────────────────
// POST /health-tips/run-daily — for an external scheduler. Guarded by a shared
// secret (x-cron-secret header or ?secret=) so only your cron can fire it.
export async function runDailyTips(req: Request, res: Response): Promise<void> {
  const secret = String(req.headers['x-cron-secret'] || req.query?.secret || '');
  if (!env.healthTipsCronSecret || !constantTimeEqual(secret, env.healthTipsCronSecret)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const summary = await sendDailyTips();
  res.json(summary);
}

// ── Admin ──────────────────────────────────────────────────────────────────
export async function adminSendDailyTipNow(_req: Request, res: Response): Promise<void> {
  const summary = await sendDailyTips();
  res.json(summary);
}

export async function adminListSubscribers(_req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT id, full_name, sms_number, whatsapp_number, email, channels, consent, is_active, created_at
       FROM health_tip_subscribers ORDER BY created_at DESC LIMIT 5000`
  );
  res.json({ subscribers: r.rows, total: r.rows.length });
}

export async function adminDeleteSubscriber(req: Request, res: Response): Promise<void> {
  await query('DELETE FROM health_tip_subscribers WHERE id = $1', [String(req.params.id)]);
  res.json({ deleted: true });
}

export async function adminListTips(_req: Request, res: Response): Promise<void> {
  const r = await query(`SELECT id, seq, title, body, category, is_active, created_at FROM health_tips ORDER BY seq`);
  res.json({ tips: r.rows });
}

export async function adminCreateTip(req: Request, res: Response): Promise<void> {
  const title = String(req.body?.title || '').trim().slice(0, 160);
  const body = String(req.body?.body || '').trim();
  const category = String(req.body?.category || 'general').trim().slice(0, 60);
  if (!title || !body) { res.status(400).json({ error: 'Title and body are required.' }); return; }
  const r = await query(
    `INSERT INTO health_tips (title, body, category) VALUES ($1, $2, $3) RETURNING *`,
    [title, body, category]
  );
  res.status(201).json(r.rows[0]);
}

export async function adminUpdateTip(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const b = req.body || {};
  const r = await query(
    `UPDATE health_tips
        SET title = COALESCE($2, title), body = COALESCE($3, body),
            category = COALESCE($4, category), is_active = COALESCE($5, is_active)
      WHERE id = $1 RETURNING *`,
    [
      id,
      b.title !== undefined ? String(b.title).slice(0, 160) : null,
      b.body !== undefined ? String(b.body) : null,
      b.category !== undefined ? String(b.category).slice(0, 60) : null,
      b.is_active !== undefined ? Boolean(b.is_active) : null,
    ]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: 'Tip not found' }); return; }
  res.json(r.rows[0]);
}

export async function adminDeleteTip(req: Request, res: Response): Promise<void> {
  await query('DELETE FROM health_tips WHERE id = $1', [String(req.params.id)]);
  res.json({ deleted: true });
}

export async function adminListTipSends(_req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT hs.id, hs.channel, hs.status, hs.error, hs.sent_on, hs.created_at,
            sub.full_name, t.title AS tip_title
       FROM health_tip_sends hs
       LEFT JOIN health_tip_subscribers sub ON sub.id = hs.subscriber_id
       LEFT JOIN health_tips t ON t.id = hs.tip_id
      ORDER BY hs.created_at DESC LIMIT 500`
  );
  res.json({ sends: r.rows });
}
