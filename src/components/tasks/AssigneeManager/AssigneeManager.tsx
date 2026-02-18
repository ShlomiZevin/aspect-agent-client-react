import { useState } from 'react';
import type { Assignee } from '../../../types/task';
import styles from './AssigneeManager.module.css';

interface AssigneeManagerProps {
  assignees: Assignee[];
  onAddAssignee: (name: string) => Promise<void>;
  selectedAssignee?: string | null;
  onAssigneeClick?: (assignee: string | null) => void;
}

export function AssigneeManager({ assignees, onAddAssignee, selectedAssignee, onAssigneeClick }: AssigneeManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;

    setIsLoading(true);
    try {
      await onAddAssignee(newName.trim());
      setNewName('');
      setIsAdding(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewName('');
    }
  };

  return (
    <div className={styles.container}>
      <span className={styles.label}>Assignees:</span>
      <div className={styles.list}>
        {onAssigneeClick && (
          <button
            className={`${styles.chip} ${styles.clickable} ${selectedAssignee === null ? styles.active : ''}`}
            onClick={() => onAssigneeClick(null)}
          >
            All
          </button>
        )}
        {assignees.map(a => (
          onAssigneeClick ? (
            <button
              key={a.id}
              className={`${styles.chip} ${styles.clickable} ${selectedAssignee === a.name ? styles.active : ''}`}
              onClick={() => onAssigneeClick(selectedAssignee === a.name ? null : a.name)}
            >
              {a.name}
            </button>
          ) : (
            <span key={a.id} className={styles.chip}>{a.name}</span>
          )
        ))}
        {isAdding ? (
          <div className={styles.inputWrapper}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Name..."
              autoFocus
              disabled={isLoading}
              className={styles.input}
            />
            <button
              onClick={handleAdd}
              disabled={isLoading || !newName.trim()}
              className={styles.addBtn}
            >
              {isLoading ? '...' : 'Add'}
            </button>
          </div>
        ) : (
          <button
            className={styles.plusBtn}
            onClick={() => setIsAdding(true)}
            title="Add assignee"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
