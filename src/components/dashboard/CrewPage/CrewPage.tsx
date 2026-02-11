/**
 * CrewPage Component
 *
 * Dashboard page for managing crew members.
 * Lists all crew members and provides create/edit functionality.
 */
import { useState, useEffect, useCallback } from 'react';
import { getAgentCrew, getCrewMember } from '../../../services/crewService';
import { CrewGenerator } from '../CrewGenerator';
import { CrewEditor } from '../CrewEditor';
import type { CrewMember, CrewMemberConfig } from '../../../types/crew';
import styles from './CrewPage.module.css';

interface CrewPageProps {
  agentName: string;
  baseURL: string;
}

type ViewMode = 'list' | 'create' | 'edit';

export function CrewPage({ agentName, baseURL }: CrewPageProps) {
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedCrew, setSelectedCrew] = useState<CrewMemberConfig | null>(null);
  const [isLoadingCrew, setIsLoadingCrew] = useState(false);

  const loadCrewMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const crew = await getAgentCrew(agentName, baseURL);
      setCrewMembers(crew);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load crew members');
    } finally {
      setIsLoading(false);
    }
  }, [agentName, baseURL]);

  useEffect(() => {
    loadCrewMembers();
  }, [loadCrewMembers]);

  const handleCrewClick = async (crewName: string) => {
    setIsLoadingCrew(true);
    setError(null);

    try {
      const config = await getCrewMember(agentName, crewName, baseURL);
      if (config) {
        setSelectedCrew(config);
        setViewMode('edit');
      } else {
        setError(`Could not load crew member: ${crewName}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load crew member');
    } finally {
      setIsLoadingCrew(false);
    }
  };

  const handleCreateClick = () => {
    setViewMode('create');
    setSelectedCrew(null);
  };

  const handleCrewCreated = (crew: CrewMemberConfig) => {
    // Reload the list and go back to list view
    loadCrewMembers();
    setViewMode('list');
    setSelectedCrew(null);
  };

  const handleCrewSaved = (crew: CrewMemberConfig) => {
    // Reload the list
    loadCrewMembers();
    setSelectedCrew(crew);
  };

  const handleCrewDeleted = () => {
    // Reload the list and go back to list view
    loadCrewMembers();
    setViewMode('list');
    setSelectedCrew(null);
  };

  const handleCancel = () => {
    setViewMode('list');
    setSelectedCrew(null);
  };

  // Show loading overlay when loading a single crew
  if (isLoadingCrew) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>Loading crew member...</span>
        </div>
      </div>
    );
  }

  // Show generator view
  if (viewMode === 'create') {
    return (
      <div className={styles.container}>
        <CrewGenerator
          agentName={agentName}
          baseURL={baseURL}
          onCrewCreated={handleCrewCreated}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  // Show editor view
  if (viewMode === 'edit' && selectedCrew) {
    return (
      <div className={styles.container}>
        <CrewEditor
          agentName={agentName}
          crew={selectedCrew}
          baseURL={baseURL}
          onSaved={handleCrewSaved}
          onDeleted={handleCrewDeleted}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  // Show list view
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Crew Members</h1>
        <button className={styles.addButton} onClick={handleCreateClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Crew Member
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {isLoading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>Loading crew members...</span>
        </div>
      ) : crewMembers.length === 0 ? (
        <div className={styles.empty}>
          <svg className={styles.emptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3 className={styles.emptyTitle}>No Crew Members</h3>
          <p className={styles.emptyText}>
            Create your first crew member to get started. Crew members are specialized
            sub-agents that can handle different parts of conversations.
          </p>
          <button className={styles.addButton} onClick={handleCreateClick}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Crew Member
          </button>
        </div>
      ) : (
        <div className={styles.crewGrid}>
          {crewMembers.map(crew => (
            <div
              key={crew.name}
              className={styles.crewCard}
              onClick={() => handleCrewClick(crew.name)}
            >
              <div className={styles.crewCardHeader}>
                <h3 className={styles.crewCardTitle}>{crew.displayName}</h3>
                <div className={styles.crewCardTags}>
                  {crew.isDefault && (
                    <span className={`${styles.tag} ${styles.tagDefault}`}>Default</span>
                  )}
                  <span className={`${styles.tag} ${crew.source === 'database' ? styles.tagDatabase : styles.tagFile}`}>
                    {crew.source === 'database' ? 'DB' : 'File'}
                  </span>
                </div>
              </div>

              <div className={styles.crewCardId}>ID: {crew.name}</div>

              <p className={styles.crewCardDescription}>
                {crew.description || 'No description provided'}
              </p>

              <div className={styles.crewCardMeta}>
                <div className={styles.crewCardMetaItem}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  {crew.model}
                </div>

                {crew.toolCount > 0 && (
                  <div className={styles.crewCardMetaItem}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    {crew.toolCount} tool{crew.toolCount !== 1 ? 's' : ''}
                  </div>
                )}

                {crew.hasKnowledgeBase && (
                  <div className={styles.crewCardMetaItem}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    Knowledge Base
                  </div>
                )}

                {crew.transitionTo && (
                  <div className={styles.crewCardMetaItem}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {crew.transitionTo}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
