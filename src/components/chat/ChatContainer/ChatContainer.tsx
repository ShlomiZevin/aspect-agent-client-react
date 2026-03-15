import { useRef, useEffect, useState, useMemo } from 'react';
import { useChatContext } from '../../../context';
import { Message } from '../Message';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { WelcomeSection } from '../WelcomeSection';
import { ChatInput } from '../ChatInput';
import { CrewMemberIndicator } from '../CrewMemberIndicator';
import { CrewMemberSelector } from '../CrewMemberSelector';
import { CrewJourneyStepper } from '../CrewJourneyStepper';
import { CrewJourneyModal } from '../CrewJourneyModal';
import { PromptEditorPanel } from '../PromptEditorPanel';
import { FieldsEditorPanel } from '../FieldsEditorPanel';
import { ContextEditorPanel } from '../ContextEditorPanel';
import { MOCK_CREW_MEMBERS } from '../../../mocks/promptMocks';
import { CrewTabs } from '../CrewTabs';
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
    personaOverride,
    setPersonaOverride,
    setKBOverride,
    setThinkingPromptOverride,
    thinkerDisabled,
    setThinkerDisabled,
    conversationId,
    isFieldsEditorOpen,
    setFieldsEditorOpen,
    canShowFieldsEditor,
    isContextEditorOpen,
    setContextEditorOpen,
    injectTransitionPrompt,
    fieldsRefreshKey,
    error,
  } = useChatContext();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Prompt editor panel state (debug mode only)
  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);

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

  // Determine if any right panel is open
  const hasOpenPanel = isPromptPanelOpen || isFieldsEditorOpen || isContextEditorOpen;

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

        {/* Header bar with crew stepper/tabs */}
        <div className={`${styles.crewHeader} ${crewPosition === 'right' ? styles.crewHeaderRight : ''}`}>
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
        </div>

        <CrewJourneyModal
          steps={journeySteps}
          isOpen={isJourneyModalOpen}
          onClose={closeJourneyModal}
        />

        <div className={styles.messages} ref={messagesContainerRef}>
          {!hasStartedChat ? (
            <WelcomeSection />
          ) : (
            <>
              {messages.map((msg) => (
                <Message key={msg.id} message={msg} />
              ))}

              {isThinking && (
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

        <ChatInput />
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
          onKBOverride={setKBOverride}
          onFireTransitionPrompt={injectTransitionPrompt}
          personaOverride={personaOverride}
          onPersonaOverride={setPersonaOverride}
          onThinkingPromptOverride={setThinkingPromptOverride}
          thinkerDisabled={thinkerDisabled}
          onThinkerDisabledToggle={setThinkerDisabled}
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
    </div>
  );
}