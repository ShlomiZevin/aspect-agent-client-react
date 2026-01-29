import { useRef, useEffect } from 'react';
import { useChatContext } from '../../../context';
import { Message } from '../Message';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { WelcomeSection } from '../WelcomeSection';
import { ChatInput } from '../ChatInput';
import { CrewMemberIndicator } from '../CrewMemberIndicator';
import { CrewMemberSelector } from '../CrewMemberSelector';
import styles from './ChatContainer.module.css';

interface ChatContainerProps {
  showKBToggle?: boolean;
  showCrewSelector?: boolean;
}

export function ChatContainer({ showKBToggle = false, showCrewSelector = false }: ChatContainerProps) {
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
  } = useChatContext();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className={styles.container}>
      {/* Crew header - shows when agent has crew members */}
      {hasCrew && (
        <div className={styles.crewHeader}>
          <CrewMemberIndicator crew={currentCrew} isTransitioning={isThinking} />
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
      )}

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

            <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
          </>
        )}
      </div>

      <ChatInput showKBToggle={showKBToggle} />
    </div>
  );
}
