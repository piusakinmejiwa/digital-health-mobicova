// Server-side localisation (Phase 0) for the channels (USSD / WhatsApp / SMS) and
// the AI Buddy. Lightweight on purpose: plain dictionaries keyed by language, with
// English as the guaranteed fallback. Web UI strings live in the client catalogue;
// this covers everything the server renders or speaks.

// pcm = Nigerian Pidgin, ha = Hausa, yo = Yoruba, ig = Igbo
export const SUPPORTED_LANGS = ['en', 'pcm', 'ha', 'yo', 'ig'] as const;
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
  ha: {
    // DRAFT Hausa — pending native + clinician sign-off (see Hausa Seed Kit).
    'channel.chooseLanguage': 'Zabi harshe:\n1. Turanci\n2. Hausa',
    'buddy.greeting': 'Sannu! Ni ne MobiCova Health Buddy. Ka tambaye ni karamar tambaya kan lafiya.',
  },
  yo: {
    // DRAFT Yoruba — pending native + clinician sign-off (see Yoruba Seed Kit).
    'channel.chooseLanguage': 'Yan ede:\n1. Geesi\n2. Yoruba',
    'buddy.greeting': 'E nle! Emi ni MobiCova Health Buddy. Beere ibeere kekere nipa ilera lowo mi.',
  },
  ig: {
    // DRAFT Igbo — pending native + clinician sign-off (see Igbo Seed Kit).
    'channel.chooseLanguage': 'Horo asusu:\n1. Bekee\n2. Igbo',
    'buddy.greeting': 'Ndewo! Abu m MobiCova Health Buddy. Juo m obere ajuju gbasara ahuike.',
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
  if (lang === 'ha') {
    return '\n\nIMPORTANT: Reply in clear, simple Hausa. ' +
      'Keep the same meaning as the English sources — do not add facts. Stay respectful and clear.';
  }
  if (lang === 'yo') {
    return '\n\nIMPORTANT: Reply in clear, simple Yoruba (with correct tone marks). ' +
      'Keep the same meaning as the English sources — do not add facts. Stay respectful and clear.';
  }
  if (lang === 'ig') {
    return '\n\nIMPORTANT: Reply in clear, simple Igbo (with correct diacritics). ' +
      'Keep the same meaning as the English sources — do not add facts. Stay respectful and clear.';
  }
  return '';
}
