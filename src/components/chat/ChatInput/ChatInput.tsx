import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAgentConfig, useChatContext } from '../../../context';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  showKBToggle?: boolean;
}

export function ChatInput({ showKBToggle = false }: ChatInputProps) {
  const config = useAgentConfig();
  const { sendMessage, isLoading, useKnowledgeBase, setUseKnowledgeBase } = useChatContext();
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    sendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.inputWrapper}>
        <textarea
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={config.inputPlaceholder}
          disabled={isLoading}
          rows={1}
        />

        {showKBToggle && config.features.kbToggleable && (
          <label className={styles.kbToggle}>
            <input
              type="checkbox"
              checked={useKnowledgeBase}
              onChange={(e) => setUseKnowledgeBase(e.target.checked)}
            />
            <span className={styles.kbLabel}>Use KB</span>
          </label>
        )}

        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </form>
  );
}
