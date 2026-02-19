import { useState, useEffect } from 'react';
import type { DemoMessage, MessageSide } from '../../../types/demo';
import styles from './MessageEditor.module.css';

interface MessageEditorProps {
  message?: DemoMessage | null;
  defaultSenderName?: string;
  onSave: (message: DemoMessage) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getCurrentTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTimestamp(date: Date | null, time: string): string {
  if (!date) {
    return time || getCurrentTime();
  }
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${dateStr}, ${time || '10:00 AM'}`;
}

function parseTimestampToDate(timestamp: string): Date | null {
  // Try to parse dates like "Jan 15, 10:30 AM" or "Mon, 10:30 AM"
  const match = timestamp.match(/^([A-Za-z]{3,})\s*(\d{1,2})?,?\s*/);
  if (match && match[2]) {
    // Has day number like "Jan 15"
    const now = new Date();
    const dateStr = `${match[1]} ${match[2]}, ${now.getFullYear()}`;
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function parseTimestampToTime(timestamp: string): string {
  // Extract time part like "10:30 AM"
  const match = timestamp.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  return match ? match[1] : timestamp;
}

export function MessageEditor({
  message,
  defaultSenderName = 'User',
  onSave,
  onDelete,
  onCancel,
}: MessageEditorProps) {
  const isEditing = !!message;

  const [senderName, setSenderName] = useState(message?.senderName || defaultSenderName);
  const [text, setText] = useState(message?.text || '');
  const [side, setSide] = useState<MessageSide>(message?.side || 'right');
  const [includeDate, setIncludeDate] = useState(() => {
    // Check if existing timestamp includes a date
    return message?.timestamp ? !!parseTimestampToDate(message.timestamp) : false;
  });
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const parsed = message?.timestamp ? parseTimestampToDate(message.timestamp) : null;
    return parsed ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  });
  const [timeValue, setTimeValue] = useState(() => {
    return message?.timestamp ? parseTimestampToTime(message.timestamp) : getCurrentTime();
  });

  useEffect(() => {
    if (message) {
      setSenderName(message.senderName || defaultSenderName);
      setText(message.text);
      setSide(message.side);
      const parsedDate = parseTimestampToDate(message.timestamp);
      setIncludeDate(!!parsedDate);
      setSelectedDate(parsedDate ? parsedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setTimeValue(parseTimestampToTime(message.timestamp));
    } else {
      setSenderName(defaultSenderName);
      setText('');
      setSide('right');
      setIncludeDate(false);
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setTimeValue(getCurrentTime());
    }
  }, [message, defaultSenderName]);

  const getTimestamp = (): string => {
    if (includeDate) {
      const date = new Date(selectedDate);
      return formatTimestamp(date, timeValue);
    }
    return timeValue;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    onSave({
      id: message?.id || generateId(),
      senderName: senderName.trim() || defaultSenderName,
      text: text.trim(),
      side,
      timestamp: getTimestamp(),
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>
          {isEditing ? 'Edit Message' : 'Add Message'}
        </span>
        <button
          className={styles.closeButton}
          onClick={onCancel}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>Sender Name</label>
          <input
            type="text"
            className={styles.input}
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Enter sender name"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Message</label>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter message text"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Side</label>
          <div className={styles.sideToggle}>
            <button
              type="button"
              className={`${styles.sideButton} ${styles.userButton} ${
                side === 'right' ? styles.sideButtonActive : ''
              }`}
              onClick={() => setSide('right')}
            >
              User
            </button>
            <button
              type="button"
              className={`${styles.sideButton} ${styles.agentButton} ${
                side === 'left' ? styles.sideButtonActive : ''
              }`}
              onClick={() => setSide('left')}
            >
              Agent
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <input
              type="checkbox"
              checked={includeDate}
              onChange={(e) => setIncludeDate(e.target.checked)}
              className={styles.checkbox}
            />
            Include date
          </label>
          <div className={styles.dateTimeRow}>
            {includeDate && (
              <input
                type="date"
                className={styles.dateInput}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            )}
            <input
              type="text"
              className={styles.timeInput}
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              placeholder="e.g., 10:30 AM"
            />
          </div>
        </div>

        <div className={styles.actions}>
          {isEditing && onDelete && (
            <button
              type="button"
              className={`${styles.button} ${styles.dangerButton}`}
              onClick={onDelete}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${styles.button} ${styles.primaryButton}`}
            disabled={!text.trim()}
          >
            {isEditing ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface QuickAddProps {
  onAdd: (message: DemoMessage) => void;
}

export function QuickAddMessage({
  onAdd,
}: QuickAddProps) {
  const [text, setText] = useState('');
  const [side, setSide] = useState<MessageSide>('right');

  const handleAdd = () => {
    if (!text.trim()) return;

    onAdd({
      id: generateId(),
      senderName: '', // Empty = use global config until edited
      text: text.trim(),
      side,
      timestamp: getCurrentTime(),
    });

    setText('');
    // Alternate side for next message
    setSide(side === 'right' ? 'left' : 'right');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={styles.quickAdd}>
      <div className={styles.field}>
        <input
          type="text"
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add ${side === 'right' ? 'user' : 'agent'} message...`}
        />
      </div>
      <button
        type="button"
        className={styles.addButton}
        onClick={handleAdd}
        disabled={!text.trim()}
      >
        Add {side === 'right' ? 'User' : 'Agent'}
      </button>
    </div>
  );
}
