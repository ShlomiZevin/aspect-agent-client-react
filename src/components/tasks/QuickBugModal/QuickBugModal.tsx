import { useState, useEffect } from 'react';
import type { CreateTaskData, TaskPriority, TaskType } from '../../../types/task';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import { getDraftDefault, getUserId } from '../../../utils/userIdentifier';
import styles from './QuickBugModal.module.css';

interface QuickBugModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskData) => Promise<void>;
  currentDomain: string;
  conversationUrl?: string;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'task', label: 'Task' },
  { value: 'feature', label: 'Feature' },
  { value: 'idea', label: 'Idea' },
];

export function QuickBugModal({ isOpen, onClose, onSubmit, currentDomain, conversationUrl }: QuickBugModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('bug');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [isDraft, setIsDraft] = useState(getDraftDefault());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setType('bug');
      setPriority('medium');
      setIsDraft(getDraftDefault());
      // Set default description with conversation link if available
      if (conversationUrl) {
        setDescription(`<p><br></p><p>---</p><p>Conversation: <a href="${conversationUrl}" target="_blank">${conversationUrl}</a></p>`);
      } else {
        setDescription('');
      }
    }
  }, [isOpen, conversationUrl]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        domain: currentDomain,
        status: 'todo',
        tags: [],
        isDraft,
        createdBy: getUserId(),
        opener: getUserId(),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} dir="ltr" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className={styles.header}>
            <h3>Quick Add Bug/Task</h3>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              ×
            </button>
          </div>

          <div className={styles.body}>
            <div className={styles.field}>
              <label htmlFor="qb-title">Title *</label>
              <input
                id="qb-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's the issue?"
                autoFocus
                required
              />
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="qb-type">Type</label>
                <select id="qb-type" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
                  {TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="qb-priority">Priority</label>
                <select id="qb-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                  {PRIORITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>Domain</label>
                <input type="text" value={currentDomain} disabled className={styles.disabledInput} />
              </div>
            </div>

            <div className={styles.field}>
              <label>Description</label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe the issue..."
              />
            </div>
          </div>

          <div className={styles.footer}>
            <label className={styles.draftToggle}>
              <input
                type="checkbox"
                checked={isDraft}
                onChange={(e) => setIsDraft(e.target.checked)}
              />
              <span className={styles.draftLabel}>
                Save as Draft
                <span className={styles.draftHint}>(only you can see it)</span>
              </span>
            </label>
            <div className={styles.footerButtons}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting || !title.trim()}>
                {isSubmitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
