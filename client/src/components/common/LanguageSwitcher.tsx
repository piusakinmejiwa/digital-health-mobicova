import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage, type LangCode } from '../../i18n';

// Language picker. Hidden until Pidgin is signed off and VITE_PIDGIN_ENABLED is
// turned on — so members never see a half-translated language. Once enabled, the
// chosen language persists across sessions (localStorage).
export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();

  // Gate: only show the switcher once non-English languages are ready.
  if (import.meta.env.VITE_PIDGIN_ENABLED !== 'true') return null;

  return (
    <select
      className={`lang-switcher ${className}`}
      value={i18n.resolvedLanguage}
      onChange={(e) => setLanguage(e.target.value as LangCode)}
      aria-label="Language"
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}
