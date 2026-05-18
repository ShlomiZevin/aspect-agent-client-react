import { useRef, useEffect, useState, useMemo } from 'react';
import { useChatContext } from '../../../context';
import { useAgentContext } from '../../../context/AgentContext';
import { useLanguage } from '../../../context/LanguageContext';
import { Message } from '../Message';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { WelcomeSection } from '../WelcomeSection';
import { ChatInput } from '../ChatInput';
import { SyntheticControlPanel } from '../SyntheticControlPanel';
import { CrewMemberIndicator } from '../CrewMemberIndicator';
import { CrewMemberSelector } from '../CrewMemberSelector';
import { CrewJourneyStepper } from '../CrewJourneyStepper';
import { CrewJourneyModal } from '../CrewJourneyModal';
import { PromptEditorPanel } from '../PromptEditorPanel';
import { FieldsEditorPanel } from '../FieldsEditorPanel';
import { ContextEditorPanel } from '../ContextEditorPanel';
import { ProfilePanel } from '../ProfilePanel';
import { ExportImageModal } from '../ExportImageModal';
import { MOCK_CREW_MEMBERS } from '../../../mocks/promptMocks';
import { CrewTabs } from '../CrewTabs';
import { DataStatusBar } from '../DataStatusBar';
import styles from './ChatContainer.module.css';

interface ChatContainerProps {
  showCrewSelector?: boolean;
  crewMode?: 'journey' | 'tabs';
  crewPosition?: 'left' | 'right';
}

