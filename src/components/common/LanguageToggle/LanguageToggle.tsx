import { useLanguage } from '../../../context/LanguageContext';
import { useAgentConfig } from '../../../context/AgentContext';
import type { Language } from '../../../types';
import styles from './LanguageToggle.module.css';

const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'EN',
  he: 'עב',
  es: 'ES',
};

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  he: 'Hebrew',
  es: 'Spanish',
};

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const { supportedLanguages = ['en', 'he'] } = useAgentConfig();

  // Two languages: single button that flips to the other one (original behavior).
  if (supportedLanguages.length <= 2) {
    const other = supportedLanguages.find(l => l !== language) ?? supportedLanguages[0];
    return (
      <button
        className={styles.toggle}
        onClick={() => setLanguage(other)}
        aria-label={`Switch to ${LANGUAGE_NAMES[other]}`}
        title={`Switch to ${LANGUAGE_NAMES[other]}`}
      >
        <span className={styles.langText}>{LANGUAGE_LABELS[other]}</span>
      </button>
    );
  }

  // Three or more languages: segmented control showing every option.
  return (
    <div className={styles.group} role="group" aria-label="Select language">
      {supportedLanguages.map(lang => (
        <button
          key={lang}
          className={`${styles.groupButton} ${lang === language ? styles.groupButtonActive : ''}`}
          onClick={() => setLanguage(lang)}
          aria-label={`Switch to ${LANGUAGE_NAMES[lang]}`}
          title={LANGUAGE_NAMES[lang]}
          aria-pressed={lang === language}
        >
          <span className={styles.langText}>{LANGUAGE_LABELS[lang]}</span>
        </button>
      ))}
    </div>
  );
}
