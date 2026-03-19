import { useState, useEffect } from 'react';
import { Modal, Button } from '../../common';
import { getFiles, attachToKB } from '../../../services/dynamicKBService';
import type { DynamicFile, KBFile } from '../../../types';
import styles from './AttachDynamicFileModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  kbId: number;
  agentName: string;
  baseURL?: string;
  existingFiles: KBFile[];
  onAttached: () => void;
}

export function AttachDynamicFileModal({
  isOpen,
  onClose,
  kbId,
  agentName,
  baseURL,
  existingFiles,
  onAttached,
}: Props) {
  const [dynamicFiles, setDynamicFiles] = useState<DynamicFile[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already-attached dynamic file IDs (detected by originalFileUrl pattern)
  const attachedPaths = new Set(
    existingFiles
      .map(f => f.originalFileUrl)
      .filter(Boolean) as string[]
  );

  const isAlreadyAttached = (file: DynamicFile): boolean => {
    // Dynamic files are stored at dynamic-files/{agentId}/{fileId}.md
    const path = `dynamic-files/${file.agentId}/${file.id}.md`;
    return attachedPaths.has(path);
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setError(null);
    setIsLoading(true);
    getFiles(agentName, baseURL)
      .then(setDynamicFiles)
      .catch(err => setError((err as Error).message))
      .finally(() => setIsLoading(false));
  }, [isOpen, agentName, baseURL]);

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAttach = async () => {
    if (selected.size === 0) return;
    setIsAttaching(true);
    setError(null);
    const ids = Array.from(selected);
    const errors: string[] = [];
    for (const fileId of ids) {
      try {
        await attachToKB(fileId, kbId, baseURL);
      } catch (err) {
        errors.push((err as Error).message);
      }
    }
    setIsAttaching(false);
    if (errors.length > 0) {
      setError(`Some files failed to attach: ${errors.join('; ')}`);
    } else {
      onAttached();
      onClose();
    }
  };

  const available = dynamicFiles.filter(f => !isAlreadyAttached(f));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Attach Dynamic File" size="sm">
      <div className={styles.body}>
        {error && <div className={styles.error}>{error}</div>}

        {isLoading ? (
          <p className={styles.loading}>Loading dynamic files...</p>
        ) : available.length === 0 ? (
          <p className={styles.empty}>
            {dynamicFiles.length === 0
              ? 'No dynamic files found. Create files in the Dynamic KB section first.'
              : 'All dynamic files are already attached to this knowledge base.'}
          </p>
        ) : (
          <ul className={styles.list}>
            {available.map(file => (
              <li
                key={file.id}
                className={`${styles.item} ${selected.has(file.id) ? styles.itemSelected : ''}`}
                onClick={() => toggle(file.id)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(file.id)}
                  onChange={() => toggle(file.id)}
                  className={styles.checkbox}
                />
                <span className={styles.typeIcon}>{file.fileType === 'table' ? '⊞' : '≡'}</span>
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileMeta}>
                    {file.fileType} • {file.fileSize > 0 ? `${Math.round(file.fileSize / 1024)} KB` : 'empty'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose} disabled={isAttaching}>Cancel</Button>
          <Button
            onClick={handleAttach}
            disabled={selected.size === 0 || isAttaching}
            isLoading={isAttaching}
          >
            Attach {selected.size > 0 && `(${selected.size})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
