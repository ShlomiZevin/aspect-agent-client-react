import type { AttachmentKind } from '../../../services/chatAttachmentsService';
import styles from './AttachmentChips.module.css';

export interface ChipItem {
  key: string;
  filename: string;
  kind?: AttachmentKind;
  /** Pending upload states; a sent message's chips have none. */
  status?: 'uploading' | 'ready' | 'error';
  detail?: string;
}

const KIND_ICON: Record<AttachmentKind, string> = {
  spreadsheet: '▦',
  pdf: '▤',
  document: '▤',
  text: '≡',
  image: '◩',
};

/**
 * File chips — the composer's pending files (with remove + upload state) and,
 * read-only, the files a sent message carried.
 */
export function AttachmentChips({ items, onRemove, removeLabel, variant = 'composer' }: {
  items: ChipItem[];
  onRemove?: (key: string) => void;
  removeLabel?: string;
  variant?: 'composer' | 'message';
}) {
  if (items.length === 0) return null;
  return (
    <div className={`${styles.chips} ${variant === 'message' ? styles.chipsMessage : ''}`}>
      {items.map(item => (
        <span
          key={item.key}
          className={`${styles.chip} ${item.status === 'error' ? styles.chipError : ''}`}
          title={item.detail || item.filename}
        >
          {item.status === 'uploading'
            ? <span className={styles.spinner} aria-hidden="true" />
            : <span className={styles.icon} aria-hidden="true">{item.kind ? KIND_ICON[item.kind] : '▤'}</span>}
          <span className={styles.name}>{item.filename}</span>
          {item.detail && item.status !== 'uploading' && <span className={styles.detail}>{item.detail}</span>}
          {onRemove && (
            <button type="button" className={styles.remove} onClick={() => onRemove(item.key)} aria-label={removeLabel} title={removeLabel}>
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
