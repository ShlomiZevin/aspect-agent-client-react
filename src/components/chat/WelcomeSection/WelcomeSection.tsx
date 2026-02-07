import { useAgentConfig, useChatContext } from '../../../context';
import styles from './WelcomeSection.module.css';

export function WelcomeSection() {
  const config = useAgentConfig();
  const { sendMessage } = useChatContext();

  const handleQuickQuestion = (question: string) => {
    sendMessage(question);
  };

  // Check if welcomeIcon is an image path or an emoji
  const isImagePath = config.welcomeIcon.startsWith('/') || config.welcomeIcon.startsWith('http');

  return (
    <div className={styles.welcome}>
      <div className={styles.header}>
        {isImagePath ? (
          <img src={config.welcomeIcon} alt="" className={styles.iconImage} />
        ) : (
          <span className={styles.icon}>{config.welcomeIcon}</span>
        )}
        <h2 className={styles.title}>{config.welcomeTitle}</h2>
        <p className={styles.message}>{config.welcomeMessage}</p>
      </div>

      <div className={styles.questions}>
        <h3 className={styles.questionsTitle}>Quick questions to get started:</h3>
        <div className={styles.grid}>
          {config.quickQuestions.map((q, index) => (
            <button
              key={index}
              className={styles.quickBtn}
              onClick={() => handleQuickQuestion(q.question)}
            >
              <span className={styles.quickIcon}>{q.icon}</span>
              <span className={styles.quickText}>{q.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
