import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message as MessageType } from '../../../types';
import { ThinkingIndicator } from '../ThinkingIndicator';
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
  const isUser = message.role === 'user';
  const hasThinkingSteps = !isUser && message.thinkingSteps && message.thinkingSteps.length > 0;
  const rtl = isRTL(message.content);

  return (
    <div className={`${styles.message} ${isUser ? styles.user : styles.bot}`}>
      {isUser ? (
        <span dir={rtl ? 'rtl' : undefined}>{message.content}</span>
      ) : (
        <>
          {message.crewMember && (
            <div className={styles.crewLabel}>{message.crewMember}</div>
          )}
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
        </>
      )}
    </div>
  );
}
