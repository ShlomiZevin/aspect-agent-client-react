import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUserById } from '../../../services/adminService';
import { getConversationHistory } from '../../../services/conversationService';
import type { AdminUserDetails, AdminConversation } from '../../../types/admin';
import type { Message } from '../../../types';
import styles from './UserConversationsPage.module.css';

interface UserConversationsPageProps {
  baseURL: string;
  basePath: string; // e.g. /banking-v2/admin or /banking-v2/dashboard
}

export function UserConversationsPage({ baseURL, basePath }: UserConversationsPageProps) {
  const navigate = useNavigate();
  const { userId: userIdParam, conversationId: convIdParam } = useParams<{
    userId: string;
    conversationId?: string;
  }>();
  const userId = userIdParam ? parseInt(userIdParam, 10) : null;

  const [user, setUser] = useState<AdminUserDetails | null>(null);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user + conversations.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoadingUser(true);
    setUserError(null);
    getUserById(userId, baseURL)
      .then(details => {
        if (cancelled) return;
        setUser(details);
        const convs = details.conversations || [];
        setConversations(convs);
        // Auto-select the most recent conversation if the URL doesn't pin one.
        if (!convIdParam && convs.length > 0) {
          navigate(`${basePath}/users/${userId}/conversations/${convs[0].externalId}`, { replace: true });
        }
      })
      .catch(err => {
        if (cancelled) return;
        setUserError(err instanceof Error ? err.message : 'Failed to load user');
      })
      .finally(() => {
        if (!cancelled) setLoadingUser(false);
      });
    return () => { cancelled = true; };
    // Intentionally exclude convIdParam/navigate so we don't re-fetch on conv selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, baseURL]);

  // Load messages for the active conversation.
  useEffect(() => {
    if (!convIdParam) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    setMessagesError(null);
    getConversationHistory(convIdParam, baseURL)
      .then(data => {
        if (cancelled) return;
        // Server returns messages in chronological (ascending) order.
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
  }, [convIdParam, baseURL]);

  // Scroll to bottom whenever a conversation is freshly loaded.
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

  const activeConv = conversations.find(c => c.externalId === convIdParam);

  const handleBack = () => navigate(`${basePath}/users`);
  const handleSelectConv = (externalId: string) => {
    navigate(`${basePath}/users/${userId}/conversations/${externalId}`);
  };

  if (!userId) {
    return <div className={styles.error}>Invalid user ID.</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={handleBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back to users</span>
        </button>

        {user && (
          <div className={styles.userMeta}>
            <h2 className={styles.title}>{user.name || user.externalId}</h2>
            <p className={styles.subtitle}>
              {user.phone ? `${user.phone} · ` : ''}
              {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          {loadingUser && <div className={styles.empty}>Loading conversations...</div>}
          {userError && <div className={styles.error}>{userError}</div>}
          {!loadingUser && !userError && conversations.length === 0 && (
            <div className={styles.empty}>No conversations.</div>
          )}
          {conversations.map(conv => {
            const isActive = conv.externalId === convIdParam;
            return (
              <button
                key={conv.id}
                className={`${styles.convItem} ${isActive ? styles.convItemActive : ''}`}
                onClick={() => handleSelectConv(conv.externalId)}
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
  );
}
