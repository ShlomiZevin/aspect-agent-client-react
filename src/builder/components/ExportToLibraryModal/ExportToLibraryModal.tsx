/**
 * ExportToLibraryModal — saves the current addon's config to the
 * Addon Repository so it can be reused in other crews / agents /
 * projects. Copy-only — no live link back.
 */

import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { exportToLibrary } from '../../state/addonLibrary';
import { getPlugin } from '../../registry/plugins';
import type { AddonInstance } from '../../types';
import styles from './ExportToLibraryModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  instance: AddonInstance | null;
  /** Called with the new entry's id after a successful export. */
  onExported?: (entryId: string) => void;
}

export function ExportToLibraryModal({ open, onClose, instance, onExported }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
  }, [open]);

  if (!instance) return null;
  const desc = getPlugin(instance.pluginId);

  const submit = () => {
    if (!name.trim()) return;
    const entry = exportToLibrary({
      name: name.trim(),
      description: description.trim() || undefined,
      instance,
    });
    onExported?.(entry.id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={500}
      title="Export to repository"
      badge={desc?.name ?? instance.pluginId}
      footer={
        <>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.save}
            onClick={submit}
            disabled={!name.trim()}
          >
            Export
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <p className={styles.intro}>
          Save this addon's current config to the shared repository. It will be
          available when adding a step in any crew or agent. The repository copy
          is independent — editing this addon later won't change it.
        </p>

        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`e.g. ${desc?.name === 'Talker' ? 'Warm conversational talker' : 'Banking onboarding extractor'}`}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && name.trim()) submit();
            }}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Description (optional)</span>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What this is good for, when to use it, any caveats."
          />
        </label>
      </div>
    </Modal>
  );
}
