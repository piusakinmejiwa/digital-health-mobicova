// i18n foundation (Phase 0). English is the source/fallback; `pcm` is Nigerian
// Pidgin. Adding a language = drop in a locale folder + register it here. UI
// strings move into the JSON catalogues incrementally; any key not yet translated
// falls back to English automatically, so the app is always fully usable.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import pcmCommon from './locales/pcm/common.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pcm', label: 'Pidgin' },
] as const;

export type LangCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const STORAGE_KEY = 'mc_lang';

function initialLang(): LangCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'pcm') return saved;
  } catch {
    /* localStorage unavailable (SSR/private mode) — fall through to default */
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon },
    pcm: { common: pcmCommon },
  },
  lng: initialLang(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'pcm'],
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
