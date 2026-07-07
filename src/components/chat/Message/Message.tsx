import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message as MessageType } from '../../../types';
import { useChatContext, useAgentConfig } from '../../../context';
import { useLanguage } from '../../../context/LanguageContext';
import { getTranslatedCrewName } from '../../../i18n/crewTranslations';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { DebugPanel } from '../DebugPanel';
import { FeedbackPanel } from '../FeedbackPanel';
import { AgentBugModal } from '../AgentBugModal/AgentBugModal';
import { DataTableModal } from './DataTableModal';
import type { DisplayColumn } from './DataTableModal';
import { parseMarkdownTables } from './parseMarkdownTables';
import { createTask, getAssignees } from '../../../services/taskService';
import { useCommenterIdentity } from '../../../hooks/useCommenterIdentity';
import type { CreateTaskData } from '../../../types/task';
import styles from './Message.module.css';

interface MessageProps {
  message: MessageType;
  /** True while this specific message is still the live streaming target
   * (tool call running / more text still to come). Drives whether its
   * ThinkingIndicator shows as active or already "done". */
  isStreaming?: boolean;
}

// Detect if the message's primary direction is RTL (Hebrew, Arabic).
// Finds the first real letter of any script — if it's Hebrew/Arabic → RTL.
// Cyrillic, Latin, etc. → LTR (fixes mixed Hebrew+Russian responses).
function isRTL(text: string): boolean {
  const rtlChar = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/;
  const firstLetter = text.match(/\p{L}/u);
  return firstLetter ? rtlChar.test(firstLetter[0]) : false;
}

/** Known UI element types. Only these are parsed as interactive markup. */
const UI_ELEMENT_TYPES = ['buttons', 'chips', 'checkbox', 'radio', 'toggle', 'select', 'id', 'input'];

