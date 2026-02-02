import styles from './FeedbackFilters.module.css';

interface FeedbackFiltersProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  resultCount: number;
}

export function FeedbackFilters({
  searchText,
  onSearchChange,
  resultCount,
}: FeedbackFiltersProps) {
  return (
    <div className={styles.filters}>
      <div className={styles.searchWrapper}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search feedback, messages..."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchText && (
          <button
            className={styles.clearButton}
            onClick={() => onSearchChange('')}
            type="button"
            aria-label="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div className={styles.resultCount}>
        {resultCount} feedback {resultCount === 1 ? 'item' : 'items'}
      </div>
    </div>
  );
}
