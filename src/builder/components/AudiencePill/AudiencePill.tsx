/**
 * AudiencePill — "Real" / "Test" for one conversation, and the control
 * that flips it (#968).
 *
 * Triggers reach REAL conversations only. Everything is test unless
 * marked: born real when a user marked "Real customer" (Admin → Users)
 * starts it in the customer chat, or flipped here — the builder chat
 * header and Admin → Conversations (list + reader).
 *
 * Marking REAL asks first (the clock may then message it by itself);
 * marking test is safe and immediate. The pill keeps one width for both
 * states and while saving, so nothing around it moves.
 */

import { useState } from 'react';
import { setConversationAudience, type ConversationAudience } from '../../state/builderApi';
import { useConfirm } from '../Confirm/Confirm';
import styles from './AudiencePill.module.css';

interface Props {
  agentSlug: string;
  /** null = no conversation yet (a new chat): shown as Test, disabled. */
  conversationId: number | null;
  audience: ConversationAudience;
  onChange?: (audience: ConversationAudience) => void;
}

export function AudiencePill({ agentSlug, conversationId, audience, onChange }: Props) {
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const real = audience === 'real';
  const disabled = conversationId === null || saving;

  const flip = async (e: React.MouseEvent) => {
    // Sits inside clickable rows (Admin → Conversations).
    e.stopPropagation();
    if (conversationId === null || saving) return;
    const next: ConversationAudience = real ? 'test' : 'real';
    if (next === 'real') {
      const ok = await confirm({
        title: `Mark #${conversationId} as a real customer?`,
        message: 'Triggers may then message this conversation by themselves.',
        confirmLabel: 'Mark real',
      });
      if (!ok) return;
    }
    setSaving(true);
    setError(null);
    try {
      await setConversationAudience({ agentSlug, conversationId, audience: next });
      onChange?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const title = error
    ? `Could not change it: ${error}`
    : conversationId === null
      ? 'Test — new chats start as test. Triggers reach real customers only.'
      : real
        ? 'Real customer — triggers can reach it. Click to mark as test.'
        : 'Test — triggers never reach it by themselves. Click to mark as real.';

  return (
    <button
      type="button"
      className={`${styles.pill} ${real ? styles.real : styles.test} ${saving ? styles.saving : ''} ${error ? styles.error : ''}`}
      onClick={flip}
      onKeyDown={e => e.stopPropagation()}
      disabled={disabled}
      title={title}
      aria-label={real ? 'Real customer — mark as test' : 'Test — mark as real'}
    >
      <span className={styles.dot} aria-hidden />
      {real ? 'Real' : 'Test'}
    </button>
  );
}
