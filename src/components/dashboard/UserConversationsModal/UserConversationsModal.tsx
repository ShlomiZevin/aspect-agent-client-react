import { useEffect, useRef, useState } from 'react';
import { getUserById } from '../../../services/adminService';
import { getConversationHistory } from '../../../services/conversationService';
import type { AdminUser, AdminConversation } from '../../../types/admin';
import type { Message } from '../../../types';
import styles from './UserConversationsModal.module.css';

interface UserConversationsModalProps {
  baseURL: string;
  user: AdminUser;
  onClose: () => void;
}

export function UserConversationsModal({ baseURL, user, onClose }: UserConversationsModalProps) {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [convsError, setConvsError] = useState<string | null>(null);

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations for the user; auto-select the most recent one.
  useEffect(() => {
    let cancelled = false;
    setLoadingConvs(true);
    setConvsError(null);
    getUserById(user.id, baseURL)
      .then(details => {
        if (cancelled) return;
        const convs = details.conversations || [];
        setConversations(convs);
        if (convs.length > 0) setActiveConvId(convs[0].externalId);
      })
      .catch(err => {
        if (cancelled) return;
        setConvsError(err instanceof Error ? err.message : 'Failed to load conversations');
      })
      .finally(() => {
        if (!cancelled) setLoadingConvs(false);
      });
    return () => { cancelled = true; };
  }, [user.id, baseURL]);

  // Load messages for the active conversation.
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    setMessagesError(null);
    getConversationHistory(activeConvId, baseURL)
      .then(data => {
        if (cancelled) return;
        // Server already returns messages in chronological (ascending) order.
        setMessages(data.messages);
      })
      .catch(err => {
        if (cancelled) return;
        setMessagesError(err instanceof Error ? err.message : 'Failed to load messages');
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => { cancelled = true; };
  }, [activeConvId, baseURL]);

  // Scroll to bottom whenever a conversation is freshly loaded (newest message in view).
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [loadingMessages, messages.length]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const activeConv = conversations.find(c => c.externalId === activeConvId);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{user.name || user.externalId}</h2>
            <p className={styles.subtitle}>
              {user.phone ? `${user.phone} · ` : ''}
              {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <aside className={styles.sidebar}>
            {loadingConvs && <div className={styles.empty}>Loading conversations...</div>}
            {convsError && <div className={styles.error}>{convsError}</div>}
            {!loadingConvs && !convsError && conversations.length === 0 && (
              <div className={styles.empty}>No conversations.</div>
            )}
            {conversations.map(conv => {
              const isActive = conv.externalId === activeConvId;
              return (
                <button
                  key={conv.id}
                  className={`${styles.convItem} ${isActive ? styles.convItemActive : ''}`}
                  onClick={() => setActiveConvId(conv.externalId)}
                >
                  <div className={styles.convItemTop}>
                    <span className={styles.convDate}>{formatDate(conv.updatedAt)}</span>
                    <span className={`${styles.channel} ${styles[conv.channel]}`}>{conv.channel}</span>
                  </div>
                  <div className={styles.convId} title={conv.externalId}>
                    {conv.externalId.slice(0, 32)}{conv.externalId.length > 32 ? '…' : ''}
                  </div>
                </button>
              );
            })}
          </aside>

          <section className={styles.chatPane}>
            {!activeConv ? (
              <div className={styles.placeholder}>Select a conversation to view messages.</div>
            ) : (
              <>
                <div className={styles.chatHeader}>
                  <div>
                    <div className={styles.chatHeaderDate}>{formatDate(activeConv.updatedAt)}</div>
                    <div className={styles.chatHeaderId} title={activeConv.externalId}>
                      {activeConv.externalId}
                    </div>
                  </div>
                  <span className={`${styles.channel} ${styles[activeConv.channel]}`}>
                    {activeConv.channel}
                  </span>
                </div>

                <div className={styles.messagesScroll} dir="rtl">
                  {loadingMessages && <div className={styles.empty}>Loading messages...</div>}
                  {messagesError && <div className={styles.error}>{messagesError}</div>}
                  {!loadingMessages && !messagesError && messages.length === 0 && (
                    <div className={styles.empty}>No messages.</div>
                  )}
                  {!loadingMessages && messages.map(msg => (
                    <div key={msg.id} className={`${styles.message} ${styles[`role_${msg.role}`]}`}>
                      <div className={styles.messageHeader} dir="ltr">
                        <span className={styles.role}>{msg.role}</span>
                        {msg.crewMember && <span className={styles.crew}>{msg.crewMember}</span>}
                        <span className={styles.timestamp}>{formatDate(msg.timestamp.toISOString())}</span>
                      </div>
                      <div className={styles.content} dir="auto">{msg.content}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
