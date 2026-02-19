import { useState } from 'react';
import type { DemoMessage } from '../../../types/demo';
import styles from './SpreadDatesModal.module.css';

interface SpreadDatesModalProps {
  messages: DemoMessage[];
  onApply: (messages: DemoMessage[]) => void;
  onClose: () => void;
}

type SpreadMode = 'even' | 'interval';

export function SpreadDatesModal({ messages, onApply, onClose }: SpreadDatesModalProps) {
  const [mode, setMode] = useState<SpreadMode>('even');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [endTime, setEndTime] = useState('18:00');
  const [intervalMinutes, setIntervalMinutes] = useState(5);

  const formatTime12h = (hours: number, minutes: number): string => {
    const period = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = minutes.toString().padStart(2, '0');
    return `${h}:${m} ${period}`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleApply = () => {
    if (messages.length === 0) {
      onClose();
      return;
    }

    const start = new Date(`${startDate}T${startTime}`);
    let updatedMessages: DemoMessage[];

    if (mode === 'even') {
      const end = new Date(`${endDate}T${endTime}`);
      const totalMs = end.getTime() - start.getTime();
      const intervalMs = messages.length > 1 ? totalMs / (messages.length - 1) : 0;

      updatedMessages = messages.map((msg, index) => {
        const msgDate = new Date(start.getTime() + intervalMs * index);
        const timestamp = createTimestamp(msgDate, start);
        return { ...msg, timestamp };
      });
    } else {
      // Interval mode
      updatedMessages = messages.map((msg, index) => {
        const msgDate = new Date(start.getTime() + intervalMinutes * 60 * 1000 * index);
        const timestamp = createTimestamp(msgDate, start);
        return { ...msg, timestamp };
      });
    }

    onApply(updatedMessages);
    onClose();
  };

  const createTimestamp = (date: Date, startDate: Date): string => {
    const timeStr = formatTime12h(date.getHours(), date.getMinutes());

    // Check if date differs from start date (multi-day conversation)
    const isSameDay = date.toDateString() === startDate.toDateString();
    if (isSameDay && mode === 'interval') {
      return timeStr;
    }

    return `${formatDate(date)}, ${timeStr}`;
  };

  const previewMessages = () => {
    if (messages.length === 0) return [];

    const start = new Date(`${startDate}T${startTime}`);
    const previewCount = Math.min(3, messages.length);

    if (mode === 'even') {
      const end = new Date(`${endDate}T${endTime}`);
      const totalMs = end.getTime() - start.getTime();
      const intervalMs = messages.length > 1 ? totalMs / (messages.length - 1) : 0;

      return messages.slice(0, previewCount).map((_, index) => {
        const msgDate = new Date(start.getTime() + intervalMs * index);
        return createTimestamp(msgDate, start);
      });
    } else {
      return messages.slice(0, previewCount).map((_, index) => {
        const msgDate = new Date(start.getTime() + intervalMinutes * 60 * 1000 * index);
        return createTimestamp(msgDate, start);
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={handleKeyDown}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Spread Dates</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            Distribute timestamps across {messages.length} message{messages.length !== 1 ? 's' : ''}.
          </p>

          {/* Mode selection */}
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={`${styles.modeButton} ${mode === 'even' ? styles.modeButtonActive : ''}`}
              onClick={() => setMode('even')}
            >
              Spread Evenly
            </button>
            <button
              type="button"
              className={`${styles.modeButton} ${mode === 'interval' ? styles.modeButtonActive : ''}`}
              onClick={() => setMode('interval')}
            >
              Fixed Interval
            </button>
          </div>

          {/* Start date/time */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Start</label>
            <div className={styles.dateTimeRow}>
              <input
                type="date"
                className={styles.input}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                type="time"
                className={styles.input}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          {/* End date/time or interval */}
          {mode === 'even' ? (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>End</label>
              <div className={styles.dateTimeRow}>
                <input
                  type="date"
                  className={styles.input}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <input
                  type="time"
                  className={styles.input}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Minutes between messages</label>
              <input
                type="number"
                className={styles.input}
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={1440}
              />
            </div>
          )}

          {/* Preview */}
          <div className={styles.preview}>
            <div className={styles.previewTitle}>Preview</div>
            <div className={styles.previewList}>
              {previewMessages().map((ts, i) => (
                <div key={i} className={styles.previewItem}>
                  <span className={styles.previewIndex}>Message {i + 1}:</span>
                  <span className={styles.previewTime}>{ts}</span>
                </div>
              ))}
              {messages.length > 3 && (
                <div className={styles.previewMore}>...and {messages.length - 3} more</div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={handleApply}
            disabled={messages.length === 0}
          >
            Apply to All Messages
          </button>
        </div>
      </div>
    </div>
  );
}
