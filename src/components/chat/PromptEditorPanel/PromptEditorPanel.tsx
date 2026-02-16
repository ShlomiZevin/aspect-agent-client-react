import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { CrewMember } from '../../../types/crew';
import type { CrewMemberPrompt } from '../../../types/promptEditor';
import {
  getAgentPrompts,
  createPromptVersion,
  updatePromptVersion,
  activatePromptVersion,
  deletePromptVersion,
} from '../../../services/promptService';
import styles from './PromptEditorPanel.module.css';

const AVAILABLE_MODELS = [
  // GPT-4 family
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  // GPT-5 family
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  // Reasoning models
  'o3-mini',
  'o4-mini',
];

const AVAILABLE_PROVIDERS = ['openai', 'anthropic'];

interface PromptEditorPanelProps {
  crewMembers: CrewMember[];
  currentCrew: CrewMember | null;
  agentName: string;
  baseURL: string;
  onClose: () => void;
  onSessionOverride: (crewMemberId: string, prompt: string) => void;
  onModelOverride: (crewMemberId: string, model: string) => void;
  onFireTransitionPrompt?: (content: string, crewMemberName?: string) => Promise<void>;
}

type StatusType = 'success' | 'error' | 'info' | null;

interface Status {
  type: StatusType;
  message: string;
}