/** Parse UI element markup from message text. Only matches known types: [buttons: a | b], [chips: x | y], etc. */
function parseUIElements(text: string): { cleanText: string; elements: { type: string; options: string[] }[] } {
  const typesPattern = UI_ELEMENT_TYPES.join('|');
  const regex = new RegExp(`\\[(${typesPattern}):\\s*(.+?)\\]`, 'g');
  const elements: { type: string; options: string[] }[] = [];
  const cleanText = text.replace(regex, (_, type, opts) => {
    elements.push({ type, options: opts.split('|').map((o: string) => o.trim()) });
    return '';
  }).trim();
  return { cleanText, elements };
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

export function Message({ message, isStreaming = false }: MessageProps) {
  const { debugMode, deleteMessagesFrom, crewMembers, conversationId, selectedMessageIds, toggleMessageSelect, copyMessages, copyFromMessage, messages, sendMessage, restrictedMode } = useChatContext();
  const { t, language } = useLanguage();
  const config = useAgentConfig();
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const { identity: commenterIdentity } = useCommenterIdentity();
  const [bugAssignees, setBugAssignees] = useState<import('../../../types/task').Assignee[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [idProcessing, setIdProcessing] = useState(false);
  const [idCaptured, setIdCaptured] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [openTableIdx, setOpenTableIdx] = useState<number | null>(null);
  const isUser = message.role === 'user';
  const isDeveloper = message.role === 'developer';
  // Outside users never see thinking steps inside the bubble, never get the feedback button.
  const hasThinkingSteps = !restrictedMode && !isUser && !isDeveloper && message.thinkingSteps && message.thinkingSteps.length > 0;
  const rtl = isRTL(message.content);

  // Full structured query results the agent attached to this message (one per
  // fetch). In the LIVE session these carry the COMPLETE row set; reopened
  // (historical) conversations only have `sql`/`schema` — rows are never
  // persisted (see thinking.service.js) — and DataTableModal re-runs the
  // query itself when it opens.
  const dataTables = (!isUser && !isDeveloper && message.thinkingSteps)
    ? message.thinkingSteps.filter(s => {
        if (s.stepType !== 'data_table') return false;
        const meta = s.metadata as { rows?: unknown[]; sql?: string } | null;
        return Array.isArray(meta?.rows) || typeof meta?.sql === 'string';
      })
    : [];
  const canFeedback = !restrictedMode && !isUser && !isDeveloper && message.dbId;
  const canReportBug = debugMode && !isUser && !isDeveloper;
  // Agents whose backend has no message deletion hide per-message actions.
  const showActions = !config.features.hideMessageActions;

  // Parse UI elements from bot messages
  const { cleanText: uiCleanText, elements: uiElements } = (!isUser && !isDeveloper)
    ? parseUIElements(message.content)
    : { cleanText: message.content, elements: [] };
  // Disable UI elements if a subsequent message exists (user already responded)
  const msgIndex = messages.findIndex((m: MessageType) => m.id === message.id);
  const uiDisabled = uiElements.length > 0 && msgIndex >= 0 && msgIndex < messages.length - 1;

  // Tables the user can open in the full sortable/filterable/Excel-export viewer.
  // Prefer the structured tool result (`data_table` step — carries the COMPLETE
  // row set). Fall back to parsing a markdown table out of the reply so agents
  // without a data tool (e.g. Aspect demo crews) still get the viewer/export.
  const toolTables = dataTables.map(step => {
    const meta = step.metadata as {
      rowCount?: number;
      rows?: Record<string, unknown>[];
      columns?: unknown;
      displayColumns?: DisplayColumn[];
      title?: string;
      sql?: string;
      schema?: string;
    };
    return {
      rows: (meta.rows ?? []) as Record<string, unknown>[],
      columns: meta.columns,
      displayColumns: meta.displayColumns,
      title: meta.title?.trim() || undefined,
      count: meta.rowCount ?? meta.rows?.length ?? 0,
      sql: meta.sql,
      schema: meta.schema,
    };
  });
  // A BI data-fetch tool (fetch_hypertoy_data, fetch_zer4u_data, ...) was called
  // but returned no data_table step — meaning the result was small enough
  // (≤20 rows) to already be shown IN FULL in the chat text itself. In that
  // case do NOT fall back to parsing a markdown table out of the reply: the
  // text already IS the complete data, a second "view full table" button would
  // be redundant and confusing (nothing more to see than what's already shown).
  const hasBIDataFetchCall = (message.thinkingSteps ?? []).some(s => {
    if (s.stepType !== 'function_call') return false;
    const fn = (s.metadata as { functionName?: string } | null)?.functionName;
    return typeof fn === 'string' && /^fetch_.*_data$/.test(fn);
  });
  const markdownTables = (toolTables.length === 0 && !hasBIDataFetchCall && !isUser && !isDeveloper)
    ? parseMarkdownTables(uiCleanText).map(tbl => ({
        rows: tbl.rows as Record<string, unknown>[],
        columns: tbl.columns,
        displayColumns: undefined as DisplayColumn[] | undefined,
        title: tbl.title,
        count: tbl.rows.length,
        sql: undefined as string | undefined,
        schema: undefined as string | undefined,
      }))
    : [];
  const viewerTables = toolTables.length ? toolTables : markdownTables;

  // When disabled, parse the next user message to recover submitted input values (for display)
  const nextUserMsg = uiElements.length > 0
    ? messages.slice(msgIndex + 1).find((m: MessageType) => m.role === 'user')
    : undefined;
  const collectedInputs: Record<string, string> = {};
  if (uiDisabled && nextUserMsg?.content) {
    for (const line of nextUserMsg.content.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k && v) collectedInputs[k] = v;
      }
    }
  }

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

  const isSelected = selectedMessageIds.has(message.id);

  const showCopyFeedback = (text: string) => {
    setCopyFeedback(text);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  const handleCopySingle = () => {
    copyMessages([message.id]);
    showCopyFeedback('Copied');
  };

  const handleCopyFromHere = () => {
    copyFromMessage(message.id);
    showCopyFeedback('Copied to end');
  };

  // Developer messages only visible in debug mode
  if (isDeveloper && !debugMode) {
    return null;
  }

  const CopyActions = () => debugMode && !isDeveloper ? (
    <>
      {copyFeedback && <span className={styles.copyFeedback}>{copyFeedback}</span>}
      <button
        className={styles.copyButton}
        onClick={handleCopySingle}
        title="Copy this message"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      </button>
      <button
        className={styles.copyButton}
        onClick={handleCopyFromHere}
        title="Copy from here to end"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          <path d="M16 17v4" strokeWidth="2.5" />
          <path d="M14 19h4" strokeWidth="2.5" />
        </svg>
      </button>
      <label className={styles.selectCheckbox} title="Select for batch copy">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleMessageSelect(message.id)}
        />
      </label>
    </>
  ) : null;

  const DeleteButton = () => (
    <button
      className={styles.deleteButton}
      onClick={handleDeleteClick}
      title={t('message.delete')}
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
        <h3 className={styles.deleteModalTitle}>{t('message.delete')}</h3>
        <p className={styles.deleteModalText}>
          {t('message.confirmDelete')}
        </p>
        <div className={styles.deleteModalActions}>
          <button
            type="button"
            className={styles.deleteModalCancel}
            onClick={handleCancelDelete}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={styles.deleteModalConfirm}
            onClick={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? `${t('common.loading')}...` : t('common.delete')}
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
              {showActions && <DeleteButton />}
            </div>
            <pre className={styles.developerContent}>{message.content}</pre>
          </div>
        ) : isUser ? (
          <div className={styles.userMessageWrapper}>
            <span dir={rtl ? 'rtl' : undefined}>{message.content}</span>
            <div className={styles.messageActions}>
              <CopyActions />
              {showActions && <DeleteButton />}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.messageHeader}>
              {message.crewMember && (
                <div className={styles.crewLabel}>
                  {(() => {
                    // Look up the actual crew name from the crewMembers list
                    // message.crewMember is the displayName, but translations use the file-based name
                    const match = crewMembers.find(c =>
                      c.displayName.toLowerCase() === message.crewMember?.toLowerCase()
                    );
                    const crewName = match?.name ?? message.crewMember;
                    return getTranslatedCrewName(config.agentName, crewName, language, message.crewMember);
                  })()}
                </div>
              )}
              <div className={styles.headerActions}>
                {canReportBug && (
                  <button
                    className={styles.bugButton}
                    onClick={() => { setShowBugModal(true); getAssignees().then(setBugAssignees).catch(() => {}); }}
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
                <CopyActions />
                {showActions && <DeleteButton />}
              </div>
            </div>
            {hasThinkingSteps && (
              <ThinkingIndicator
                currentStep=""
                steps={message.thinkingSteps}
                isComplete={!isStreaming}
              />
            )}
            <div className={styles.markdownContent} dir={rtl ? 'rtl' : undefined}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                  )
                }}
              >
                {uiCleanText}
              </ReactMarkdown>
            </div>
            {viewerTables.length > 0 && (
              <div className={styles.dataTableButtons}>
                {viewerTables.map((tbl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={styles.dataTableBtn}
                    onClick={() => setOpenTableIdx(idx)}
                  >
                    📊 {tbl.title || t('chat.viewFullTable')} ({tbl.count})
                  </button>
                ))}
              </div>
            )}
            {openTableIdx !== null && viewerTables[openTableIdx] && (
              <DataTableModal
                rows={viewerTables[openTableIdx].rows}
                columns={viewerTables[openTableIdx].columns}
                displayColumns={viewerTables[openTableIdx].displayColumns}
                sql={viewerTables[openTableIdx].sql}
                schema={viewerTables[openTableIdx].schema}
                title={viewerTables[openTableIdx].title || t('chat.dataTableTitle')}
                baseURL={config.baseURL}
                exportLabel={t('chat.exportToExcel')}
                filterPlaceholder={t('chat.filterRows')}
                closeLabel={t('chat.close')}
                loadingLabel={t('chat.loadingTable')}
                rowsLabel={(n) => `${n} ${t('chat.rows')}`}
                onClose={() => setOpenTableIdx(null)}
              />
            )}
            {uiElements.length > 0 && (() => {
              const inputEls = uiElements.filter(e => e.type === 'input');
              const otherEls = uiElements.filter(e => e.type !== 'input');
              const hasInputs = inputEls.length > 0;
              const handleInputSubmit = () => {
                if (uiDisabled) return;
                const lines = inputEls
                  .map(el => {
                    const label = el.options[0] || '';
                    const val = (inputValues[label] || '').trim();
                    return val ? `${label}: ${val}` : null;
                  })
                  .filter(Boolean);
                if (idCaptured) {
                  lines.push('העליתי את תעודת הזהות שלי. מספר זהות: 036538809');
                }
                if (lines.length === 0) return;
                sendMessage(lines.join('\n'));
              };
              return (
                <>
                  {(() => {
                    const visibleInputEls = uiDisabled
                      ? inputEls.filter(el => collectedInputs[el.options[0] || ''])
                      : inputEls;
                    if (visibleInputEls.length === 0) return null;
                    return (
                    <div className={`${styles.uiInputForm} ${uiDisabled ? styles.uiInputFormCollected : ''}`}>
                      {visibleInputEls.map((el, i) => {
                        const label = el.options[0] || '';
                        const displayValue = uiDisabled
                          ? (collectedInputs[label] || '')
                          : (inputValues[label] || '');
                        return (
                          <div key={`in-${i}`} className={styles.uiInputField}>
                            <label className={styles.uiInputLabel}>{label}</label>
                            <input
                              type="text"
                              className={`${styles.uiInputBox} ${uiDisabled && displayValue ? styles.uiInputBoxCollected : ''}`}
                              disabled={uiDisabled}
                              value={displayValue}
                              onChange={(e) => setInputValues(v => ({ ...v, [label]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleInputSubmit(); }}
                            />
                          </div>
                        );
                      })}
                      {!uiDisabled && (
                        <button
                          type="button"
                          className={`${styles.uiElement} ${styles.uiInputSubmit}`}
                          onClick={handleInputSubmit}
                        >
                          שליחה
                        </button>
                      )}
                      {uiDisabled && (
                        <div className={styles.uiInputCollectedBadge}>✅ נשלח</div>
                      )}
                    </div>
                    );
                  })()}
                  {otherEls.length > 0 && (
                    <div className={styles.uiElementRow}>
                      {otherEls.map((el, i) => {
                  if (el.type === 'id') {
                    const label = el.options[0] || 'העלאת תעודת זהות 📷';
                    const inputId = `id-upload-${message.id}-${i}`;
                    const MOCK_UPLOAD_PREFIX = 'העליתי את תעודת הזהות שלי';
                    const wasUploaded = nextUserMsg?.content?.includes(MOCK_UPLOAD_PREFIX);
                    const hasIdNumber = nextUserMsg?.content ? /\d{9}/.test(nextUserMsg.content) : false;
                    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file || idProcessing || uiDisabled) return;
                      setIdProcessing(true);
                      setTimeout(() => {
                        setIdProcessing(false);
                        if (hasInputs) {
                          setIdCaptured(true);
                        } else {
                          sendMessage('העליתי את תעודת הזהות שלי. מספר זהות: 036538809');
                        }
                      }, 2000);
                    };
                    if (uiDisabled && (wasUploaded || hasIdNumber)) {
                      const doneText = wasUploaded ? '✅ תעודת זהות הועלתה' : '✅ מספר זהות הוזן';
                      return (
                        <span key={i}>
                          <label className={`${styles.uiElement} ${styles.uiType_id} ${styles.uiDisabled} ${styles.uiType_id_uploaded}`}>
                            {doneText}
                          </label>
                        </span>
                      );
                    }
                    return (
                      <span key={i}>
                        <input
                          id={inputId}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={idProcessing || idCaptured}
                          onChange={handleFileSelected}
                        />
                        <label
                          htmlFor={inputId}
                          className={`${styles.uiElement} ${styles.uiType_id} ${(idProcessing || idCaptured) ? styles.uiDisabled : ''} ${idCaptured ? styles.uiType_id_uploaded : ''}`}
                        >
                          {idProcessing ? (
                            <span className={styles.idProcessing}>
                              <span className={styles.idSpinner} />
                              מעבד את תעודת הזהות שלך...
                            </span>
                          ) : idCaptured ? (
                            '✅ תעודת זהות הועלתה'
                          ) : label}
                        </label>
                      </span>
                    );
                  }
                  return el.options.map((option, j) => (
                    <button
                      key={`${i}-${j}`}
                      type="button"
                      className={`${styles.uiElement} ${styles[`uiType_${el.type}`] || ''} ${uiDisabled ? styles.uiDisabled : ''}`}
                      disabled={uiDisabled}
                      onClick={() => sendMessage(option)}
                    >
                      {option}
                    </button>
                  ));
                      })}
                    </div>
                  )}
                </>
              );
            })()}
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
          assignees={bugAssignees}
          openerIdentity={commenterIdentity || undefined}
          conversationId={conversationId}
        />
      )}
    </>
  );
}
