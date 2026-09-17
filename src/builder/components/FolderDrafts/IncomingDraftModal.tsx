/**
 * IncomingDraftModal — "your assistant changed this agent".
 *
 * The two directions of the folder are deliberately not symmetrical:
 *
 *   you edit  → folder   automatic and silent; it cannot surprise anyone
 *   AI edits  → you      always asked, because it replaces what you are
 *                        looking at
 *
 * So this is the one interruption in the whole feature, and it only
 * appears when an assistant has actually written something. It is mounted
 * from the toolbar rather than inside the folder dialog because the
 * assistant can finish at any moment, on any screen — waiting for someone
 * to happen to open a dialog would make the change invisible exactly when
 * it matters.
 *
 * Declining is safe: the file is left as the assistant wrote it, and the
 * next edit made here overwrites it. The Builder is where the person is.
 */

import { useMemo } from 'react';
import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import styles from './IncomingDraftModal.module.css';

/** A short, honest summary of what arrived — enough to decide with. */
function describe(incoming: { name: string; crews: number } | null): string {
  if (!incoming) return '';
  return `${incoming.name} · ${incoming.crews} ${incoming.crews === 1 ? 'crew' : 'crews'}`;
}

export function IncomingDraftModal() {
  const { incomingFolderDraft, acceptIncomingDraft, dismissIncomingDraft } = useBuilder();

  const summary = useMemo(() => {
    const a = incomingFolderDraft?.doc.agents[0];
    return a ? { name: a.name || a.slug, crews: a.crews.length } : null;
  }, [incomingFolderDraft]);

  return (
    <Modal
      open={!!incomingFolderDraft}
      onClose={dismissIncomingDraft}
      title="Your assistant changed this agent"
      width={520}
      // No Esc, no click-outside, no ×. This dialog exists to get an
      // answer, and dismissing it by accident loses the only notice that
      // the agent was rewritten — which is exactly what happened in
      // testing. Both footer buttons are real answers, so nothing is
      // trapped: "Keep mine" is the cancel.
      dismissible={false}
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.ghost} onClick={dismissIncomingDraft}>
            Keep mine
          </button>
          <button type="button" className={styles.primary} onClick={acceptIncomingDraft}>
            Load their version
          </button>
        </div>
      }
    >
      <p className={styles.p}>
        The AI assistant working in your folder has written a new version of this
        agent.
      </p>

      {summary && <p className={styles.summary}>{describe(summary)}</p>}

      <p className={styles.detail}>
        Loading it replaces what is on your screen — it does not save anything
        to the server, and Revert still undoes it afterwards.
      </p>

      <p className={styles.detail}>
        If you keep yours, the file stays as your assistant left it and your next
        change here writes over it.
      </p>
    </Modal>
  );
}
