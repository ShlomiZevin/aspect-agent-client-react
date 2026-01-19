import { useState } from 'react';
import styles from './ThinkingIndicator.module.css';

interface ThinkingIndicatorProps {
  currentStep: string;
  isComplete?: boolean;
}

export function ThinkingIndicator({ currentStep, isComplete = false }: ThinkingIndicatorProps) {
  const [isCollapsed, setIsCollapsed] = useState(isComplete);

  return (
    <div className={`${styles.container} ${isComplete ? styles.completed : ''} ${isCollapsed ? styles.collapsed : ''}`}>
      <button
        className={styles.header}
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span className={styles.label}>
          {isComplete ? 'View thinking process' : 'Thinking...'}
        </span>
        <svg
          className={`${styles.toggle} ${!isCollapsed ? styles.expanded : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!isCollapsed && (
        <div className={styles.steps}>
          <div className={styles.step}>
            {!isComplete && <span className={styles.dot} />}
            {currentStep}
          </div>
        </div>
      )}
    </div>
  );
}
