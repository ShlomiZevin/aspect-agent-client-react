/**
 * CrewMemberIndicator Component
 *
 * Displays the current crew member handling the conversation
 */

import styles from './CrewMemberIndicator.module.css';
import type { CrewMember } from '../../../types/crew';

interface CrewMemberIndicatorProps {
  crew: CrewMember | null;
  isTransitioning?: boolean;
}

export function CrewMemberIndicator({ crew, isTransitioning = false }: CrewMemberIndicatorProps) {
  if (!crew) return null;

  return (
    <div className={`${styles.container} ${isTransitioning ? styles.transitioning : ''}`}>
      <div className={styles.icon}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        </svg>
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{crew.displayName}</span>
        {crew.description && (
          <span className={styles.description}>{crew.description}</span>
        )}
      </div>
    </div>
  );
}
