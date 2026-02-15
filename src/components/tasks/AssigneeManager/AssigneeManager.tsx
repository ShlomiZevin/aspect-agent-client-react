import { useState } from 'react';
import type { Assignee } from '../../../types/task';
import styles from './AssigneeManager.module.css';

interface AssigneeManagerProps {
  assignees: Assignee[];
  onAddAssignee: (name: string) => Promise<void>;
}

export function AssigneeManager({ assignees, onAddAssignee }: AssigneeManagerProps) {
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
        {assignees.map(a => (
          <span key={a.id} className={styles.chip}>{a.name}</span>
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
