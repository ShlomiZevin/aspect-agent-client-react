import { useState, useEffect } from 'react';
import styles from './ThinkingIndicator.module.css';
import type { ThinkingStep } from '../../../types';

interface ThinkingIndicatorProps {
  currentStep: string;
  steps?: ThinkingStep[];
  isComplete?: boolean;
}

export function ThinkingIndicator({ currentStep, steps = [], isComplete = false }: ThinkingIndicatorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse when complete
  useEffect(() => {
    if (isComplete) {
      setIsCollapsed(true);
    }
  }, [isComplete]);

  // Show nothing if no steps and no current step
  if (!currentStep && steps.length === 0) {
    return null;
  }

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
          {steps.length > 0 ? (
            steps.map((step, index) => (
              <div key={step.stepOrder || index} className={styles.step}>
                {!isComplete && index === steps.length - 1 && <span className={styles.dot} />}
                {isComplete && <span className={styles.checkmark}>✓</span>}
                {step.description}
              </div>
            ))
          ) : (
            <div className={styles.step}>
              {!isComplete && <span className={styles.dot} />}
              {currentStep || 'Processing...'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
