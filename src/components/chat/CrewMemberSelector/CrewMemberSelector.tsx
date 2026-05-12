/**
 * CrewMemberSelector Component
 *
 * Dropdown to select/override the crew member for testing
 */

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAgentConfig } from '../../../context';
import { getTranslatedCrewName, getTranslatedCrewDescription } from '../../../i18n/crewTranslations';
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
  const { language, t } = useLanguage();
  const config = useAgentConfig();

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
    ? (() => {
        const crew = crewMembers.find(c => c.name === selectedOverride);
        return crew ? getTranslatedCrewName(config.agentName, crew.name, language, crew.displayName) : selectedOverride;
      })()
    : getTranslatedCrewName(config.agentName, 'auto', language, 'Auto');

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={styles.label}>{t('crewSelector.crew')}:</span>
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
            <span className={styles.optionName}>{getTranslatedCrewName(config.agentName, 'auto', language, 'Auto')}</span>
            <span className={styles.optionDescription}>
              {getTranslatedCrewDescription(config.agentName, 'auto', language, 'Automatic routing')} ({t('crewSelector.currently')}: {currentCrew ? getTranslatedCrewName(config.agentName, currentCrew.name, language, currentCrew.displayName) : t('crewSelector.none')})
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
                {getTranslatedCrewName(config.agentName, crew.name, language, crew.displayName)}
                {crew.isDefault && <span className={styles.badge}>{t('crewSelector.default')}</span>}
              </span>
              {crew.description && (
                <span className={styles.optionDescription}>
                  {getTranslatedCrewDescription(config.agentName, crew.name, language, crew.description)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
