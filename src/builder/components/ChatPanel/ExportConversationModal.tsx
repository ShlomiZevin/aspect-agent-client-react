/**
 * ExportConversationModal — download / copy one Builder Chat conversation
 * as JSON, to hand to another AI for analysis (task #861).
 *
 * The JSON is built server-side (builder/services/conversationExport.js),
 * the same function the MCP door serves — so a file handed over here and
 * a conversation an assistant fetches itself are identical. This modal
 * only picks the level and delivers the result.
 *
 * Fetched on each click rather than once on open: a conversation can
 * still be running offline addons when the modal opens, and a stale
 * export is exactly the "the AI saw something else" confusion this is
 * meant to remove.
 */

import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { exportConversation, type ConversationExportLevel } from '../../state/builderApi';
import styles from './ExportConversationModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentSlug: string;
  conversationId: number | null;
}

const OPTIONS: Array<{ id: ConversationExportLevel; label: string; hint: string; recommended?: boolean }> = [
  { id: 'messages', label: 'Messages only', hint: 'The conversation text' },
  { id: 'outputs', label: 'Messages + addon outputs', hint: 'What each addon returned and wrote, per turn', recommended: true },
  { id: 'full', label: 'Everything incl. addon prompts', hint: 'Adds each addon’s full prompt — large' },
];

type Busy = null | 'download' | 'copy';

export function ExportConversationModal({ open, onClose, agentSlug, conversationId }: Props) {
  const [level, setLevel] = useState<ConversationExportLevel>('outputs');
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Each open starts clean — a "Copied" from the last conversation
  // would read as a claim about this one.
  useEffect(() => {
    if (open) { setStatus(null); setBusy(null); }
  }, [open, conversationId]);

  const run = async (kind: Exclude<Busy, null>) => {
    if (conversationId === null || busy) return;
    setBusy(kind);
    setStatus(null);
    try {
      const data = await exportConversation({ agentSlug, conversationId, include: level });
      const json = JSON.stringify(data, null, 2);
      if (kind === 'copy') {
        await navigator.clipboard.writeText(json);
        setStatus({ kind: 'ok', text: 'Copied to clipboard' });
      } else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${agentSlug}-conversation-${conversationId}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus({ kind: 'ok', text: 'Downloaded' });
      }
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export conversation"
      badge={conversationId !== null ? `#${conversationId}` : undefined}
      width={440}
      footer={
        <div className={styles.footer}>
          {/* Always rendered so a status appearing never moves the buttons. */}
          <span
            className={`${styles.status} ${status?.kind === 'error' ? styles.statusError : ''}`}
            title={status?.text}
            role="status"
          >
            {status?.text ?? ''}
          </span>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => run('copy')}
            disabled={busy !== null || conversationId === null}
          >
            {busy === 'copy' ? 'Copying…' : 'Copy'}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => run('download')}
            disabled={busy !== null || conversationId === null}
            autoFocus
          >
            {busy === 'download' ? 'Preparing…' : 'Download JSON'}
          </button>
        </div>
      }
    >
      <div className={styles.options} role="radiogroup" aria-label="What to include">
        {OPTIONS.map(o => (
          <label
            key={o.id}
            className={`${styles.option} ${level === o.id ? styles.optionOn : ''}`}
          >
            <input
              type="radio"
              name="conversation-export-level"
              value={o.id}
              checked={level === o.id}
              onChange={() => setLevel(o.id)}
              className={styles.radio}
            />
            <span className={styles.text}>
              <span className={styles.label}>
                {o.label}
                {o.recommended && <span className={styles.pill}>Recommended</span>}
              </span>
              <span className={styles.hint}>{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
