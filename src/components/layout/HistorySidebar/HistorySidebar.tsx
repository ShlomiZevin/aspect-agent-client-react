import { useState, useRef, useEffect } from 'react';
import { useChatContext } from '../../../context';
import { useLanguage } from '../../../context/LanguageContext';
import { ConfirmDialog } from '../../common';
import { formatDate } from '../../../utils';
import styles from './HistorySidebar.module.css';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeleteConfirmState {
  isOpen: boolean;
  type: 'single' | 'all';
  chatId?: string;
}

export function HistorySidebar({ isOpen, onClose }: HistorySidebarProps) {
  const { conversations, conversationId, switchToChat, deleteChat, deleteAllChats, duplicateChat, updateChatTitle } = useChatContext();
  const { t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    isOpen: false,
    type: 'single',
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, type: 'single', chatId });
  };

  const handleDeleteAllClick = () => {
    if (conversations.length === 0) return;
    setDeleteConfirm({ isOpen: true, type: 'all' });
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteConfirm.type === 'single' && deleteConfirm.chatId) {
        await deleteChat(deleteConfirm.chatId);
      } else if (deleteConfirm.type === 'all') {
        await deleteAllChats();
      }
      setDeleteConfirm({ isOpen: false, type: 'single' });
    } catch (err) {
      console.error('Error deleting:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (!isDeleting) {
      setDeleteConfirm({ isOpen: false, type: 'single' });
    }
  };

  const handleDuplicateClick = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setDuplicatingId(chatId);
    try {
      await duplicateChat(chatId);
    } catch (err) {
      console.error('Failed to duplicate conversation:', err);
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleEditClick = (e: React.MouseEvent, chatId: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingId(chatId);
    setEditValue(currentTitle || '');
  };

  const handleSaveEdit = async (chatId: string) => {
    if (editValue.trim()) {
      try {
        await updateChatTitle(chatId, editValue.trim());
      } catch (err) {
        console.error('Failed to update title:', err);
      }
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, chatId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(chatId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditValue('');
    }
  };

  const handleBlur = (chatId: string) => {
    handleSaveEdit(chatId);
  };

  // Get dialog content based on delete type
  const getDeleteDialogContent = () => {
    if (deleteConfirm.type === 'all') {
      return {
        title: t('sidebar.deleteAll'),
        message: t('sidebar.confirmDeleteAll'),
        confirmText: t('sidebar.deleteAll'),
      };
    }
    return {
      title: t('sidebar.delete'),
      message: t('message.confirmDelete'),
      confirmText: t('sidebar.delete'),
    };
  };

  const dialogContent = getDeleteDialogContent();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className={styles.overlay} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('sidebar.history')}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.list}>
          {conversations.length > 0 && (
            <div className={styles.deleteAllRow}>
              <button
                className={styles.deleteAllBtn}
                onClick={handleDeleteAllClick}
                aria-label={t('sidebar.deleteAll')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {t('sidebar.deleteAll')}
              </button>
            </div>
          )}
          {conversations.length === 0 ? (
            <div className={styles.empty}>
              <p>{t('sidebar.noChats')}</p>
            </div>
          ) : (
            conversations
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map((conv) => {
                const isWhatsApp = conv.channel === 'whatsapp';
                const isEditing = editingId === conv.id;

                return (
                  <div
                    key={conv.id}
                    className={`${styles.item} ${conv.id === conversationId ? styles.active : ''} ${isWhatsApp ? styles.whatsapp : ''}`}
                    onClick={() => { if (!isEditing) { switchToChat(conv.id); onClose(); } }}
                  >
                    <div className={styles.itemContent}>
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          className={styles.editInput}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, conv.id)}
                          onBlur={() => handleBlur(conv.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={styles.itemTitle}>
                          {conv.title || 'New Conversation'}
                        </span>
                      )}
                      <div className={styles.itemMeta}>
                        <span className={styles.itemDate}>
                          {formatDate(conv.updatedAt)}
                        </span>
                        {isWhatsApp && (
                          <span className={styles.whatsappBadge}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.itemActions}>
                      {!isEditing && (
                        <>
                          <button
                            className={styles.editBtn}
                            onClick={(e) => handleEditClick(e, conv.id, conv.title)}
                            aria-label="Edit conversation name"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className={styles.editBtn}
                            onClick={(e) => handleDuplicateClick(e, conv.id)}
                            aria-label="Duplicate conversation"
                            disabled={duplicatingId === conv.id}
                          >
                            {duplicatingId === conv.id ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}>
                                <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </>
                      )}
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => handleDeleteClick(e, conv.id)}
                        aria-label="Delete conversation"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </aside>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={dialogContent.title}
        message={dialogContent.message}
        confirmText={dialogContent.confirmText}
        cancelText={t('common.cancel')}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}
