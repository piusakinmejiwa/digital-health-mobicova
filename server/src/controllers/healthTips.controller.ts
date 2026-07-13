import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { sendEmail } from '../lib/email';
import { sendSms, sendWhatsApp, smsConfigured, whatsappConfigured } from '../lib/messaging';
import { constantTimeEqual } from '../lib/safeCompare';
import { generateHealthTipDraft, HealthTipDraftUnavailable } from '../lib/healthTipDraft';

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

// A tip is a structured card; each channel renders the parts it can carry well.
export interface TipContent {
  title: string;
  body: string;
  sms_text?: string;
  why_it_matters?: string;
  action?: string;
  myth?: string;
  fact?: string;
  source?: string;
}

const esc = (s?: string): string => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const trimmed = (s?: string): string => (s || '').trim();

// SMS — lean, ideally one segment. Use the curated one-liner; fall back to body.
function renderSms(tip: TipContent): string {
  const line = trimmed(tip.sms_text) || tip.body;
  return `MobiCova Daily Health Tip — ${tip.title}\n\n${line}\nReply STOP to opt out.`;
}

// WhatsApp — the message is a single template body parameter, which Meta rejects
// if it contains newlines. So collapse to one rich line: headline, body, action.
function renderWhatsApp(tip: TipContent): string {
  const bits = [tip.body, trimmed(tip.action) ? `Try this today: ${trimmed(tip.action)}` : '']
    .filter(Boolean)
    .join(' ');
  return `${tip.title} — ${bits}`.replace(/\s+/g, ' ').trim();
}

// Email — the rich edition: headline, body, "Why it matters", an action box,
// an optional myth-vs-fact, and a credible-source footer + disclaimer.
function renderEmail(tip: TipContent, unsub: string): { subject: string; html: string; text: string } {
  const teal = '#0a7b7b';
  const blocks: string[] = [
    `<p style="margin:0 0 16px;font-size:15px">${esc(tip.body)}</p>`,
  ];
  const textParts: string[] = [`MobiCova Daily Health Tip — ${tip.title}`, '', tip.body];

  if (trimmed(tip.why_it_matters)) {
    blocks.push(`<div style="margin:0 0 16px">
      <div style="font-weight:700;color:${teal};font-size:13px;letter-spacing:.02em;text-transform:uppercase;margin:0 0 4px">Why it matters</div>
      <p style="margin:0;font-size:15px">${esc(tip.why_it_matters)}</p>
    </div>`);
    textParts.push('', `WHY IT MATTERS: ${tip.why_it_matters}`);
  }
  if (trimmed(tip.action)) {
    blocks.push(`<div style="margin:0 0 16px;background:#f0f9f9;border:1px solid #d4ecec;border-left:4px solid ${teal};border-radius:8px;padding:12px 14px">
      <div style="font-weight:700;color:${teal};margin:0 0 2px">✅ Try this today</div>
      <p style="margin:0;font-size:15px">${esc(tip.action)}</p>
    </div>`);
    textParts.push('', `TRY THIS TODAY: ${tip.action}`);
  }
  if (trimmed(tip.myth) && trimmed(tip.fact)) {
    blocks.push(`<div style="margin:0 0 16px;border:1px solid #e3eded;border-radius:8px;padding:12px 14px">
      <p style="margin:0 0 4px;font-size:14px"><b style="color:#b4531f">Myth:</b> ${esc(tip.myth)}</p>
      <p style="margin:0;font-size:14px"><b style="color:${teal}">Fact:</b> ${esc(tip.fact)}</p>
    </div>`);
    textParts.push('', `MYTH: ${tip.myth}`, `FACT: ${tip.fact}`);
  }

  const sourceLine = trimmed(tip.source)
    ? `<p style="color:#5e6e6e;font-size:12px;margin:0 0 6px">Source: ${esc(tip.source)}.</p>`
    : '';
  if (trimmed(tip.source)) textParts.push('', `Source: ${tip.source}.`);
  textParts.push('', `Unsubscribe: ${unsub}`);

  const html = `<div style="font:15px/1.6 Arial,Helvetica,sans-serif;color:#1f2d2b;max-width:600px;margin:0 auto">
    <div style="background:${teal};border-radius:12px 12px 0 0;padding:14px 20px">
      <span style="color:#fff;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase">MobiCova · Daily Health Tip</span>
    </div>
    <div style="border:1px solid #e3eded;border-top:none;border-radius:0 0 12px 12px;padding:22px 20px">
      <h1 style="color:${teal};font-size:22px;line-height:1.3;margin:0 0 14px">${esc(tip.title)}</h1>
      ${blocks.join('\n      ')}
      <hr style="border:none;border-top:1px solid #e3eded;margin:18px 0 12px">
      ${sourceLine}
      <p style="color:#5e6e6e;font-size:12px;margin:0">This is general health guidance, not a diagnosis or a substitute for seeing a clinician.
      You’re receiving MobiCova Daily Health Tips. <a href="${unsub}" style="color:#5e6e6e">Unsubscribe</a>.</p>
    </div>
  </div>`;

  return { subject: `Your daily health tip — ${tip.title}`, html, text: textParts.join('\n') };
}

