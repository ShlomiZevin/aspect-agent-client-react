import { useEffect, useRef } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAgentConfig } from '../../../context';
import { translations } from '../../../i18n/translations';
import { getTranslatedCrewName, getTranslatedCrewDescription } from '../../../i18n/crewTranslations';
import styles from './CrewJourneyModal.module.css';
import type { CrewJourneyStep } from '../../../types/crew';

interface CrewJourneyModalProps {
  steps: CrewJourneyStep[];
  isOpen: boolean;
  onClose: () => void;
}

export function CrewJourneyModal({ steps, isOpen, onClose }: CrewJourneyModalProps) {
  const { language } = useLanguage();
  const config = useAgentConfig();
  const modalRef = useRef<HTMLDivElement>(null);
  const currentStepRef = useRef<HTMLDivElement>(null);

  // Dynamic status labels based on language
  const statusLabels: Record<CrewJourneyStep['status'], string> = {
    completed: translations[language]['crew.journey.statusCompleted'],
    current: translations[language]['crew.journey.statusInProgress'],
    upcoming: translations[language]['crew.journey.statusUpcoming'],
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Scroll to current step when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Small delay to ensure the modal is rendered and animated
    const timeoutId = setTimeout(() => {
      if (currentStepRef.current && modalRef.current) {
        currentStepRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} ref={modalRef} role="dialog" aria-label={translations[language]['crew.journey.modalTitle']}>
        <div className={styles.header}>
          <h3 className={styles.title}>{translations[language]['crew.journey.modalTitle']}</h3>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.timeline}>
          {steps.map((step, index) => (
            <div
              key={step.crew.name}
              className={styles.timelineItem}
              ref={step.status === 'current' ? currentStepRef : undefined}
            >
              {/* Vertical connector line */}
              {index < steps.length - 1 && (
                <div
                  className={`${styles.timelineLine} ${
                    step.status === 'completed' ? styles.lineCompleted : ''
                  }`}
                />
              )}

              {/* Circle indicator */}
              <div className={`${styles.timelineCircle} ${styles[step.status]}`}>
                {step.status === 'completed' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {step.status === 'current' && (
                  <div className={styles.currentDot} />
                )}
              </div>

              {/* Content */}
              <div className={styles.timelineContent}>
                <div className={styles.crewName}>
                  {getTranslatedCrewName(config.agentName, step.crew.name, language, step.crew.displayName)}
                </div>
                <div className={styles.crewDescription}>
                  {getTranslatedCrewDescription(config.agentName, step.crew.name, language, step.crew.description)}
                </div>
                <span className={`${styles.statusBadge} ${styles[`badge_${step.status}`]}`}>
                  {statusLabels[step.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
