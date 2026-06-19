import { useTranslation } from 'react-i18next';
import { ENABLED_LANGUAGES, setLanguage, type LangCode } from '../../i18n';

// Language picker. Shows only the languages switched on via VITE_ENABLED_LANGS
// (English always; others once signed off) — so members never see a half-
// translated language. Hidden entirely until more than one language is enabled.
// The chosen language persists across sessions (localStorage).
export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();

  if (ENABLED_LANGUAGES.length <= 1) return null;

  return (
    <select
      className={`lang-switcher ${className}`}
      value={i18n.resolvedLanguage}
      onChange={(e) => setLanguage(e.target.value as LangCode)}
      aria-label="Language"
    >
      {ENABLED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}
