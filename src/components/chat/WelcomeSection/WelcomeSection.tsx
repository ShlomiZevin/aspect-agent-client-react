import { useChatContext } from '../../../context';
import { useLanguage } from '../../../context/LanguageContext';
import { useLocalizedConfig } from '../../../hooks';
import styles from './WelcomeSection.module.css';

export function WelcomeSection() {
  const config = useLocalizedConfig();
  const { sendMessage, selectedTheme } = useChatContext();
  const { t } = useLanguage();

  const hideQuickQuestionsInUI = config.features.hideQuickQuestionsInUI === true;

  const handleQuickQuestion = (question: string) => {
    sendMessage(question, { hidden: hideQuickQuestionsInUI });
  };

  // Use theme logo if a brand theme is selected, otherwise fall back to config
  const welcomeIcon = selectedTheme?.logo || config.welcomeIcon;

  // Check if welcomeIcon is an image path or an emoji
  const isImagePath = welcomeIcon.startsWith('/') || welcomeIcon.startsWith('http');

  return (
    <div className={styles.welcome}>
      <div className={styles.header}>
        {isImagePath ? (
          <img src={welcomeIcon} alt="" className={styles.iconImage} />
        ) : (
          <span className={styles.icon}>{config.welcomeIcon}</span>
        )}
        <h2 className={styles.title}>{config.welcomeTitle}</h2>
        <p className={styles.message}>{config.welcomeMessage}</p>
      </div>

      <div className={styles.questions}>
        <h3 className={styles.questionsTitle}>{t('welcome.quickQuestions')}</h3>
        <div className={styles.grid}>
          {config.quickQuestions.map((q, index) => {
            const text = q.textKey ? t(q.textKey) : q.text || '';
            const question = q.questionKey ? t(q.questionKey) : q.question || '';
            return (
              <button
                key={index}
                className={styles.quickBtn}
                onClick={() => handleQuickQuestion(question)}
              >
                <span className={styles.quickIcon}>{q.icon}</span>
                <span className={styles.quickText}>{text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
