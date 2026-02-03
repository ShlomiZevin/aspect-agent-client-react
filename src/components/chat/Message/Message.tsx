import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message as MessageType } from '../../../types';
import { useChatContext } from '../../../context';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { DebugPanel } from '../DebugPanel';
import { FeedbackPanel } from '../FeedbackPanel';
import styles from './Message.module.css';

interface MessageProps {
  message: MessageType;
}

// Detect if text starts with RTL characters (Hebrew, Arabic)
function isRTL(text: string): boolean {
  const rtlChar = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/;
  const stripped = text.replace(/[^a-zA-Z\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/g, '');
  return rtlChar.test(stripped.charAt(0));
}

export function Message({ message }: MessageProps) {
  const { debugMode } = useChatContext();
  const [showFeedback, setShowFeedback] = useState(false);
  const isUser = message.role === 'user';
  const hasThinkingSteps = !isUser && message.thinkingSteps && message.thinkingSteps.length > 0;
  const rtl = isRTL(message.content);
  const canFeedback = !isUser && message.dbId;

  return (
    <div className={`${styles.message} ${isUser ? styles.user : styles.bot}`}>
      {isUser ? (
        <span dir={rtl ? 'rtl' : undefined}>{message.content}</span>
      ) : (
        <>
          <div className={styles.messageHeader}>
            {message.crewMember && (
              <div className={styles.crewLabel}>{message.crewMember}</div>
            )}
            {canFeedback && (
              <button
                className={styles.feedbackButton}
                onClick={() => setShowFeedback(!showFeedback)}
                title="Add feedback"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  <line x1="9" y1="10" x2="15" y2="10" />
                </svg>
              </button>
            )}
          </div>
          {hasThinkingSteps && (
            <ThinkingIndicator
              currentStep=""
              steps={message.thinkingSteps}
              isComplete={true}
            />
          )}
          <div className={styles.markdownContent} dir={rtl ? 'rtl' : undefined}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
          {debugMode && message.debugData && (
            <DebugPanel data={message.debugData} />
          )}
          {showFeedback && message.dbId && (
            <FeedbackPanel
              messageDbId={message.dbId}
              onClose={() => setShowFeedback(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
