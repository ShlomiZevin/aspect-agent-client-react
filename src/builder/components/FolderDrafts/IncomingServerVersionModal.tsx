/**
 * IncomingServerVersionModal — "this agent was saved somewhere else" (#952).
 *
 * The folder's sibling: an AI assistant can also save straight to the
 * server over the MCP, and then there is no file for IncomingDraftModal to
 * notice. That save is already a real version, so the choice here is only
 * whether this screen shows it — and, with unsaved work on screen, the
 * warning that saving from here would put the old content back on top.
 */

import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import styles from './IncomingDraftModal.module.css';

export function IncomingServerVersionModal() {
  const { incomingServerVersion: incoming, acceptServerVersion, dismissServerVersion } = useBuilder();
  const label = incoming?.number != null ? `v${incoming.number}` : 'the new version';

  return (
    <Modal
      open={!!incoming}
      onClose={dismissServerVersion}
      title="Saved outside this screen"
      width={520}
      // Same as the folder dialog: both buttons are answers, nothing else closes it.
      dismissible={false}
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.ghost} onClick={dismissServerVersion}>
            {incoming?.dirty ? 'Keep mine' : 'Not now'}
          </button>
          <button type="button" className={styles.primary} onClick={() => void acceptServerVersion()}>
            Load {label}
          </button>
        </div>
      }
    >
      <p className={styles.p}>
        A new version of this agent was saved, usually by your AI assistant. It is already saved.
      </p>

      {incoming?.description && <p className={styles.summary}>{label} · {incoming.description}</p>}

      {incoming?.dirty ? (
        <p className={styles.detail}>
          Loading replaces your unsaved changes here. If you keep yours, your next save
          becomes the newest version, without that change.
        </p>
      ) : (
        <p className={styles.detail}>
          Until you load it, this screen shows the version before it.
        </p>
      )}
    </Modal>
  );
}
