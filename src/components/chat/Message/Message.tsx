import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message as MessageType } from '../../../types';
import { useChatContext } from '../../../context';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { DebugPanel } from '../DebugPanel';
import { FeedbackPanel } from '../FeedbackPanel';
import { AgentBugModal } from '../AgentBugModal/AgentBugModal';
import { createTask } from '../../../services/taskService';
import type { CreateTaskData } from '../../../types/task';
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

// Known domains for task filtering
const KNOWN_DOMAINS = ['freeda', 'aspect', 'banking', 'byline'];

// Get domain from URL path (matches TaskBoardModal logic)
function getDomainFromUrl(): string {
  const path = window.location.pathname.toLowerCase();
  for (const domain of KNOWN_DOMAINS) {
    if (path.startsWith(`/${domain}`)) {
      return domain;
    }
  }
  return 'general';
}

export function Message({ message }: MessageProps) {
  const { debugMode, deleteMessagesFrom, crewMembers, conversationId } = useChatContext();
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isUser = message.role === 'user';
  const isDeveloper = message.role === 'developer';
  const hasThinkingSteps = !isUser && !isDeveloper && message.thinkingSteps && message.thinkingSteps.length > 0;
  const rtl = isRTL(message.content);
  const canFeedback = !isUser && !isDeveloper && message.dbId;
  const canReportBug = debugMode && !isUser && !isDeveloper;

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    await deleteMessagesFrom(message.id, message.dbId);
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Developer messages only visible in debug mode
  if (isDeveloper && !debugMode) {
    return null;
  }

  const DeleteButton = () => (
    <button
      className={styles.deleteButton}
      onClick={handleDeleteClick}
      title="Delete from here"
      type="button"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    </button>
  );

  const DeleteConfirmModal = () => (
    <div className={styles.deleteModalOverlay} onClick={handleCancelDelete}>
      <div className={styles.deleteModal} onClick={e => e.stopPropagation()}>
        <div className={styles.deleteModalIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>
        <h3 className={styles.deleteModalTitle}>Delete messages?</h3>
        <p className={styles.deleteModalText}>
          This will remove this message and all messages after it.
        </p>
        <div className={styles.deleteModalActions}>
          <button
            type="button"
            className={styles.deleteModalCancel}
            onClick={handleCancelDelete}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.deleteModalConfirm}
            onClick={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
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
              <DeleteButton />
            </div>
            <pre className={styles.developerContent}>{message.content}</pre>
          </div>
        ) : isUser ? (
          <div className={styles.userMessageWrapper}>
            <span dir={rtl ? 'rtl' : undefined}>{message.content}</span>
            <div className={styles.messageActions}>
              <DeleteButton />
            </div>
          </div>
        ) : (
          <>
            <div className={styles.messageHeader}>
              {message.crewMember && (
                <div className={styles.crewLabel}>{message.crewMember}</div>
              )}
              <div className={styles.headerActions}>
                {canReportBug && (
                  <button
                    className={styles.bugButton}
                    onClick={() => setShowBugModal(true)}
                    title="Report agent bug"
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 2L8 5" />
                      <path d="M16 2L16 5" />
                      <path d="M3 10H21" />
                      <path d="M3 14H21" />
                      <path d="M5 18L2 21" />
                      <path d="M19 18L22 21" />
                      <rect x="4" y="5" width="16" height="16" rx="4" />
                    </svg>
                  </button>
                )}
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
                <DeleteButton />
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
      {showDeleteConfirm && <DeleteConfirmModal />}
      {showBugModal && (
        <AgentBugModal
          isOpen={showBugModal}
          onClose={() => setShowBugModal(false)}
          onSubmit={async (data: CreateTaskData) => {
            await createTask(data);
          }}
          message={message}
          currentDomain={getDomainFromUrl()}
          conversationUrl={window.location.href}
          crewMembers={crewMembers}
          conversationId={conversationId}
        />
      )}
    </>
  );
}
