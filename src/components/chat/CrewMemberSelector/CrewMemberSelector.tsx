/**
 * CrewMemberSelector Component
 *
 * Dropdown to select/override the crew member for testing
 */

import { useState, useRef, useEffect } from 'react';
import styles from './CrewMemberSelector.module.css';
import type { CrewMember } from '../../../types/crew';

interface CrewMemberSelectorProps {
  crewMembers: CrewMember[];
  currentCrew: CrewMember | null;
  selectedOverride: string | null;
  onSelect: (crewName: string | null) => void;
  disabled?: boolean;
}

export function CrewMemberSelector({
  crewMembers,
  currentCrew,
  selectedOverride,
  onSelect,
  disabled = false
}: CrewMemberSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't show if no crew members
  if (crewMembers.length === 0) return null;

  const displayName = selectedOverride
    ? crewMembers.find(c => c.name === selectedOverride)?.displayName || selectedOverride
    : 'Auto';

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={styles.label}>Crew:</span>
        <span className={styles.value}>{displayName}</span>
        <svg
          className={`${styles.arrow} ${isOpen ? styles.open : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {/* Auto option */}
          <button
            className={`${styles.option} ${!selectedOverride ? styles.active : ''}`}
            onClick={() => {
              onSelect(null);
              setIsOpen(false);
            }}
            role="option"
            aria-selected={!selectedOverride}
          >
            <span className={styles.optionName}>Auto</span>
            <span className={styles.optionDescription}>
              Automatic routing (currently: {currentCrew?.displayName || 'none'})
            </span>
          </button>

          <div className={styles.divider} />

          {/* Crew members */}
          {crewMembers.map(crew => (
            <button
              key={crew.name}
              className={`${styles.option} ${selectedOverride === crew.name ? styles.active : ''}`}
              onClick={() => {
                onSelect(crew.name);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={selectedOverride === crew.name}
            >
              <span className={styles.optionName}>
                {crew.displayName}
                {crew.isDefault && <span className={styles.badge}>Default</span>}
              </span>
              {crew.description && (
                <span className={styles.optionDescription}>{crew.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
