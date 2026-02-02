import styles from './CrewFilter.module.css';
import type { CrewAggregation } from '../../../types/feedback';

interface CrewFilterProps {
  crewAggregations: CrewAggregation[];
  selectedCrew: string | null;
  onCrewChange: (crew: string | null) => void;
  totalCount: number;
}

export function CrewFilter({ crewAggregations, selectedCrew, onCrewChange, totalCount }: CrewFilterProps) {
  if (crewAggregations.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>Crew Members</div>
      <div className={styles.list}>
        <button
          className={`${styles.item} ${selectedCrew === null ? styles.itemActive : ''}`}
          onClick={() => onCrewChange(null)}
          type="button"
        >
          <span className={styles.name}>All feedback</span>
          <span className={styles.count}>{totalCount}</span>
        </button>
        {crewAggregations.map(ca => (
          <button
            key={ca.crewMember}
            className={`${styles.item} ${selectedCrew === ca.crewMember ? styles.itemActive : ''}`}
            onClick={() => onCrewChange(selectedCrew === ca.crewMember ? null : ca.crewMember)}
            type="button"
          >
            <span className={styles.name}>{ca.crewMember}</span>
            <span className={styles.count}>{ca.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
