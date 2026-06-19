import { Request, Response } from 'express';
import { anthropic } from '../config/anthropic';
import { env } from '../config/env';

// Platform-admin "AI status" check. Confirms — without ever exposing the key —
// whether the Anthropic integration is actually working end-to-end, by making a
// tiny real call to each model the platform uses. This turns the silent "buddy
// falls back to the source passage" failure into a one-glance diagnosis.

const BUDDY_MODEL = process.env.ANTHROPIC_BUDDY_MODEL || 'claude-haiku-4-5';
const TRIAGE_MODEL = env.anthropicModel; // ANTHROPIC_MODEL || 'claude-sonnet-4-5'

// Mask a secret so we can confirm a value is present without leaking it.
function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 10) return '****';
  return `${key.slice(0, 6)}…${key.slice(-4)} (len ${key.length})`;
}

// Turn an Anthropic SDK error into a short, actionable hint.
function diagnose(err: unknown): { status?: number; type?: string; message: string; hint: string } {
  const e = err as { status?: number; error?: { error?: { type?: string; message?: string } }; message?: string };
  const status = e?.status;
  const type = e?.error?.error?.type;
  const message = e?.error?.error?.message || e?.message || 'Unknown error';
  let hint = 'Unexpected error — see the message above.';
  if (status === 401 || type === 'authentication_error') {
    hint = 'The API key is wrong, revoked, or has a typo. Re-paste ANTHROPIC_API_KEY on the mobicova-api service and redeploy.';
  } else if (status === 400 && /credit|billing|balance/i.test(message)) {
    hint = 'The key is valid but the Anthropic account has no usable credit. Add a payment method / credits at console.anthropic.com → Billing.';
  } else if (status === 404 || type === 'not_found_error') {
    hint = `Model "${message.match(/model/i) ? '' : ''}" not available to this account. Set ANTHROPIC_BUDDY_MODEL / ANTHROPIC_MODEL to a model you can use.`;
  } else if (status === 429 || type === 'rate_limit_error') {
    hint = 'Rate limited. Usually transient — retry shortly, or check your account rate limits.';
  } else if (status === 529 || type === 'overloaded_error') {
    hint = 'Anthropic is temporarily overloaded. Transient — retry shortly.';
  } else if (!status && /premature close|other side closed|terminated|ECONNRESET|fetch failed|socket hang up|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    hint = 'Network/transport error reaching api.anthropic.com (not a key or billing issue). On Render, set NODE_OPTIONS=--dns-result-order=ipv4first on the mobicova-api service and redeploy; ensure the Anthropic SDK is current.';
  }
  return { status, type, message, hint };
}

// Make a 1-token call to a model and report whether it worked.
async function pingModel(model: string): Promise<{ model: string; ok: boolean; detail?: ReturnType<typeof diagnose> }> {
  if (!anthropic) return { model, ok: false };
  try {
    await anthropic.messages.create({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
    return { model, ok: true };
  } catch (err) {
    return { model, ok: false, detail: diagnose(err) };
  }
}

export async function adminAiStatus(_req: Request, res: Response): Promise<void> {
  const configured = !!anthropic;

  if (!configured) {
    res.json({
      configured: false,
      working: false,
      keyPresent: false,
      summary: 'No ANTHROPIC_API_KEY is set on the API service. The Health Buddy is running in fallback mode (returns the source passage verbatim). Add the key on the mobicova-api service and redeploy.',
      models: [],
    });
    return;
  }

  // Test both models the platform calls so we know exactly which (if any) fails.
  const [buddy, triage] = await Promise.all([pingModel(BUDDY_MODEL), pingModel(TRIAGE_MODEL)]);
  const working = buddy.ok; // the buddy is what most users hit

  let summary: string;
  if (buddy.ok && triage.ok) {
    summary = 'Anthropic is working. The Health Buddy is generating real answers (not fallback).';
  } else if (!buddy.ok && buddy.detail) {
    summary = `The key is set but the Buddy model call FAILED — this is why the Buddy is falling back to source text. ${buddy.detail.hint}`;
  } else {
    summary = 'Partial failure — see per-model details below.';
  }

  res.json({
    configured: true,
    working,
    keyPresent: true,
    keyMasked: maskKey(env.anthropicApiKey),
    summary,
    models: [
      { role: 'buddy', ...buddy },
      { role: 'triage', ...triage },
    ],
  });
}
