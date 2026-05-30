/**
 * DomainModal — add or rename a declared domain.
 *
 * Declared domains live on `agent.domains: string[]`. They're a UX hint
 * for pickers (so the user can pre-shape their schema before any field
 * uses a domain). At runtime, a field's own `domain` still wins —
 * declared domains don't constrain extraction.
 *
 * Rename cascades: if the user renames "customer" → "client", every
 * field whose `domain === 'customer'` follows. No partial rename.
 */

import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useConfirm } from '../Confirm/Confirm';
import styles from './SchemaPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, modal is in "edit" mode (rename / delete this name). */
  initialName: string | null;
  /** All currently-declared domain names — used to flag duplicates. */
  existing: string[];
  /** How many fields currently reference this domain (for the delete hint). */
  usageCount: number;
  onSave: (newName: string) => void;
  onDelete?: () => void;
}

export function DomainModal({
  open, onClose, initialName, existing, usageCount, onSave, onDelete,
}: Props) {
  const editing = initialName !== null;
  const [name, setName] = useState(initialName ?? '');
  const confirm = useConfirm();

  useEffect(() => {
    if (open) setName(initialName ?? '');
  }, [open, initialName]);

  const trimmed = name.trim();
  const collides = trimmed !== ''
    && trimmed !== initialName
    && existing.includes(trimmed);
  const canSave = trimmed !== '' && !collides && trimmed !== initialName;

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = await confirm({
      title: `Delete domain "${initialName}"?`,
      message: usageCount > 0
        ? `${usageCount} field(s) currently use this domain. They'll keep their domain string, but it will no longer appear in pickers.`
        : 'Removes this domain declaration. Existing fields are unaffected.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) onDelete();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit domain "${initialName}"` : 'Add domain'}
      width={420}
      footer={
        <div className={styles.actions}>
          {editing && onDelete && (
            <button type="button" className={styles.btnDanger} onClick={handleDelete}>
              Delete
            </button>
          )}
          <span className={styles.spacerInline} />
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={!canSave}
            onClick={() => onSave(trimmed)}
          >
            {editing ? 'Save' : 'Add'}
          </button>
        </div>
      }
    >
      <div className={styles.form}>
        <div>
          <div className={styles.label}>Name</div>
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. customer, order, billing"
            autoFocus
            spellCheck={false}
          />
          {collides && (
            <div className={styles.hint} style={{ color: '#b91c1c' }}>
              A domain with this name already exists.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
