import { useLanguage } from '../../../context/LanguageContext';
import styles from './LanguageToggle.module.css';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'he' : 'en');
  };

  return (
    <button
      className={styles.toggle}
      onClick={toggleLanguage}
      aria-label={`Switch to ${language === 'en' ? 'Hebrew' : 'English'}`}
      title={`Switch to ${language === 'en' ? 'Hebrew' : 'English'}`}
    >
      <span className={styles.langText}>{language === 'en' ? 'עב' : 'EN'}</span>
    </button>
  );
}
