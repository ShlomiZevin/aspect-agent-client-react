import styles from './StatsBar.module.css';
import type { FeedbackStats } from '../../../types/feedback';

interface StatsBarProps {
  stats: FeedbackStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  // Build cards: total + top crew members (up to 3)
  const crewCards = stats.crewAggregations.slice(0, 3).map(ca => ({
    label: ca.crewMember,
    value: ca.count,
    color: 'var(--primary-color)',
  }));

  const cards = [
    { label: 'Total Feedback', value: stats.totalFeedback, color: 'var(--text-primary)' },
    ...crewCards,
  ];

  return (
    <div className={styles.bar} style={{ '--card-count': cards.length } as React.CSSProperties}>
      {cards.map(card => (
        <div key={card.label} className={styles.card}>
          <div className={styles.value} style={{ color: card.color }}>{card.value}</div>
          <div className={styles.label}>{card.label}</div>
        </div>
      ))}
    </div>
  );
}
