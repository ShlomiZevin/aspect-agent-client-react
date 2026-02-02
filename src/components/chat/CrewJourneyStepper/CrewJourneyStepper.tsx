import styles from './CrewJourneyStepper.module.css';
import type { CrewJourneyStep } from '../../../types/crew';

interface CrewJourneyStepperProps {
  steps: CrewJourneyStep[];
  onStepperClick: () => void;
}

export function CrewJourneyStepper({ steps, onStepperClick }: CrewJourneyStepperProps) {
  if (steps.length === 0) return null;

  return (
    <button
      className={styles.stepper}
      onClick={onStepperClick}
      aria-label="View crew journey details"
      type="button"
    >
      {steps.map((step, index) => (
        <div key={step.crew.name} className={styles.step}>
          {/* Connector line (not before first step) */}
          {index > 0 && (
            <div
              className={`${styles.connector} ${
                step.status === 'completed' || step.status === 'current'
                  ? styles.connectorActive
                  : ''
              }`}
            />
          )}

          {/* Circle indicator */}
          <div className={`${styles.circle} ${styles[step.status]}`}>
            {step.status === 'completed' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {step.status === 'current' && (
              <div className={styles.currentDot} />
            )}
          </div>

          {/* Label */}
          <span className={`${styles.label} ${styles[`label_${step.status}`]}`}>
            {step.crew.displayName}
          </span>
        </div>
      ))}
    </button>
  );
}
