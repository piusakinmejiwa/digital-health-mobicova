// Deterministic safety layer for the AI Health Buddy. Crisis and red-flag
// detection are rule-based (not model-based) so they fire reliably and need no
// API call. Helpline numbers were verified June 2026 — the clinician reviewer
// must re-confirm (test-dial) at go-live.
//
// MULTILINGUAL: detection is organised as per-language lexicons. English uses
// rich regexes; other languages use phrase lists (what native reviewers naturally
// provide). Detection ALWAYS unions the message language's lexicon with English,
// because people code-switch — a Pidgin speaker may still type "I want to die".
import type { Lang } from '../i18n';

export type Safety = 'ok' | 'crisis' | 'emergency' | 'distress';

type Lexicon = {
  crisis: RegExp | string[];
  emergency: RegExp | string[];
  distress: RegExp | string[];
};

// ─── English (source language) ───────────────────────────────────────────────
const EN: Lexicon = {
  // Self-harm / suicide intent → crisis response (highest priority).
  crisis: /\b(suicide|suicidal|kill (?:myself|me)|killing myself|end (?:my life|it all|my own life)|ending (?:my life|it all)|take my (?:own )?life|taking my (?:own )?life|no reason to live|don'?t want to (?:live|be here|exist)|want to (?:die|disappear)|wish (?:i was|i were) dead|better off dead|better off without me|self[\s-]?harm|harm(?:ing)? myself|hurt(?:ing)? myself|cut(?:ting)? myself|overdose|took (?:pills|an overdose))\b/i,
  // Medical red flags → urgent emergency guidance.
  emergency: /\b(chest pain|can'?t breathe|cannot breathe|trouble breathing|difficulty breathing|struggling to breathe|stroke|face droop|slurred speech|severe bleeding|bleeding (?:heavily|a lot)|won'?t stop bleeding|unconscious|passed out|seizure|convulsion|anaphyla|severe allergic|not breathing|blue lips)\b/i,
  // Emotional distress (not necessarily suicidal) → Safe Emotions supportive reply.
  distress: /\b(overwhelmed|can'?t cope|cannot cope|can'?t take (?:it|this)(?: any ?more)?|hopeless|worthless|hate myself|no one cares|nobody cares|so alone|all alone|breaking down|falling apart|giving up|can'?t go on|tired of (?:living|everything|it all)|exhausted with (?:life|everything)|depressed|empty inside|feel numb)\b/i,
};

// ─── Nigerian Pidgin (DRAFT — pending clinician sign-off) ─────────────────────
// Replace/extend these with the clinician-approved phrases from the Pidgin Seed
// Kit (Section 3) before enabling Pidgin in production. Phrases are lowercase and
// matched as substrings against the normalised message — keep them generous.
const PCM: Lexicon = {
  crisis: [
    'i wan kill myself', 'i go kill myself', 'i wan die', 'make i just die', 'make i die',
    'i no wan live again', 'i no wan dey alive', 'i wan end am', 'i wan end everything',
    'i wan commit suicide', 'make i disappear', 'life no get meaning again', 'i wan kill mysef',
  ],
  emergency: [
    'i no fit breathe', 'breath no dey come', 'chest dey pain me', 'blood dey rush',
    'blood no wan stop', 'she dey labour', 'she wan born', 'belle wan comot', 'snake bite',
    'person don poison', 'i wan faint', 'person collapse', 'i don collapse', 'i no dey see road',
  ],
  distress: [
    'my mind no dey alright', 'everything don scatter', 'i tire for life', 'i don tire',
    'i dey cry every time', 'i dey feel useless', 'nobody care about me', 'i no get hope',
  ],
};

const LEXICONS: Record<Lang, Lexicon> = { en: EN, pcm: PCM };

// Lowercase + strip accents so matching is robust across spellings.
function norm(text: string): string {
  // NFKD + strip combining diacritical marks (U+0300–U+036F) so accented input matches.
  return (text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}
function hit(entry: RegExp | string[], t: string): boolean {
  return entry instanceof RegExp ? entry.test(t) : entry.some((p) => t.includes(p));
}
function lexFor(lang: Lang): Lexicon {
  return LEXICONS[lang] || EN;
}

// Classify against English ∪ the message language. English is always checked so
// code-switching never slips through the net.
export function classify(text: string, lang: Lang = 'en'): Safety {
  const t = norm(text);
  const lex = lexFor(lang);
  if (hit(EN.crisis, t) || hit(lex.crisis, t)) return 'crisis';
  if (hit(EN.emergency, t) || hit(lex.emergency, t)) return 'emergency';
  return 'ok';
}

export function isDistress(text: string, lang: Lang = 'en'): boolean {
  const t = norm(text);
  return hit(EN.distress, t) || hit(lexFor(lang).distress, t);
}

// ─── Helplines & localised reply templates ───────────────────────────────────
// Verified Nigerian crisis helplines (June 2026 — re-confirm at go-live).
export const HELPLINES = [
  { name: 'SURPIN (suicide prevention, 24/7)', number: '0800 0787 746' },
  { name: 'MANI (mental health, 24/7)', number: '0809 111 6264' },
  { name: 'She Writes Woman (24/7)', number: '0800 800 2000' },
  { name: 'Emergency', number: '112' },
];

type ReplyPack = {
  disclaimer: string;
  crisisIntro: string;
  crisisOutro: string;
  emergency: string;
  distressIntro: string;
  distressOutro: string;
  safeFooter: string;
};

const EN_REPLIES: ReplyPack = {
  disclaimer:
    'This is general health information, not a medical diagnosis. For advice about your own health, please see a clinician — MobiCova can connect you to a doctor.',
  crisisIntro:
    "I'm really sorry you're feeling this way, and I'm glad you reached out. I'm not able to provide crisis care, but people who can help are available right now:",
  crisisOutro:
    'If you are in immediate danger, please call 112 or go to the nearest hospital. You deserve support, and you do not have to go through this alone.',
  emergency:
    'This could be a medical emergency. Please seek urgent care now — call 112 (or Lagos 767) or go to the nearest hospital straight away. I can only share general information and cannot help with an emergency.',
  distressIntro:
    "I'm really sorry you're carrying so much right now — that sounds heavy, and what you're feeling is valid. You don't have to face it alone. If it would help to talk to someone any time:",
  distressOutro: "I'm here too — would you like to tell me a little more about what's going on?",
  safeFooter:
    '💚 If things ever feel too heavy, you can reach SURPIN 0800 0787 746 or MANI 0809 111 6264 any time.',
};

// DRAFT Pidgin overrides — fill each key from the Pidgin Seed Kit (Section 4)
// once the clinician/legal sign-off is in. Any key left out falls back to English,
// so the safety messaging is never broken while translation is in progress.
const REPLY_OVERRIDES: Partial<Record<Lang, Partial<ReplyPack>>> = {
  pcm: {
    // crisisIntro: 'I sorry well well say you dey feel like dis ...',
    // emergency: 'Dis one fit be emergency. Abeg call 112 now now ...',
    // ...
  },
};

function pack(lang: Lang): ReplyPack {
  if (lang === 'en') return EN_REPLIES;
  const over = REPLY_OVERRIDES[lang] || {};
  const merged = { ...EN_REPLIES };
  (Object.keys(over) as (keyof ReplyPack)[]).forEach((k) => {
    const v = over[k];
    if (v) merged[k] = v;
  });
  return merged;
}

// English exports kept for existing callers; the *For(lang) variants are the
// language-aware path used as other languages are signed off.
export const DISCLAIMER = EN_REPLIES.disclaimer;
export const SAFE_EMOTIONS_FOOTER = EN_REPLIES.safeFooter;
export const disclaimerFor = (lang: Lang = 'en'): string => pack(lang).disclaimer;
export const safeEmotionsFooter = (lang: Lang = 'en'): string => pack(lang).safeFooter;

export function crisisReply(lang: Lang = 'en'): string {
  const p = pack(lang);
  const lines = HELPLINES.map((h) => `• ${h.name}: ${h.number}`).join('\n');
  return `${p.crisisIntro}\n\n${lines}\n\n${p.crisisOutro}`;
}

export function emergencyReply(lang: Lang = 'en'): string {
  return pack(lang).emergency;
}

// Shorthand helpline lines (named subset) for warmer, non-crisis messages.
function helplineLines(names: string[]): string {
  return HELPLINES.filter((h) => names.some((n) => h.name.startsWith(n)))
    .map((h) => `• ${h.name.split(' (')[0]}: ${h.number}`)
    .join('\n');
}

// Safe Emotions — emotional distress (not an explicit self-harm statement).
export function distressReply(lang: Lang = 'en'): string {
  const p = pack(lang);
  return `${p.distressIntro}\n\n${helplineLines(['SURPIN', 'MANI'])}\n\n${p.distressOutro}`;
}
