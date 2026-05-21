/**
 * PromptTemplateModal — preview of the exact prompt this addon will
 * send to the LLM, populated with values from the current config.
 *
 * Two columns:
 *   - Left: the assembled prompt (template + substituted values).
 *   - Right: history sidebar — at runtime the LLM also receives a
 *     separate `messages` parameter. We fetch the actual transcript
 *     from the active preview conversation and render the slice that
 *     would be sent based on `instance.context.history`. If there's
 *     no active conversation yet (user hasn't chatted), we fall back
 *     to a hint.
 *
 * The prompt template lives on the AddonInstance and is the contract
 * with the server. The server reads the same string and substitutes
 * placeholders identically — so this view should match what the
 * runtime assembles (modulo live field values).
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import { getPlugin } from '../../registry/plugins';
import { buildPromptPreview, describeHistory } from './buildPromptPreview';
import { fetchConversationMessages, type ConversationMessage } from '../../state/builderApi';
import type { AddonInstance, HistoryMode, ID } from '../../types';
import styles from './PromptTemplateModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  instance: AddonInstance | null;
}

function sliceForHistory(msgs: ConversationMessage[], h: HistoryMode): ConversationMessage[] {
  if (h.mode === 'none') return [];
  if (h.mode === 'full') return msgs;
  const n = Math.max(0, h.n ?? 5);
  return msgs.slice(-n);
}

export function PromptTemplateModal({ open, onClose, agentId, instance }: Props) {
  const { doc, previewConversationId } = useBuilder();

  const agent = useMemo(
    () => doc.agents.find(x => x.id === agentId),
    [doc, agentId],
  );

  const preview = useMemo(() => {
    if (!instance) return '';
    return buildPromptPreview({
      instance,
      agentPersona: agent?.persona ?? '',
    });
  }, [instance, agent]);

  // Fetch the live conversation transcript so the history sidebar
  // shows what the LLM would actually receive. Refetch on each open
  // so the user sees the latest turn after closing/reopening.
  const [allMessages, setAllMessages] = useState<ConversationMessage[]>([]);
  const slug = agent?.slug ?? '';
  useEffect(() => {
    if (!open || !slug || previewConversationId === null) {
      setAllMessages([]);
      return;
    }
    let cancelled = false;
    fetchConversationMessages({ agentSlug: slug, conversationId: previewConversationId })
      .then(msgs => { if (!cancelled) setAllMessages(msgs); })
      .catch(() => { if (!cancelled) setAllMessages([]); });
    return () => { cancelled = true; };
  }, [open, slug, previewConversationId]);

  if (!instance) return null;
  const plugin = getPlugin(instance.pluginId);
  const historyLabel = describeHistory(instance);
  const personaOn = instance.context.persona;
  const personaText = agent?.persona?.trim() ?? '';

  const sliced = sliceForHistory(allMessages, instance.context.history);
  const noConversation = previewConversationId === null;
  const noMessages = !noConversation && sliced.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={920}
      title="Prompt preview"
      badge={plugin?.name ?? instance.pluginId}
    >
      <div className={styles.layout}>
        <div className={styles.promptCol}>
          <div className={styles.colHeader}>
            <span className={styles.colTitle}>Prompt</span>
          </div>
          <pre className={styles.pre}>{preview || '(template is empty)'}</pre>
          {!personaOn && personaText && (
            <p className={styles.note}>
              ⓘ Persona is OFF in Context — not injected.
            </p>
          )}
        </div>

        <aside className={styles.historyCol}>
          <div className={styles.colHeader}>
            <span className={styles.colTitle}>History</span>
            {sliced.length > 0 && (
              <span className={styles.historyCount}>{sliced.length} of {allMessages.length}</span>
            )}
          </div>
          <div className={styles.historyBadge}>{historyLabel}</div>

          {noConversation && (
            <div className={styles.historyPlaceholder}>
              <span className={styles.placeholderEmoji}>💬</span>
              <span className={styles.placeholderText}>
                Send a message in User Chat to see real history here
              </span>
            </div>
          )}

          {noMessages && (
            <div className={styles.historyPlaceholder}>
              <span className={styles.placeholderEmoji}>—</span>
              <span className={styles.placeholderText}>
                {instance.context.history.mode === 'none'
                  ? 'History disabled in Context'
                  : 'No messages yet'}
              </span>
            </div>
          )}

          {sliced.length > 0 && (
            <div className={styles.historyList}>
              {sliced.map(m => (
                <div
                  key={m.id}
                  className={`${styles.historyMsg} ${
                    m.role === 'user' ? styles.historyMsgUser : styles.historyMsgBot
                  }`}
                >
                  {m.content}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
}
