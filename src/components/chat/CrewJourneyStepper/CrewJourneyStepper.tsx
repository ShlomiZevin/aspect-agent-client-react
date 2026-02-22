import { useMemo } from 'react';
import styles from './CrewJourneyStepper.module.css';
import type { CrewJourneyStep } from '../../../types/crew';

interface CrewJourneyStepperProps {
  steps: CrewJourneyStep[];
  onStepperClick: () => void;
  maxVisibleSteps?: number;
}

export function CrewJourneyStepper({ steps, onStepperClick, maxVisibleSteps = 5 }: CrewJourneyStepperProps) {
  if (steps.length === 0) return null;

  // Calculate which steps to show, centered on current
  const { visibleSteps, hiddenLeftCount, hiddenRightCount } = useMemo(() => {
    if (steps.length <= maxVisibleSteps) {
      return { visibleSteps: steps, hiddenLeftCount: 0, hiddenRightCount: 0 };
    }

    const currentIndex = steps.findIndex(s => s.status === 'current');
    const effectiveCurrentIndex = currentIndex === -1 ? steps.length - 1 : currentIndex;

    // Calculate window centered on current step
    const halfWindow = Math.floor(maxVisibleSteps / 2);
    let startIndex = effectiveCurrentIndex - halfWindow;
    let endIndex = startIndex + maxVisibleSteps;

    // Adjust if window goes out of bounds
    if (startIndex < 0) {
      startIndex = 0;
      endIndex = maxVisibleSteps;
    } else if (endIndex > steps.length) {
      endIndex = steps.length;
      startIndex = Math.max(0, endIndex - maxVisibleSteps);
    }

    return {
      visibleSteps: steps.slice(startIndex, endIndex).map((step, i) => ({
        ...step,
        originalIndex: startIndex + i,
      })),
      hiddenLeftCount: startIndex,
      hiddenRightCount: steps.length - endIndex,
    };
  }, [steps, maxVisibleSteps]);

  return (
    <button
      className={styles.stepper}
      onClick={onStepperClick}
      aria-label="View crew journey details"
      type="button"
    >
      {/* Left indicator for hidden steps */}
      {hiddenLeftCount > 0 && (
        <div className={styles.hiddenCount}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {hiddenLeftCount}
        </div>
      )}

      {visibleSteps.map((step, index) => {
        const isFirstVisible = index === 0;

        return (
          <div key={step.crew.name} className={styles.step}>
            {/* Connector line (not before first visible step, but show if there are hidden left steps) */}
            {(!isFirstVisible || hiddenLeftCount > 0) && (
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
        );
      })}

      {/* Right indicator for hidden steps */}
      {hiddenRightCount > 0 && (
        <div className={styles.hiddenCount}>
          {hiddenRightCount}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      )}
    </button>
  );
}
