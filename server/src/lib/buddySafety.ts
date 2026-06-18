// Deterministic safety layer for the AI Health Buddy. Crisis and red-flag
// detection are rule-based (not model-based) so they fire reliably and need no
// API call. Helpline numbers were verified June 2026 — the clinician reviewer
// must re-confirm (test-dial) at go-live.

export type Safety = 'ok' | 'crisis' | 'emergency';

// Self-harm / suicide intent → crisis response (highest priority).
const CRISIS_RE = /\b(suicide|suicidal|kill myself|killing myself|end (?:my|it all)|take my (?:own )?life|don'?t want to (?:live|be here)|want to die|better off dead|self[\s-]?harm|harm(?:ing)? myself|hurt myself|overdose)\b/i;

// Medical red flags → urgent emergency guidance.
const EMERGENCY_RE = /\b(chest pain|can'?t breathe|cannot breathe|trouble breathing|difficulty breathing|struggling to breathe|stroke|face droop|slurred speech|severe bleeding|bleeding (?:heavily|a lot)|won'?t stop bleeding|unconscious|passed out|seizure|convulsion|anaphyla|severe allergic|not breathing|blue lips)\b/i;

export function classify(text: string): Safety {
  const t = (text || '').toLowerCase();
  if (CRISIS_RE.test(t)) return 'crisis';
  if (EMERGENCY_RE.test(t)) return 'emergency';
  return 'ok';
}

// Verified Nigerian crisis helplines (June 2026 — re-confirm at go-live).
export const HELPLINES = [
  { name: 'SURPIN (suicide prevention, 24/7)', number: '0800 0787 746' },
  { name: 'MANI (mental health, 24/7)', number: '0809 111 6264' },
  { name: 'She Writes Woman (24/7)', number: '0800 800 2000' },
  { name: 'Emergency', number: '112' },
];

export const DISCLAIMER =
  'This is general health information, not a medical diagnosis. For advice about your own health, please see a clinician — MobiCova can connect you to a doctor.';

export function crisisReply(): string {
  const lines = HELPLINES.map((h) => `• ${h.name}: ${h.number}`).join('\n');
  return (
    "I'm really sorry you're feeling this way, and I'm glad you reached out. " +
    'I\'m not able to provide crisis care, but people who can help are available right now:\n\n' +
    lines +
    '\n\nIf you are in immediate danger, please call 112 or go to the nearest hospital. ' +
    'You deserve support, and you do not have to go through this alone.'
  );
}

export function emergencyReply(): string {
  return (
    'This could be a medical emergency. Please seek urgent care now — call 112 (or Lagos 767) ' +
    'or go to the nearest hospital straight away. ' +
    'I can only share general information and cannot help with an emergency.'
  );
}
