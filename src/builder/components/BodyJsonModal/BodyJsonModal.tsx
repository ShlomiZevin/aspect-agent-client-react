/**
 * BodyJsonModal — read-only JSON viewer for an AgentBody / CrewBody.
 *
 * Opened by the `{}` button next to 📖 Spec in AgentView / CrewView.
 * Shows the body of the currently viewing version, pretty-printed.
 * Copy-to-clipboard for the whole thing. Editor mode is a future toggle.
 */

import { useState, useEffect } from 'react';
import { Modal } from '../Modal/Modal';
import styles from './BodyJsonModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 'agent' or 'crew' — drives the modal title only. */
  level: 'agent' | 'crew';
  /** Display name of the agent/crew this body belongs to. */
  ownerName: string;
  /** The AgentBody or CrewBody — rendered as pretty-printed JSON. */
  body: unknown;
}

const LEVEL_LABEL: Record<Props['level'], string> = {
  agent: 'AgentBody',
  crew:  'CrewBody',
};

export function BodyJsonModal({ open, onClose, level, ownerName, body }: Props) {
  const [copied, setCopied] = useState(false);

  // Reset the copied-state every time the modal opens so reopening it
  // doesn't show a stale "Copied!" badge.
  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  const json = JSON.stringify(body ?? {}, null, 2);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard rejected — leave the state alone so the button
      // doesn't lie about success.
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`JSON — ${ownerName || `(${level})`}`}
      badge={LEVEL_LABEL[level]}
      width={760}
    >
      <div className={styles.toolbar}>
        <span className={styles.hint}>
          Read-only snapshot of the version you're viewing.
        </span>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${copied ? styles.actionBtnSuccess : ''}`}
            onClick={onCopy}
            title="Copy JSON to clipboard"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className={styles.pre}>{json}</pre>
    </Modal>
  );
}
