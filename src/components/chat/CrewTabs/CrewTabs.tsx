import styles from './CrewTabs.module.css';
import type { CrewMember } from '../../../types/crew';

interface CrewTabsProps {
  crewMembers: CrewMember[];
  selectedCrew: string | null;
  onSelect: (crewName: string) => void;
  disabled?: boolean;
}

export function CrewTabs({ crewMembers, selectedCrew, onSelect, disabled = false }: CrewTabsProps) {
  if (crewMembers.length === 0) return null;

  // Find default crew if nothing selected
  const activeCrew = selectedCrew || crewMembers.find(c => c.isDefault)?.name || crewMembers[0]?.name;

  return (
    <div className={styles.tabs}>
      {crewMembers.map((crew) => (
        <button
          key={crew.name}
          className={`${styles.tab} ${activeCrew === crew.name ? styles.active : ''}`}
          onClick={() => onSelect(crew.name)}
          disabled={disabled}
          type="button"
          aria-pressed={activeCrew === crew.name}
        >
          <div className={styles.circle}>
            {activeCrew === crew.name && <div className={styles.activeDot} />}
          </div>
          <span className={styles.label}>{crew.displayName}</span>
        </button>
      ))}
    </div>
  );
}
