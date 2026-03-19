import { TaskBoardContent } from './TaskBoardContent';
import styles from './TaskBoardModal.module.css';

interface TaskBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  openInDraftsMode?: boolean;
  onDraftsModeAcknowledged?: () => void;
}

export function TaskBoardModal({ isOpen, onClose, openInDraftsMode, onDraftsModeAcknowledged }: TaskBoardModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} dir="ltr">
        <TaskBoardContent
          isActive={isOpen}
          onClose={onClose}
          openInDraftsMode={openInDraftsMode}
          onDraftsModeAcknowledged={onDraftsModeAcknowledged}
        />
      </div>
    </div>
  );
}
