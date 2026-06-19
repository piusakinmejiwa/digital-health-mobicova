// i18n foundation (Phase 0). English is the source/fallback; `pcm` is Nigerian
// Pidgin, `ha` is Hausa. Adding a language = drop in a locale folder + register it
// here + add it to SUPPORTED_LANGUAGES. UI strings move into the JSON catalogues
// incrementally; any key not yet translated falls back to English automatically,
// so the app is always fully usable.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import pcmCommon from './locales/pcm/common.json';
import haCommon from './locales/ha/common.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pcm', label: 'Pidgin' },
  { code: 'ha', label: 'Hausa' },
] as const;

export type LangCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code) as readonly string[];
const STORAGE_KEY = 'mc_lang';

// Which languages are switched on for members. Driven by VITE_ENABLED_LANGS (a
// comma list, e.g. "en,pcm,ha"); English is always on. Legacy VITE_PIDGIN_ENABLED
// is still honoured so existing deploys keep working. A language only appears in
// the switcher once it is listed here AND its translations are signed off.
function enabledCodes(): string[] {
  const fromList = String(import.meta.env.VITE_ENABLED_LANGS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const set = new Set<string>(['en', ...fromList]);
  if (import.meta.env.VITE_PIDGIN_ENABLED === 'true') set.add('pcm'); // legacy flag
  return [...set].filter((c) => SUPPORTED_CODES.includes(c));
}

export const ENABLED_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => enabledCodes().includes(l.code));

function initialLang(): LangCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_CODES.includes(saved)) return saved as LangCode;
  } catch {
    /* localStorage unavailable (SSR/private mode) — fall through to default */
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon },
    pcm: { common: pcmCommon },
    ha: { common: haCommon },
  },
  lng: initialLang(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_CODES as string[],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
  returnEmptyString: false, // empty translation → fall back to English
});

export function setLanguage(code: LangCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore persistence failure */
  }
  void i18n.changeLanguage(code);
}

export default i18n;
