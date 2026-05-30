/**
 * ParameterModal — add / edit / delete an agent parameter.
 *
 * Parameters are static, agent-scoped values referenced from prompts
 * via the `#` mention prefix (`#bankName`). Plain strings today; if
 * typed parameters become necessary the shape can extend without
 * disrupting the picker.
 */

import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useConfirm } from '../Confirm/Confirm';
import type { ParameterDef } from '../../types';
import styles from './SchemaPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Existing param being edited, or null when adding. */
  initial: ParameterDef | null;
  /** Other parameters in the agent (for duplicate-name detection). */
  siblings: ParameterDef[];
  onSave: (next: ParameterDef) => void;
  onDelete?: () => void;
}

function isValidName(s: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s);
}

export function ParameterModal({
  open, onClose, initial, siblings, onSave, onDelete,
}: Props) {
  const editing = initial !== null;
  const [name,        setName]        = useState('');
  const [value,       setValue]       = useState('');
  const [description, setDescription] = useState('');
  const confirm = useConfirm();

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setValue(initial?.value ?? '');
    setDescription(initial?.description ?? '');
  }, [open, initial]);

  const trimmedName = name.trim();
  const validName = trimmedName === '' || isValidName(trimmedName);
  const collides = trimmedName !== ''
    && siblings.some(p => p.id !== initial?.id && p.name === trimmedName);
  const canSave = trimmedName !== '' && validName && !collides;

  const handleSave = () => {
    onSave({
      id:          initial?.id ?? `param_${Date.now().toString(36)}`,
      name:        trimmedName,
      value:       value,
      description: description.trim() || undefined,
    });
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = await confirm({
      title: `Delete parameter "${initial?.name}"?`,
      message: 'Any prompt that references this parameter will leave the unresolved token in place.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) onDelete();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit parameter` : 'Add parameter'}
      width={520}
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
            onClick={handleSave}
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
            placeholder="e.g. bankName, supportPhone"
            autoFocus
            spellCheck={false}
          />
          {trimmedName && !validName && (
            <div className={styles.hint} style={{ color: '#b91c1c' }}>
              Use a letter to start, then letters / digits / underscores.
            </div>
          )}
          {collides && (
            <div className={styles.hint} style={{ color: '#b91c1c' }}>
              A parameter with this name already exists.
            </div>
          )}
          {trimmedName && validName && !collides && (
            <div className={styles.hint}>
              Reference in prompts as <code>#{trimmedName}</code>
            </div>
          )}
        </div>

        <div>
          <div className={styles.label}>Value</div>
          <textarea
            className={styles.textarea}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="The value substituted into prompts"
            spellCheck={false}
          />
        </div>

        <div>
          <div className={styles.label}>Description (optional)</div>
          <input
            className={styles.input}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="One-line note shown in the picker"
          />
        </div>
      </div>
    </Modal>
  );
}
