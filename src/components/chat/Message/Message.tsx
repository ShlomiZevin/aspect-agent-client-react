import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message as MessageType } from '../../../types';
import { ThinkingIndicator } from '../ThinkingIndicator';
import styles from './Message.module.css';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';
  const hasThinkingSteps = !isUser && message.thinkingSteps && message.thinkingSteps.length > 0;

  return (
    <div className={`${styles.message} ${isUser ? styles.user : styles.bot}`}>
      {isUser ? (
        <span>{message.content}</span>
      ) : (
        <>
          {hasThinkingSteps && (
            <ThinkingIndicator
              currentStep=""
              steps={message.thinkingSteps}
              isComplete={true}
            />
          )}
          <div className={styles.markdownContent}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </>
      )}
    </div>
  );
}