export function ChatContainer({ showCrewSelector = false, crewMode = 'journey', crewPosition = 'left' }: ChatContainerProps) {
  const {
    messages,
    isThinking,
    currentThinkingStep,
    thinkingSteps,
    hasStartedChat,
    crewMembers,
    currentCrew,
    selectedOverride,
    setSelectedOverride,
    hasCrew,
    isLoading,
    debugMode,
    journeySteps,
    isJourneyModalOpen,
    openJourneyModal,
    closeJourneyModal,
    agentName,
    baseURL,
    setPromptOverride,
    setModelOverride,
    setFallbackOverride,
    personaOverride,
    setPersonaOverride,
    setKBOverride,
    setThinkingPromptOverride,
    setThinkingModelOverride,
    thinkerDisabled,
    setThinkerDisabled,
    setTemperatureOverride,
    setTopKOverride,
    conversationId,
    isFieldsEditorOpen,
    setFieldsEditorOpen,
    canShowFieldsEditor,
    isContextEditorOpen,
    setContextEditorOpen,
    injectTransitionPrompt,
    fieldsRefreshKey,
    error,
    selectedMessageIds,
    copyMessages,
    clearMessageSelection,
    selectedTheme,
    setSelectedTheme,
    profileData,
    profilerLastRaw,
    profilerFreshStart,
    setProfilerFreshStart,
    profilerEnabled,
    setProfilerEnabled,
    conversationMetadata,
    restrictedMode,
  } = useChatContext();
  const { config } = useAgentContext();
  const { t } = useLanguage();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Prompt editor panel state (debug mode only)
  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);

  // Profile panel state (collapsible to the right)
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(true);

  // Export-to-image modal (debug mode, requires selected messages)
  const [exportModalIds, setExportModalIds] = useState<string[] | null>(null);

  // Use real crew members if available, otherwise use mock data for debug mode
  const effectiveCrewMembers = useMemo(() => {
    return hasCrew ? crewMembers : MOCK_CREW_MEMBERS;
  }, [hasCrew, crewMembers]);

  const effectiveCurrentCrew = useMemo(() => {
    if (currentCrew) return currentCrew;
    // In debug mode without real crew, use first mock crew member
    return debugMode ? MOCK_CREW_MEMBERS[0] : null;
  }, [currentCrew, debugMode]);

  // Auto-open prompt panel when entering debug mode
  useEffect(() => {
    if (debugMode) {
      setIsPromptPanelOpen(true);
    } else {
      setIsPromptPanelOpen(false);
    }
  }, [debugMode]);

  // Auto-scroll to bottom when new messages arrive or thinking updates
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        // Use scrollTop to ensure we're at the very bottom
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    };

    // Immediate scroll for thinking indicator visibility
    scrollToBottom();
    // Also scroll after delays to catch layout updates (especially for ThinkingIndicator)
    const timeoutId1 = setTimeout(scrollToBottom, 50);
    const timeoutId2 = setTimeout(scrollToBottom, 150);
    const timeoutId3 = setTimeout(scrollToBottom, 300);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
    };
  }, [messages, isThinking, currentThinkingStep, thinkingSteps.length]);

  // Determine if any right panel is open. Outside users don't see the profile panel.
  const hasProfilePanel = !!config.profileSchema && !restrictedMode;
  const hasOpenPanel = isPromptPanelOpen || isFieldsEditorOpen || isContextEditorOpen || (hasProfilePanel && isProfilePanelOpen);

  return (
    <div className={`${styles.wrapper} ${hasOpenPanel ? styles.withPanel : ''}`}>
      <div className={styles.container}>
        {debugMode && (
          <div className={styles.debugBadge}>
            <span>DEBUG MODE (Ctrl+Shift+D to toggle)</span>
            <button
              className={styles.promptEditorToggle}
              onClick={() => setIsPromptPanelOpen(!isPromptPanelOpen)}
              title={isPromptPanelOpen ? 'Hide Prompt Editor' : 'Show Prompt Editor'}
            >
              {isPromptPanelOpen ? 'Hide' : 'Show'} Prompt Editor
            </button>
          </div>
        )}

        {/* Floating copy bar when messages are selected */}
        {debugMode && selectedMessageIds.size > 0 && (
          <div className={styles.copyBar}>
            <span>{selectedMessageIds.size} selected</span>
            <button
              onClick={() => {
                copyMessages(Array.from(selectedMessageIds));
                clearMessageSelection();
              }}
            >
              Copy Selected
            </button>
            <button onClick={() => setExportModalIds(Array.from(selectedMessageIds))}>
              Export Image
            </button>
            <button onClick={clearMessageSelection}>
              Clear
            </button>
          </div>
        )}

        {exportModalIds && (
          <ExportImageModal
            selectedIds={exportModalIds}
            onClose={() => setExportModalIds(null)}
          />
        )}

        {/* Header bar with crew stepper/tabs — hidden for outside users. */}
        {!restrictedMode && <div className={`${styles.crewHeader} ${crewPosition === 'right' ? styles.crewHeaderRight : ''}`}>
          {hasCrew && crewMode === 'tabs' ? (
            <CrewTabs
              crewMembers={crewMembers}
              selectedCrew={selectedOverride}
              onSelect={setSelectedOverride}
              disabled={isLoading}
            />
          ) : hasCrew && (
            journeySteps.length >= 2 ? (
              <CrewJourneyStepper steps={journeySteps} onStepperClick={openJourneyModal} />
            ) : (
              <CrewMemberIndicator crew={currentCrew} isTransitioning={isThinking} />
            )
          )}
          {showCrewSelector && (
            <CrewMemberSelector
              crewMembers={crewMembers}
              currentCrew={currentCrew}
              selectedOverride={selectedOverride}
              onSelect={setSelectedOverride}
              disabled={isLoading}
            />
          )}
        </div>}

        <CrewJourneyModal
          steps={journeySteps}
          isOpen={isJourneyModalOpen}
          onClose={closeJourneyModal}
        />

        {config.features.showDataStatus && config.database?.schema && (
          <DataStatusBar baseURL={baseURL} schema={config.database.schema} />
        )}

        <div className={styles.messages} ref={messagesContainerRef}>
          {!hasStartedChat ? (
            <WelcomeSection />
          ) : (
            <>
              {messages.map((msg) => (
                <Message key={msg.id} message={msg} />
              ))}

              {isThinking && !restrictedMode && (
                <ThinkingIndicator
                  currentStep={currentThinkingStep}
                  steps={thinkingSteps}
                />
              )}

              {error && !isThinking && (
                <div className={styles.streamError}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
            </>
          )}
        </div>

        {conversationMetadata?.synthetic === true ? <SyntheticControlPanel /> : <ChatInput />}
      </div>

      {/* Prompt Editor Panel - Debug Mode Only */}
      {debugMode && isPromptPanelOpen && (
        <PromptEditorPanel
          crewMembers={effectiveCrewMembers}
          currentCrew={effectiveCurrentCrew}
          agentName={agentName}
          baseURL={baseURL}
          onClose={() => setIsPromptPanelOpen(false)}
          onSessionOverride={setPromptOverride}
          onModelOverride={setModelOverride}
          onFallbackOverride={setFallbackOverride}
          onKBOverride={setKBOverride}
          onFireTransitionPrompt={injectTransitionPrompt}
          personaOverride={personaOverride}
          onPersonaOverride={setPersonaOverride}
          onThinkingPromptOverride={setThinkingPromptOverride}
          onThinkingModelOverride={setThinkingModelOverride}
          thinkerDisabled={thinkerDisabled}
          onThinkerDisabledToggle={setThinkerDisabled}
          onTemperatureOverride={setTemperatureOverride}
          onTopKOverride={setTopKOverride}
          themes={config.themes}
          selectedTheme={selectedTheme}
          onThemeSelect={setSelectedTheme}
        />
      )}

      {/* Fields Editor Panel - Form mode crews or debug mode */}
      {canShowFieldsEditor && isFieldsEditorOpen && conversationId && (
        <FieldsEditorPanel
          conversationId={conversationId}
          baseURL={baseURL}
          isDebugMode={debugMode}
          onClose={() => setFieldsEditorOpen(false)}
          refreshKey={fieldsRefreshKey}
        />
      )}

      {/* Context Editor Panel - Debug mode only */}
      {debugMode && isContextEditorOpen && conversationId && (
        <ContextEditorPanel
          conversationId={conversationId}
          baseURL={baseURL}
          isDebugMode={debugMode}
          onClose={() => setContextEditorOpen(false)}
        />
      )}

      {/* Profile Panel - shown when agent has a profileSchema */}
      {hasProfilePanel && conversationId && config.profileSchema && isProfilePanelOpen && (
        <ProfilePanel
          conversationId={conversationId}
          baseURL={baseURL}
          profileSchema={config.profileSchema}
          refreshKey={fieldsRefreshKey}
          profilerData={profileData}
          profilerLastRaw={profilerLastRaw}
          debugMode={debugMode}
          agentName={config.agentName}
          freshStart={profilerFreshStart}
          onFreshStartChange={setProfilerFreshStart}
          profilerEnabled={profilerEnabled}
          onProfilerEnabledChange={setProfilerEnabled}
          onClose={() => setIsProfilePanelOpen(false)}
        />
      )}

      {/* Profile Panel reopen tab - shown when panel is closed */}
      {hasProfilePanel && !isProfilePanelOpen && (
        <button
          className={styles.profileToggle}
          onClick={() => setIsProfilePanelOpen(true)}
          title={t('chat.openProfilePanel')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <polyline points="15 11 18 14 21 11" />
          </svg>
        </button>
      )}
    </div>
  );
}