import { env } from '../config/env';

// Daily.co video calling. Each consultation gets a private room (named
// deterministically from the consult id) and each participant a short-lived
// meeting token. Gated on DAILY_API_KEY: if it's absent, dailyConfigured() is
// false and callers return a graceful 503 instead of crashing.
//
// Docs: https://docs.daily.co/reference/rest-api

const API = 'https://api.daily.co/v1';

export function dailyConfigured(): boolean {
  return !!env.dailyApiKey;
}

// Room name allowed chars: letters, digits, '-' and '_'. A consult UUID fits.
export function roomNameForConsult(consultId: string): string {
  return `mc-${consultId}`;
}

type DailyResult = { ok: boolean; status: number; json: any; text: string };

async function dailyFetch(path: string, method: string, body?: unknown): Promise<DailyResult> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.dailyApiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  return { ok: res.ok, status: res.status, json, text };
}

// Create (or reuse) a private room for a consultation and return its URL.
// Rooms auto-expire 2 hours out so stale rooms self-clean.
export async function ensureRoom(name: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  const r = await dailyFetch('/rooms', 'POST', {
    name,
    privacy: 'private',
    properties: {
      exp,
      enable_chat: true,
      enable_screenshare: true,
      enable_knocking: false,
    },
  });
  if (r.ok) return r.json.url as string;
  // Already exists → fetch it to get the URL (Daily returns 400/409 with a
  // "already exists" message; reuse rather than failing the call).
  if (r.status === 400 || r.status === 409) {
    const g = await dailyFetch(`/rooms/${name}`, 'GET');
    if (g.ok) return g.json.url as string;
  }
  throw new Error(`Daily room create failed (${r.status}): ${r.text.slice(0, 200)}`);
}

// Issue a short-lived meeting token scoped to one room. is_owner grants host
// controls (the clinician); the member joins as a guest. startVideoOff joins
// with the camera off — used for "voice" consultations (audio-first, but the
// participant can still turn video on).
export async function createMeetingToken(
  roomName: string,
  isOwner: boolean,
  userName: string,
  startVideoOff = false
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  const r = await dailyFetch('/meeting-tokens', 'POST', {
    properties: {
      room_name: roomName,
      is_owner: isOwner,
      user_name: (userName || 'Guest').slice(0, 80),
      start_video_off: startVideoOff,
      exp,
    },
  });
  if (!r.ok) throw new Error(`Daily token create failed (${r.status}): ${r.text.slice(0, 200)}`);
  return r.json.token as string;
}
