import { useChatContext } from '../../../context';
import { formatDate } from '../../../utils';
import styles from './HistorySidebar.module.css';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistorySidebar({ isOpen, onClose }: HistorySidebarProps) {
  const { conversations, conversationId, switchToChat, deleteChat } = useChatContext();

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation?')) {
      await deleteChat(chatId);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className={styles.overlay} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <h2 className={styles.title}>Chat History</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.list}>
          {conversations.length === 0 ? (
            <div className={styles.empty}>
              <p>No chat history yet</p>
            </div>
          ) : (
            conversations
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map((conv) => (
                <div
                  key={conv.id}
                  className={`${styles.item} ${conv.id === conversationId ? styles.active : ''}`}
                  onClick={() => switchToChat(conv.id)}
                >
                  <div className={styles.itemContent}>
                    <span className={styles.itemTitle}>
                      {conv.title || 'New Conversation'}
                    </span>
                    <span className={styles.itemDate}>
                      {formatDate(conv.updatedAt)}
                    </span>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(e, conv.id)}
                    aria-label="Delete conversation"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))
          )}
        </div>
      </aside>
    </>
  );
}
