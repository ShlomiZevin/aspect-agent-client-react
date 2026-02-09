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
  const { debugMode, deleteMessage, deleteMessagesFrom } = useChatContext();
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const isUser = message.role === 'user';
  const isDeveloper = message.role === 'developer';
  const hasThinkingSteps = !isUser && !isDeveloper && message.thinkingSteps && message.thinkingSteps.length > 0;
  const rtl = isRTL(message.content);
  const canFeedback = !isUser && !isDeveloper && message.dbId;

  const handleDelete = async () => {
    if (window.confirm('Delete this message?')) {
      await deleteMessage(message.id, message.dbId);
    }
    setShowDeleteMenu(false);
  };

  const handleDeleteFrom = async () => {
    if (window.confirm('Delete this message and all messages after it?')) {
      await deleteMessagesFrom(message.id, message.dbId);
    }
    setShowDeleteMenu(false);
  };

  // Developer messages only visible in debug mode
  if (isDeveloper && !debugMode) {
    return null;
  }

  return (
    <div className={`${styles.message} ${isUser ? styles.user : isDeveloper ? styles.developer : styles.bot}`}>
      {isDeveloper ? (
        <div className={styles.developerMessage}>
          <div className={styles.developerHeader}>
            <span className={styles.developerBadge}>DEVELOPER</span>
            <span className={styles.developerLabel}>
              {message.injectionMeta?.crewMemberName
                ? `Transition prompt for: ${message.injectionMeta.crewMemberName}`
                : 'Injected for testing'}
            </span>
            <button
              className={styles.deleteButton}
              onClick={() => setShowDeleteMenu(!showDeleteMenu)}
              title="Delete message"
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
            {showDeleteMenu && (
              <div className={styles.deleteMenu}>
                <button onClick={handleDelete} type="button">Delete this message</button>
                <button onClick={handleDeleteFrom} type="button">Delete from here</button>
              </div>
            )}
          </div>
          <pre className={styles.developerContent}>{message.content}</pre>
        </div>
      ) : isUser ? (
        <div className={styles.userMessageWrapper}>
          <span dir={rtl ? 'rtl' : undefined}>{message.content}</span>
          <div className={styles.messageActions}>
            <button
              className={styles.deleteButton}
              onClick={() => setShowDeleteMenu(!showDeleteMenu)}
              title="Delete message"
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
            {showDeleteMenu && (
              <div className={styles.deleteMenu}>
                <button onClick={handleDelete} type="button">Delete this message</button>
                <button onClick={handleDeleteFrom} type="button">Delete from here</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className={styles.messageHeader}>
            {message.crewMember && (
              <div className={styles.crewLabel}>{message.crewMember}</div>
            )}
            <div className={styles.headerActions}>
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
              <button
                className={styles.deleteButton}
                onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                title="Delete message"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
              {showDeleteMenu && (
                <div className={styles.deleteMenu}>
                  <button onClick={handleDelete} type="button">Delete this message</button>
                  <button onClick={handleDeleteFrom} type="button">Delete from here</button>
                </div>
              )}
            </div>
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
