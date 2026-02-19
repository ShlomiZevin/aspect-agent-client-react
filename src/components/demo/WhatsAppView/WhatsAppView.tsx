import type { DemoMessage, DemoConfig } from '../../../types/demo';
import styles from './WhatsAppView.module.css';

interface WhatsAppViewProps {
  messages: DemoMessage[];
  config: DemoConfig;
  onMessageClick?: (message: DemoMessage) => void;
  isEditable?: boolean;
}

export function WhatsAppView({
  messages,
  config,
  onMessageClick,
  isEditable = false,
}: WhatsAppViewProps) {
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backButton} aria-label="Back">
          {'<'}
        </button>

        <div
          className={styles.avatar}
          style={
            config.agentLogoUrl
              ? { backgroundImage: `url(${config.agentLogoUrl})` }
              : undefined
          }
        />

        <div className={styles.headerInfo}>
          <div className={styles.headerName}>{config.agentName || 'Assistant'}</div>
          <div className={styles.headerStatus}>online</div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.headerButton} aria-label="Video call">
            📹
          </button>
          <button className={styles.headerButton} aria-label="Voice call">
            📞
          </button>
          <button className={styles.headerButton} aria-label="More">
            ⋮
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            {isEditable ? 'Add messages to see them here' : 'No messages'}
          </div>
        ) : (
          <>
            {/* Date separator */}
            <div className={styles.dateSeparator}>
              <span className={styles.dateLabel}>Today</span>
            </div>

            {messages.map((msg) => {
              const isAgent = msg.side === 'left';

              return (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${
                    isAgent ? styles.messageRowLeft : styles.messageRowRight
                  }`}
                  onClick={() => isEditable && onMessageClick?.(msg)}
                  style={{ cursor: isEditable ? 'pointer' : 'default' }}
                >
                  {/* Agent avatar */}
                  {isAgent && (
                    <div
                      className={styles.messageAvatar}
                      style={
                        config.agentLogoUrl
                          ? { backgroundImage: `url(${config.agentLogoUrl})` }
                          : undefined
                      }
                    />
                  )}

                  <div className={styles.messageWrapper}>
                    <div className={styles.message}>
                      {isAgent && (
                        <div className={styles.senderName}>
                          {config.agentName || 'Assistant'}
                        </div>
                      )}
                      <div className={styles.messageText}>{msg.text}</div>
                      <div className={styles.messageFooter}>
                        <span className={styles.timestamp}>{msg.timestamp}</span>
                        {!isAgent && (
                          <span className={styles.checkmarks}>✓✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Input area (visual only) */}
      <div className={styles.inputArea}>
        <button className={styles.emojiButton} aria-label="Emoji">
          😊
        </button>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            className={styles.inputField}
            placeholder="Type a message"
            disabled
          />
          <button className={styles.attachButton} aria-label="Attach">
            📎
          </button>
        </div>
        <button className={styles.micButton} aria-label="Voice message">
          🎤
        </button>
      </div>
    </div>
  );
}
