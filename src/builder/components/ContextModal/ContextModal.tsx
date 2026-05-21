/**
 * ContextModal — shows the full ProjectDoc JSON the helper would
 * receive. Dev/debug affordance while the JSON shape is still
 * evolving. Read-only.
 */

import { useMemo } from 'react';
import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import styles from './ContextModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ContextModal({ open, onClose }: Props) {
  const { doc } = useBuilder();
  const json = useMemo(() => JSON.stringify(doc, null, 2), [doc]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={780}
      title="Helper context"
      badge="JSON"
    >
      <p className={styles.hint}>
        This is exactly what the AI helper sees: the full project, agent,
        crews, and addons. Read-only.
      </p>
      <pre className={styles.pre}>{json}</pre>
    </Modal>
  );
}
