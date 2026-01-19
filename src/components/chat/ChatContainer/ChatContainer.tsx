import { useRef, useEffect } from 'react';
import { useChatContext } from '../../../context';
import { Message } from '../Message';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { WelcomeSection } from '../WelcomeSection';
import { ChatInput } from '../ChatInput';
import styles from './ChatContainer.module.css';

interface ChatContainerProps {
  showKBToggle?: boolean;
}

export function ChatContainer({ showKBToggle = false }: ChatContainerProps) {
  const { messages, isThinking, currentThinkingStep, hasStartedChat } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <div className={styles.container}>
      <div className={styles.messages}>
        {!hasStartedChat ? (
          <WelcomeSection />
        ) : (
          <>
            {messages.map((msg) => (
              <Message key={msg.id} message={msg} />
            ))}

            {isThinking && (
              <ThinkingIndicator currentStep={currentThinkingStep} />
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <ChatInput showKBToggle={showKBToggle} />
    </div>
  );
}
