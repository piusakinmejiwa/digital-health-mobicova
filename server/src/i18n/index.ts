// Server-side localisation (Phase 0) for the channels (USSD / WhatsApp / SMS) and
// the AI Buddy. Lightweight on purpose: plain dictionaries keyed by language, with
// English as the guaranteed fallback. Web UI strings live in the client catalogue;
// this covers everything the server renders or speaks.

export const SUPPORTED_LANGS = ['en', 'pcm'] as const; // pcm = Nigerian Pidgin
export type Lang = (typeof SUPPORTED_LANGS)[number];

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(v);
}

// Coerce any input to a supported language, defaulting to English.
export function toLang(v: unknown): Lang {
  return isLang(v) ? v : 'en';
}

// Channel string catalogue. Add keys here as channel text is localised; any key
// missing from a non-English catalogue automatically falls back to English.
type Catalogue = Record<string, string>;

const STRINGS: Record<Lang, Catalogue> = {
  en: {
    'channel.chooseLanguage': 'Choose language:\n1. English\n2. Pidgin',
    'buddy.greeting': 'Hi! I am the MobiCova Health Buddy. Ask me a basic health question.',
  },
  pcm: {
    // DRAFT Pidgin — pending native + clinician sign-off (see Pidgin Seed Kit).
    'channel.chooseLanguage': 'Choose language:\n1. English\n2. Pidgin',
    'buddy.greeting': 'How far! Na me be MobiCova Health Buddy. Ask me any small health question.',
  },
};

export function t(lang: Lang, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

// Instruction appended to the Buddy's system prompt so the AI answers in the
// member's language while still grounding only on the (English) source passages.
// English needs no instruction. Returns '' for languages that need no steer.
export function languageDirective(lang: Lang): string {
  if (lang === 'pcm') {
    return '\n\nIMPORTANT: Reply in warm, simple Nigerian Pidgin (no diacritics). ' +
      'Keep the same meaning as the English sources — do not add facts. Stay respectful and clear.';
  }
  return '';
}