async function deliver(channel: Channel, dest: string, tip: TipContent, unsubToken: string) {
  if (channel === 'email') {
    const unsub = `${env.clientUrl}/health-tips/unsubscribe?token=${unsubToken}`;
    const { subject, html, text } = renderEmail(tip, unsub);
    return sendEmail({ to: dest, subject, html, text }).then((r) => ({ ok: r.sent, error: r.error }));
  }
  if (channel === 'sms') return sendSms(dest, renderSms(tip));
  return sendWhatsApp(dest, renderWhatsApp(tip));
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

  const tipsRes = await query(
    `SELECT id, title, body, sms_text, why_it_matters, action, myth, fact, source
       FROM health_tips WHERE is_active = true AND status = 'published' ORDER BY seq`
  );
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
  const r = await query(
    `SELECT id, seq, title, body, sms_text, why_it_matters, action, myth, fact, source,
            category, status, is_active, created_at
       FROM health_tips ORDER BY seq`
  );
  res.json({ tips: r.rows });
}

const cleanStatus = (v: unknown): 'draft' | 'published' => (String(v) === 'draft' ? 'draft' : 'published');

export async function adminCreateTip(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 160);
  const body = String(b.body || '').trim();
  const category = String(b.category || 'general').trim().slice(0, 60);
  if (!title || !body) { res.status(400).json({ error: 'Title and body are required.' }); return; }
  const r = await query(
    `INSERT INTO health_tips (title, body, sms_text, why_it_matters, action, myth, fact, source, category, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      title, body,
      String(b.sms_text || '').trim().slice(0, 320),
      String(b.why_it_matters || '').trim().slice(0, 1200),
      String(b.action || '').trim().slice(0, 600),
      String(b.myth || '').trim().slice(0, 600),
      String(b.fact || '').trim().slice(0, 600),
      String(b.source || '').trim().slice(0, 200),
      category,
      cleanStatus(b.status),
    ]
  );
  res.status(201).json(r.rows[0]);
}

export async function adminUpdateTip(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const b = req.body || {};
  const s = (v: unknown, max: number) => (v !== undefined ? String(v).slice(0, max) : null);
  const r = await query(
    `UPDATE health_tips
        SET title = COALESCE($2, title), body = COALESCE($3, body),
            sms_text = COALESCE($4, sms_text), why_it_matters = COALESCE($5, why_it_matters),
            action = COALESCE($6, action), myth = COALESCE($7, myth), fact = COALESCE($8, fact),
            source = COALESCE($9, source), category = COALESCE($10, category),
            status = COALESCE($11, status), is_active = COALESCE($12, is_active)
      WHERE id = $1 RETURNING *`,
    [
      id,
      s(b.title, 160), s(b.body, 4000),
      s(b.sms_text, 320), s(b.why_it_matters, 1200), s(b.action, 600),
      s(b.myth, 600), s(b.fact, 600), s(b.source, 200), s(b.category, 60),
      b.status !== undefined ? cleanStatus(b.status) : null,
      b.is_active !== undefined ? Boolean(b.is_active) : null,
    ]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: 'Tip not found' }); return; }
  res.json(r.rows[0]);
}

// AI-draft a structured tip for an admin to review. Persists NOTHING — the draft
// is returned to the editor; only an explicit save (as a tip) can ever send it.
export async function adminGenerateTip(req: Request, res: Response): Promise<void> {
  const topic = String(req.body?.topic || '').trim().slice(0, 200);
  try {
    const draft = await generateHealthTipDraft(topic);
    res.json({ draft });
  } catch (err) {
    if (err instanceof HealthTipDraftUnavailable) {
      res.status(503).json({ error: err.message });
      return;
    }
    throw err;
  }
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
