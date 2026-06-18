// Deterministic safety layer for the AI Health Buddy. Crisis and red-flag
// detection are rule-based (not model-based) so they fire reliably and need no
// API call. Helpline numbers were verified June 2026 — the clinician reviewer
// must re-confirm (test-dial) at go-live.

export type Safety = 'ok' | 'crisis' | 'emergency' | 'distress';

// Self-harm / suicide intent → crisis response (highest priority).
const CRISIS_RE = /\b(suicide|suicidal|kill (?:myself|me)|killing myself|end (?:my life|it all|my own life)|ending (?:my life|it all)|take my (?:own )?life|taking my (?:own )?life|no reason to live|don'?t want to (?:live|be here|exist)|want to (?:die|disappear)|wish (?:i was|i were) dead|better off dead|better off without me|self[\s-]?harm|harm(?:ing)? myself|hurt(?:ing)? myself|cut(?:ting)? myself|overdose|took (?:pills|an overdose))\b/i;

// Medical red flags → urgent emergency guidance.
const EMERGENCY_RE = /\b(chest pain|can'?t breathe|cannot breathe|trouble breathing|difficulty breathing|struggling to breathe|stroke|face droop|slurred speech|severe bleeding|bleeding (?:heavily|a lot)|won'?t stop bleeding|unconscious|passed out|seizure|convulsion|anaphyla|severe allergic|not breathing|blue lips)\b/i;

// Emotional distress (not necessarily suicidal) → used by the Safe Emotions buddy
// to respond supportively and gently offer helplines.
const DISTRESS_RE = /\b(overwhelmed|can'?t cope|cannot cope|can'?t take (?:it|this)(?: any ?more)?|hopeless|worthless|hate myself|no one cares|nobody cares|so alone|all alone|breaking down|falling apart|giving up|can'?t go on|tired of (?:living|everything|it all)|exhausted with (?:life|everything)|depressed|empty inside|feel numb)\b/i;

export function classify(text: string): Safety {
  const t = (text || '').toLowerCase();
  if (CRISIS_RE.test(t)) return 'crisis';
  if (EMERGENCY_RE.test(t)) return 'emergency';
  return 'ok';
}

export function isDistress(text: string): boolean {
  return DISTRESS_RE.test((text || '').toLowerCase());
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

// Shorthand helpline lines (named subset) for warmer, non-crisis messages.
function helplineLines(names: string[]): string {
  return HELPLINES.filter((h) => names.some((n) => h.name.startsWith(n)))
    .map((h) => `• ${h.name.split(' (')[0]}: ${h.number}`)
    .join('\n');
}

// Safe Emotions — emotional distress (not an explicit self-harm statement).
// Warm, validating, gently offers helplines, and keeps the conversation open.
export function distressReply(): string {
  return (
    "I'm really sorry you're carrying so much right now — that sounds heavy, and what you're feeling is valid. " +
    "You don't have to face it alone. If it would help to talk to someone any time:\n\n" +
    helplineLines(['SURPIN', 'MANI']) +
    "\n\nI'm here too — would you like to tell me a little more about what's going on?"
  );
}

// Always-available footer on Safe Emotions replies so help is one tap away.
export const SAFE_EMOTIONS_FOOTER =
  '💚 If things ever feel too heavy, you can reach SURPIN 0800 0787 746 or MANI 0809 111 6264 any time.';