export function PromptEditorPanel({
  crewMembers,
  currentCrew,
  agentName,
  baseURL,
  onClose,
  onSessionOverride,
  onModelOverride,
  onFireTransitionPrompt,
}: PromptEditorPanelProps) {
  // Prompts data from API
  const [prompts, setPrompts] = useState<CrewMemberPrompt[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);

  // Selected crew member for editing
  const [selectedCrewId, setSelectedCrewId] = useState<string>(
    currentCrew?.name || crewMembers[0]?.name || ''
  );

  // Current prompt being edited
  const [editedPrompt, setEditedPrompt] = useState<string>('');

  // Original prompt (for dirty checking and revert)
  const [originalPrompt, setOriginalPrompt] = useState<string>('');

  // Session override state
  const [sessionOverrides, setSessionOverrides] = useState<Record<string, string>>({});

  // Model/provider override state
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});
  const [providerOverrides, setProviderOverrides] = useState<Record<string, string>>({});

  // Status message
  const [status, setStatus] = useState<Status>({ type: null, message: '' });

  // Loading state for save operations
  const [isSaving, setIsSaving] = useState(false);

  // New version modal state
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionName, setVersionName] = useState('');

  // Selected version ID (for version switching)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Transition system prompt state
  const [editedTransitionPrompt, setEditedTransitionPrompt] = useState<string>('');
  const [originalTransitionPrompt, setOriginalTransitionPrompt] = useState<string>('');
  const [showTransitionPrompt, setShowTransitionPrompt] = useState(false);
  const [isFiring, setIsFiring] = useState(false);

  // Load prompts from API
  useEffect(() => {
    async function loadPrompts() {
      if (!agentName) return;

      setIsLoadingPrompts(true);
      try {
        const data = await getAgentPrompts(agentName, baseURL);
        setPrompts(data);
      } catch (error) {
        console.error('Failed to load prompts:', error);
        setStatus({ type: 'error', message: 'Failed to load prompts from server' });
      } finally {
        setIsLoadingPrompts(false);
      }
    }

    loadPrompts();
  }, [agentName, baseURL]);

  // Get the selected crew member's prompt data
  const selectedPromptData = prompts.find(p => p.crewMemberId === selectedCrewId);

  // Get the currently selected version (or default to currentVersion/active)
  const selectedVersion = selectedPromptData?.versions.find(v => v.id === selectedVersionId)
    || selectedPromptData?.currentVersion;

  // Check if the current prompt is dirty (modified)
  const isMainDirty = editedPrompt !== originalPrompt;

  // Check if transition prompt is dirty
  const isTransitionDirty = editedTransitionPrompt !== originalTransitionPrompt;

  // Either prompt is dirty
  const isDirty = isMainDirty || isTransitionDirty;

  // Check if there's a session override for the selected crew
  const hasSessionOverride = selectedCrewId in sessionOverrides;
  const hasModelOverride = selectedCrewId in modelOverrides;

  // Get default model for the selected crew
  const selectedCrewMember = crewMembers.find(c => c.name === selectedCrewId);
  const defaultModel = selectedCrewMember?.model || 'gpt-4';
  const currentModel = modelOverrides[selectedCrewId] || defaultModel;
  const currentProvider = providerOverrides[selectedCrewId] || 'openai';

  // Check if selected version is from code (v0 = not in DB yet)
  const isCodeVersion = selectedVersion?.version === 0;

  // Check if selected version is the active one
  const isActiveVersion = selectedVersion?.isActive === true;

  // Track the last loaded version to avoid reloading on every render
  const lastLoadedVersionRef = useRef<string | null>(null);

  // Load prompt when crew member or version selection changes (NOT on sessionOverrides change)
  useEffect(() => {
    if (selectedVersion) {
      const versionKey = `${selectedCrewId}-${selectedVersion.id}`;
      // Only reload if we switched to a different version
      if (lastLoadedVersionRef.current !== versionKey) {
        lastLoadedVersionRef.current = versionKey;
        // Check if there's a session override (only apply to active version)
        const override = selectedVersion.isActive ? sessionOverrides[selectedCrewId] : undefined;
        const prompt = override || selectedVersion.prompt;
        setEditedPrompt(prompt);
        setOriginalPrompt(selectedVersion.prompt);
        // Load transition system prompt
        setEditedTransitionPrompt(selectedVersion.transitionSystemPrompt || '');
        setOriginalTransitionPrompt(selectedVersion.transitionSystemPrompt || '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCrewId, selectedVersion?.id]);

  // Reset version selection when crew changes
  useEffect(() => {
    setSelectedVersionId(null);
  }, [selectedCrewId]);

  // Sync with current crew when it changes externally (not from dropdown)
  useEffect(() => {
    if (currentCrew) {
      setSelectedCrewId(currentCrew.name);
    }
    // Only sync when currentCrew changes, not when selectedCrewId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCrew?.name]);

  // Handle crew member selection change
  const handleCrewSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCrewId = e.target.value;
    setSelectedCrewId(newCrewId);
    setStatus({ type: null, message: '' });
  }, []);

  // Handle version selection change
  const handleVersionSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const versionId = e.target.value;
    setSelectedVersionId(versionId || null);
    setStatus({ type: null, message: '' });
  }, []);

  // Debounced session override to prevent re-rendering the entire context tree on every keystroke
  const debouncedSessionOverride = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (crewId: string, prompt: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        onSessionOverride(crewId, prompt);
      }, 300);
    };
  }, [onSessionOverride]);

  // Handle prompt text change
  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setEditedPrompt(newPrompt);

    // Apply session override with debouncing to avoid performance issues
    if (newPrompt !== originalPrompt) {
      setSessionOverrides(prev => ({ ...prev, [selectedCrewId]: newPrompt }));
      debouncedSessionOverride(selectedCrewId, newPrompt);

      if (!hasSessionOverride) {
        setStatus({ type: 'info', message: 'Session override active - this change is temporary' });
      }
    }
  }, [selectedCrewId, originalPrompt, hasSessionOverride, debouncedSessionOverride]);

  // Handle model change
  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    if (newModel === defaultModel) {
      // Revert to default - clear override
      setModelOverrides(prev => {
        const next = { ...prev };
        delete next[selectedCrewId];
        return next;
      });
      onModelOverride(selectedCrewId, '');
    } else {
      setModelOverrides(prev => ({ ...prev, [selectedCrewId]: newModel }));
      onModelOverride(selectedCrewId, newModel);
      setStatus({ type: 'info', message: `Model override: ${newModel}` });
    }
  }, [selectedCrewId, defaultModel, onModelOverride]);

  // Handle provider change (future use)
  const handleProviderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setProviderOverrides(prev => ({ ...prev, [selectedCrewId]: newProvider }));
  }, [selectedCrewId]);

  // Revert to original prompt and model
  const handleRevert = useCallback(() => {
    if (selectedVersion) {
      setEditedPrompt(selectedVersion.prompt);
      setEditedTransitionPrompt(selectedVersion.transitionSystemPrompt || '');
      // Remove session override if reverting active version
      if (selectedVersion.isActive) {
        setSessionOverrides(prev => {
          const next = { ...prev };
          delete next[selectedCrewId];
          return next;
        });
        onSessionOverride(selectedCrewId, ''); // Clear the override
      }
      // Also revert model override
      setModelOverrides(prev => {
        const next = { ...prev };
        delete next[selectedCrewId];
        return next;
      });
      onModelOverride(selectedCrewId, '');
      setProviderOverrides(prev => {
        const next = { ...prev };
        delete next[selectedCrewId];
        return next;
      });
      setStatus({ type: 'success', message: 'Reverted to original' });
    }
  }, [selectedVersion, selectedCrewId, onSessionOverride, onModelOverride]);

  // Save current version (overwrite) - only for DB versions
  const handleSave = useCallback(async () => {
    if (!selectedCrewId || !editedPrompt.trim() || !selectedVersion) return;

    // For code versions, we need to create a new DB version instead
    if (isCodeVersion) {
      setStatus({ type: 'info', message: 'Code version cannot be overwritten. Use "Save as New Version"' });
      return;
    }

    setIsSaving(true);
    try {
      const versionId = selectedVersion.id;
      await updatePromptVersion(agentName, selectedCrewId, versionId, editedPrompt, baseURL, editedTransitionPrompt || undefined);

      setOriginalPrompt(editedPrompt);
      setOriginalTransitionPrompt(editedTransitionPrompt);
      // Remove session override since it's now saved
      setSessionOverrides(prev => {
        const next = { ...prev };
        delete next[selectedCrewId];
        return next;
      });
      setStatus({ type: 'success', message: 'Prompt saved successfully!' });

      // Reload prompts to get updated data
      const data = await getAgentPrompts(agentName, baseURL);
      setPrompts(data);
    } catch (error) {
      console.error('Failed to save prompt:', error);
      setStatus({ type: 'error', message: 'Failed to save prompt' });
    } finally {
      setIsSaving(false);
    }
  }, [selectedCrewId, editedPrompt, editedTransitionPrompt, selectedVersion, isCodeVersion, agentName, baseURL]);

  // Open modal to save as new version
  const handleOpenVersionModal = useCallback(() => {
    setVersionName('');
    setShowVersionModal(true);
  }, []);

  // Close version modal
  const handleCloseVersionModal = useCallback(() => {
    setShowVersionModal(false);
    setVersionName('');
  }, []);

  // Save as new version with name
  const handleSaveAsNewVersion = useCallback(async () => {
    if (!selectedCrewId || !editedPrompt.trim() || !versionName.trim()) return;

    setIsSaving(true);
    setShowVersionModal(false);
    try {
      const newVersion = await createPromptVersion(
        agentName,
        selectedCrewId,
        editedPrompt,
        versionName.trim(),
        baseURL,
        editedTransitionPrompt || undefined
      );

      setOriginalPrompt(editedPrompt);
      setOriginalTransitionPrompt(editedTransitionPrompt);
      // Remove session override since it's now saved
      setSessionOverrides(prev => {
        const next = { ...prev };
        delete next[selectedCrewId];
        return next;
      });
      setStatus({
        type: 'success',
        message: `Saved as v${newVersion.version} - ${newVersion.name}`
      });
      setVersionName('');

      // Reload prompts to get updated data
      const data = await getAgentPrompts(agentName, baseURL);
      setPrompts(data);
    } catch (error) {
      console.error('Failed to save new version:', error);
      setStatus({ type: 'error', message: 'Failed to save new version' });
    } finally {
      setIsSaving(false);
    }
  }, [selectedCrewId, editedPrompt, editedTransitionPrompt, versionName, agentName, baseURL]);

  // Activate selected version (make it the active one)
  const handleActivateVersion = useCallback(async () => {
    if (!selectedCrewId || !selectedVersion || isActiveVersion) return;

    setIsSaving(true);
    try {
      await activatePromptVersion(agentName, selectedCrewId, selectedVersion.id, baseURL);
      setStatus({ type: 'success', message: `v${selectedVersion.version} is now active` });

      // Reload prompts to get updated data
      const data = await getAgentPrompts(agentName, baseURL);
      setPrompts(data);
      // Reset version selection to show the new active version
      setSelectedVersionId(null);
      lastLoadedVersionRef.current = null; // Force reload
    } catch (error) {
      console.error('Failed to activate version:', error);
      setStatus({ type: 'error', message: 'Failed to activate version' });
    } finally {
      setIsSaving(false);
    }
  }, [selectedCrewId, selectedVersion, isActiveVersion, agentName, baseURL]);

  // Delete selected version
  const handleDeleteVersion = useCallback(async () => {
    if (!selectedCrewId || !selectedVersion) return;

    // Can't delete active version
    if (isActiveVersion) {
      setStatus({ type: 'error', message: 'Cannot delete active version. Activate another version first.' });
      return;
    }

    // Confirm deletion
    if (!window.confirm(`Delete v${selectedVersion.version}${selectedVersion.name ? ` - ${selectedVersion.name}` : ''}?`)) {
      return;
    }

    setIsSaving(true);
    try {
      await deletePromptVersion(agentName, selectedCrewId, selectedVersion.id, baseURL);
      setStatus({ type: 'success', message: `v${selectedVersion.version} deleted` });

      // Reload prompts to get updated data
      const data = await getAgentPrompts(agentName, baseURL);
      setPrompts(data);
      // Reset version selection
      setSelectedVersionId(null);
      lastLoadedVersionRef.current = null; // Force reload
    } catch (error) {
      console.error('Failed to delete version:', error);
      setStatus({ type: 'error', message: 'Failed to delete version' });
    } finally {
      setIsSaving(false);
    }
  }, [selectedCrewId, selectedVersion, isActiveVersion, agentName, baseURL]);

  // Clear status after delay
  useEffect(() => {
    if (status.type) {
      const timer = setTimeout(() => {
        setStatus({ type: null, message: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h3>Prompt Editor</h3>
          <span className={styles.debugBadge}>DEBUG</span>
        </div>
        <button
          className={styles.closeButton}
          onClick={onClose}
          title="Close panel"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className={styles.content}>
        {/* Crew Member Selector */}
        <div className={styles.selectorSection}>
        <label className={styles.selectorLabel}>Crew Member</label>
        <select
          className={styles.crewSelect}
          value={selectedCrewId}
          onChange={handleCrewSelect}
          disabled={isLoadingPrompts}
        >
          {crewMembers.map(crew => (
            <option key={crew.name} value={crew.name}>
              {crew.displayName}
              {crew.name === currentCrew?.name ? ' (Active)' : ''}
            </option>
          ))}
        </select>

        {/* Version Selector */}
        {selectedPromptData && selectedPromptData.versions.length > 0 && (
          <div className={styles.versionSection}>
            <label className={styles.selectorLabel}>Version</label>
            <div className={styles.versionSelectRow}>
              <select
                className={styles.versionSelect}
                value={selectedVersionId || selectedPromptData.currentVersion?.id || ''}
                onChange={handleVersionSelect}
              >
                {selectedPromptData.versions.map(version => (
                  <option key={version.id} value={version.id}>
                    v{version.version}
                    {version.name ? ` - ${version.name}` : ''}
                    {version.isActive ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
              {/* Version action buttons */}
              <button
                className={styles.versionActionButton}
                onClick={handleActivateVersion}
                disabled={isActiveVersion || isSaving}
                title={isActiveVersion ? 'This version is already active' : 'Make this version active'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <button
                className={`${styles.versionActionButton} ${styles.deleteButton}`}
                onClick={handleDeleteVersion}
                disabled={isActiveVersion || isSaving}
                title={isActiveVersion ? 'Cannot delete active version' : 'Delete this version'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
            {hasSessionOverride && isActiveVersion && (
              <span className={styles.sessionOverrideBadge}>
                SESSION OVERRIDE
              </span>
            )}
          </div>
        )}

        {/* Model & Provider Selectors */}
        <div className={styles.modelProviderRow}>
          <div className={styles.modelSection}>
            <label className={styles.selectorLabel}>Model</label>
            <select
              className={styles.crewSelect}
              value={currentModel}
              onChange={handleModelChange}
            >
              {AVAILABLE_MODELS.map(model => (
                <option key={model} value={model}>
                  {model}{model === defaultModel ? ' (default)' : ''}
                </option>
              ))}
            </select>
            {hasModelOverride && (
              <span className={styles.sessionOverrideBadge}>
                OVERRIDE
              </span>
            )}
          </div>
          <div className={styles.providerSection}>
            <label className={styles.selectorLabel}>Provider</label>
            <select
              className={styles.crewSelect}
              value={currentProvider}
              onChange={handleProviderChange}
              disabled={AVAILABLE_PROVIDERS.length <= 1}
            >
              {AVAILABLE_PROVIDERS.map(provider => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoadingPrompts ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>...</div>
          <p className={styles.emptyText}>Loading prompts...</p>
        </div>
      ) : selectedPromptData ? (
        <>
          {/* Main Prompt Editor */}
          <div className={styles.editorSection}>
            <div className={styles.editorLabel}>
              <span className={styles.editorLabelText}>Prompt Content</span>
              <span className={styles.charCount}>
                {editedPrompt.length} chars
              </span>
            </div>
            <textarea
              className={`${styles.promptTextarea} ${isDirty ? styles.dirty : ''}`}
              value={editedPrompt}
              onChange={handlePromptChange}
              placeholder="Enter the crew member's prompt..."
              spellCheck={false}
            />
          </div>

          {/* Transition System Prompt (Collapsible) */}
          <div className={styles.editorSection}>
            <button
              className={styles.collapsibleHeader}
              onClick={() => setShowTransitionPrompt(!showTransitionPrompt)}
              type="button"
            >
              <span className={styles.editorLabelText}>
                Transition System Prompt
                {editedTransitionPrompt && <span className={styles.hasContentBadge}>SET</span>}
              </span>
              <svg
                className={`${styles.chevron} ${showTransitionPrompt ? styles.expanded : ''}`}
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showTransitionPrompt && (
              <>
                <p className={styles.helperText}>
                  Injected once when transitioning to this crew. Uses &apos;developer&apos; role for highest authority.
                </p>
                <textarea
                  className={`${styles.promptTextarea} ${styles.transitionTextarea} ${isTransitionDirty ? styles.dirty : ''}`}
                  value={editedTransitionPrompt}
                  onChange={(e) => setEditedTransitionPrompt(e.target.value)}
                  placeholder="e.g., [CONTEXT SWITCH] Your role has changed. Disregard previous conversation patterns..."
                  spellCheck={false}
                  rows={4}
                />
                <div className={styles.transitionActions}>
                  <span className={styles.charCount}>
                    {editedTransitionPrompt.length} chars
                  </span>
                  {onFireTransitionPrompt && (
                    <button
                      className={styles.fireNowButton}
                      onClick={async () => {
                        if (!editedTransitionPrompt.trim()) return;
                        setIsFiring(true);
                        try {
                          await onFireTransitionPrompt(editedTransitionPrompt, selectedCrewId);
                          setStatus({ type: 'success', message: 'Transition prompt injected into chat!' });
                        } catch {
                          setStatus({ type: 'error', message: 'Failed to inject prompt' });
                        } finally {
                          setIsFiring(false);
                        }
                      }}
                      disabled={!editedTransitionPrompt.trim() || isFiring}
                      title="Inject this prompt into the conversation now (for testing)"
                      type="button"
                    >
                      {isFiring ? (
                        'Firing...'
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          Fire Now
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>no data</div>
          <p className={styles.emptyText}>
            No prompt data available for this crew member.
            <br />
            Select a different crew member or check the server.
          </p>
        </div>
      )}
      </div>

      {/* Action Buttons */}
      <div className={styles.actionsSection}>
        <div className={styles.actionButtons}>
          <div className={styles.actionRow}>
            <button
              className={`${styles.actionButton} ${styles.revertButton}`}
              onClick={handleRevert}
              disabled={!isDirty && !hasSessionOverride && !hasModelOverride}
              title="Discard changes and reload original prompt"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Revert
            </button>
            <button
              className={`${styles.actionButton} ${styles.saveButton}`}
              onClick={handleSave}
              disabled={!isDirty || isSaving || isCodeVersion}
              title={isCodeVersion ? 'Code version - use Save as New Version' : 'Save and overwrite current version'}
            >
              {isSaving ? (
                'Saving...'
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Save
                </>
              )}
            </button>
          </div>
          <button
            className={`${styles.actionButton} ${styles.saveNewVersionButton}`}
            onClick={handleOpenVersionModal}
            disabled={!isDirty || isSaving}
            title="Create a new version with these changes"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Save as New Version
          </button>
        </div>

        {/* Status Message */}
        {status.type && (
          <div className={`${styles.statusMessage} ${styles[status.type]}`}>
            {status.type === 'success' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {status.type === 'error' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {status.type === 'info' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
            {status.message}
          </div>
        )}
      </div>

      {/* New Version Modal */}
      {showVersionModal && (
        <div className={styles.modalOverlay} onClick={handleCloseVersionModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>Save as New Version</h4>
              <button
                className={styles.modalCloseButton}
                onClick={handleCloseVersionModal}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDescription}>
                Enter a name/tag for this version to help identify what changed.
              </p>
              <div className={styles.modalInputGroup}>
                <label className={styles.modalLabel}>Version Name</label>
                <input
                  type="text"
                  className={styles.modalInput}
                  value={versionName}
                  onChange={e => setVersionName(e.target.value)}
                  placeholder="e.g., Added empathy guidelines"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && versionName.trim()) {
                      handleSaveAsNewVersion();
                    }
                    if (e.key === 'Escape') {
                      handleCloseVersionModal();
                    }
                  }}
                />
              </div>
              <div className={styles.modalPreview}>
                <span className={styles.modalPreviewLabel}>Will be saved as:</span>
                <span className={styles.modalPreviewValue}>
                  v{Math.max(...(selectedPromptData?.versions.map(v => v.version) || [0])) + 1}
                  {versionName.trim() ? ` - ${versionName.trim()}` : ''}
                </span>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={`${styles.actionButton} ${styles.revertButton}`}
                onClick={handleCloseVersionModal}
              >
                Cancel
              </button>
              <button
                className={`${styles.actionButton} ${styles.saveButton}`}
                onClick={handleSaveAsNewVersion}
                disabled={!versionName.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
