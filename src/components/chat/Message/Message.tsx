import { formatMessage } from '../../../utils';
import type { Message as MessageType } from '../../../types';
import styles from './Message.module.css';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`${styles.message} ${isUser ? styles.user : styles.bot}`}>
      {isUser ? (
        <span>{message.content}</span>
      ) : (
        <div
          className="message-content"
          dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
        />
      )}
    </div>
  );
}
