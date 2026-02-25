import { Modal } from '../../common';
import { Button } from '../../common';
import type { KnowledgeBase, KBProvider } from '../../../types';
import styles from './SyncKBModal.module.css';

const PROVIDER_LABELS: Record<KBProvider, string> = {
  openai: 'OpenAI',
  google: 'Google Gemini',
  both: 'Both',
};

interface SyncKBModalProps {
  isOpen: boolean;
  sourceKB: KnowledgeBase;
  targetProvider: KBProvider;
  isSyncing: boolean;
  onSync: (targetProvider: KBProvider) => Promise<void>;
  onClose: () => void;
}

export function SyncKBModal({
  isOpen,
  sourceKB,
  targetProvider,
  isSyncing,
  onSync,
  onClose,
}: SyncKBModalProps) {
  const sourceLabel = PROVIDER_LABELS[sourceKB.provider];
  const targetLabel = PROVIDER_LABELS[targetProvider];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sync Knowledge Base"
      size="sm"
    >
      <div className={styles.content}>
        <div className={styles.description}>
          <p>
            This will copy all files from <strong>{sourceKB.name}</strong> to{' '}
            <strong>{targetLabel}</strong>.
          </p>
          <p className={styles.note}>
            Files are re-uploaded from your GCS backup. The KB will be published on both providers after sync.
          </p>
        </div>

        <div className={styles.arrow}>
          <div className={styles.providerBox} data-provider={sourceKB.provider}>
            {sourceLabel}
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
          <div className={styles.providerBox} data-provider={targetProvider}>
            {targetLabel}
          </div>
        </div>

        <div className={styles.stats}>
          <span>{sourceKB.fileCount} file{sourceKB.fileCount !== 1 ? 's' : ''} to sync</span>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose} disabled={isSyncing}>
            Cancel
          </Button>
          <Button
            onClick={() => onSync(targetProvider)}
            disabled={isSyncing}
            isLoading={isSyncing}
          >
            Sync to {targetLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
