/**
 * BuilderChat — UI shell for talking to the AI helper that builds the
 * agent with you. Helper model is fixed (Claude Sonnet 4.6) via
 * BUILDER_HELPER_MODEL.
 *
 * This slice: UI only. The "Show context" button opens a modal that
 * dumps exactly what the helper would receive — kept as a dev
 * affordance while the JSON shape is still moving.
 */

import { useState } from 'react';
import { BUILDER_HELPER_MODEL, formatModelRef } from '../../registry/providerModels';
import { useModels } from '../../registry/useModels';
import { ContextModal } from '../ContextModal/ContextModal';
import styles from './ChatPanel.module.css';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

export function BuilderChat() {
  // Subscribe to the model registry so the helper badge re-renders
  // with the proper "Anthropic · Claude Sonnet 4.6" label once the
  // server registry has loaded.
  useModels();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [contextOpen, setContextOpen] = useState(false);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages(m => [
      ...m,
      { role: 'user', text },
      {
        role: 'assistant',
        text:
          '(LLM wiring lands in the next slice — but the helper will see the current ' +
          'project/agent/crew JSON plus all specs.)',
      },
    ]);
    setInput('');
  };

  return (
    <div className={styles.chat}>
      <div className={styles.chatHeader}>
        <div className={styles.helperBadge}>{formatModelRef(BUILDER_HELPER_MODEL)}</div>
        <button
          type="button"
          className={styles.contextBtn}
          onClick={() => setContextOpen(true)}
        >
          Show context
        </button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.intro}>
            <p>
              I have your spec, persona, and current setup loaded. What do you
              want to adjust? I can propose JSON edits and apply them with one
              click — keeping the spec in sync as we go.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgBot}`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Describe the agent, or ask the helper to change something…"
          rows={2}
        />
        <button type="button" className={styles.sendBtn} onClick={send}>
          Send
        </button>
      </div>

      <ContextModal open={contextOpen} onClose={() => setContextOpen(false)} />
    </div>
  );
}
