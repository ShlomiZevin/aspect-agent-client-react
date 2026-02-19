import type { DemoMessage, DemoConfig, ColorScheme } from '../../../types/demo';
import styles from './RegularView.module.css';

interface RegularViewProps {
  messages: DemoMessage[];
  config: DemoConfig;
  onMessageClick?: (message: DemoMessage) => void;
  isEditable?: boolean;
}

const schemeClassMap: Record<ColorScheme, string> = {
  'light-blue': styles.schemeLightBlue,
  'light-green': styles.schemeLightGreen,
  'light-purple': styles.schemeLightPurple,
  'light-coral': styles.schemeLightCoral,
  'dark-blue': styles.schemeDarkBlue,
  'dark-green': styles.schemeDarkGreen,
  'dark-purple': styles.schemeDarkPurple,
  'dark-slate': styles.schemeDarkSlate,
};

export function RegularView({
  messages,
  config,
  onMessageClick,
  isEditable = false,
}: RegularViewProps) {
  const schemeClass = schemeClassMap[config.colorScheme] || styles.schemeLightBlue;

  return (
    <div className={`${styles.container} ${schemeClass}`}>
      {/* Header */}
      <div className={styles.header}>
        <div
          className={styles.logo}
          style={
            config.agentLogoUrl
              ? { backgroundImage: `url(${config.agentLogoUrl})` }
              : undefined
          }
        />
        <div className={styles.headerInfo}>
          <div className={styles.headerTitle}>{config.agentName || 'Assistant'}</div>
          <div className={styles.headerSubtitle}>Online</div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            {isEditable ? 'Add messages to see them here' : 'No messages'}
          </div>
        ) : (
          messages.map((msg) => {
            const isBot = msg.side === 'left';

            if (isBot && config.agentLogoUrl) {
              // Bot message with avatar
              return (
                <div key={msg.id} className={styles.avatarWrapper}>
                  <div
                    className={styles.messageAvatar}
                    style={{ backgroundImage: `url(${config.agentLogoUrl})` }}
                  />
                  <div
                    className={`${styles.messageWrapper} ${styles.messageLeft} ${
                      isEditable ? styles.editable : ''
                    }`}
                    onClick={() => isEditable && onMessageClick?.(msg)}
                  >
                    <div className={styles.message}>
                      <div className={styles.senderName}>
                        {config.agentName || 'Assistant'}
                      </div>
                      <div
                      className={styles.messageText}
                      dir={config.language === 'he' ? 'rtl' : 'ltr'}
                    >
                      {msg.text}
                    </div>
                      <div className={styles.messageFooter}>
                        <span className={styles.timestamp}>{msg.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Regular message (user or bot without avatar)
            return (
              <div
                key={msg.id}
                className={`${styles.messageWrapper} ${
                  msg.side === 'left' ? styles.messageLeft : styles.messageRight
                } ${isEditable ? styles.editable : ''}`}
                onClick={() => isEditable && onMessageClick?.(msg)}
              >
                <div className={styles.message}>
                  <div className={styles.senderName}>
                    {msg.side === 'left'
                      ? config.agentName || 'Assistant'
                      : msg.senderName || config.senderName || 'User'}
                  </div>
                  <div
                      className={styles.messageText}
                      dir={config.language === 'he' ? 'rtl' : 'ltr'}
                    >
                      {msg.text}
                    </div>
                  <div className={styles.messageFooter}>
                    <span className={styles.timestamp}>{msg.timestamp}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input area (visual only) */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            className={styles.inputField}
            placeholder="Type a message..."
            disabled
          />
        </div>
        <button className={styles.sendButton} aria-label="Send">
          ➤
        </button>
      </div>
    </div>
  );
}
