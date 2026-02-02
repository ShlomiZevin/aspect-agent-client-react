import styles from './TagCloud.module.css';
import type { TagAggregation } from '../../../types/feedback';

interface TagCloudProps {
  aggregations: TagAggregation[];
  selectedTags: string[];
  onTagToggle: (tagName: string) => void;
}

export function TagCloud({ aggregations, selectedTags, onTagToggle }: TagCloudProps) {
  if (aggregations.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>Tags</div>
      <div className={styles.tags}>
        {aggregations.map(({ tag, count }) => {
          const isSelected = selectedTags.includes(tag.name);
          return (
            <button
              key={tag.name}
              className={`${styles.tag} ${isSelected ? styles.tagSelected : ''}`}
              style={{
                '--tag-color': tag.color,
                '--tag-bg': `${tag.color}15`,
                '--tag-bg-active': `${tag.color}25`,
              } as React.CSSProperties}
              onClick={() => onTagToggle(tag.name)}
              type="button"
            >
              <span className={styles.tagName}>{tag.name}</span>
              <span className={styles.tagCount}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
