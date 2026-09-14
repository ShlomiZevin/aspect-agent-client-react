import { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ReleaseSections.module.css';

interface WhatChangedSectionProps {
  editable: boolean;
  headline: string;
  text: string;
  onHeadlineChange: (value: string) => void;
  onTextChange: (value: string) => void;
}

/**
 * "What changed" — shown while a task is Done. The assignee writes it; everyone else reads it.
 */
export function WhatChangedSection({ editable, headline, text, onHeadlineChange, onTextChange }: WhatChangedSectionProps) {
  return (
    <div className={styles.whatChanged}>
      <div className={styles.whatChangedLabel} title={editable ? undefined : 'Filled by the assignee'}>
        ✅ What changed
      </div>
      {editable ? (
        <>
          <input
            type="text"
            className={styles.headlineInput}
            dir="auto"
            value={headline}
            maxLength={255}
            placeholder="One line for What's New"
            onChange={(e) => onHeadlineChange(e.target.value)}
          />
          <textarea
            className={styles.textInput}
            dir="auto"
            rows={3}
            value={text}
            placeholder={'מה השתנה: …\nמה לבדוק: …'}
            onChange={(e) => onTextChange(e.target.value)}
          />
        </>
      ) : headline || text ? (
        <>
          {headline && <div className={styles.headline} dir="auto">{headline}</div>}
          {text && <div className={styles.text} dir="auto">{text}</div>}
        </>
      ) : (
        <div className={styles.empty}>Not filled yet</div>
      )}
    </div>
  );
}

interface DeliveredBarProps {
  deployedAt: string;
  onWorks: () => Promise<void>;
  onNotYet: (reason: string) => Promise<void>;
}

/**
 * Shown on a released task that nobody has closed yet: "Works" closes it,
 * "Not yet" sends it back with a one-line reason.
 */
export function DeliveredBar({ deployedAt, onWorks, onNotYet }: DeliveredBarProps) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const releasedOn = new Date(deployedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const handleWorks = async () => {
    setBusy(true);
    try {
      await onWorks();
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await onNotYet(reason.trim());
      setShowReason(false);
      setReason('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.delivered}>
      <span className={styles.deliveredText}>🚀 Released {releasedOn}. Does it work?</span>
      <div className={styles.deliveredActions}>
        <button type="button" className={styles.worksBtn} onClick={handleWorks} disabled={busy}>
          ✓ Works
        </button>
        <button type="button" className={styles.notYetBtn} onClick={() => setShowReason(true)} disabled={busy}>
          ✗ Not yet
        </button>
      </div>

      {showReason && createPortal(
        <div className={styles.reasonOverlay} onClick={() => { if (!busy) setShowReason(false); }}>
          <div className={styles.reasonModal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h4 className={styles.reasonTitle}>What's still not working?</h4>
            <textarea
              className={styles.reasonInput}
              dir="auto"
              rows={4}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className={styles.reasonActions}>
              <button type="button" className={styles.reasonCancel} onClick={() => setShowReason(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className={styles.reasonSend} onClick={handleSend} disabled={busy || !reason.trim()}>
                {busy ? 'Sending…' : 'Send back'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
