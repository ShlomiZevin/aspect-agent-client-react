import { useState } from 'react';
import { Modal } from '../Modal';
import type { Task } from '../../types';
import styles from '../shared/form.module.css';
import own from './PublishNotesModal.module.css';

/**
 * Shlomi's Publish window (task #102): every task marked "For customers" that
 * is Done and not yet published, showing the release note exactly as the
 * customer will read it. Ticked notes go to every customer's "what's new" popup
 * in the Intelligence Center.
 *
 * A note without a headline cannot be ticked — the customer popup would have
 * nothing to show for it.
 */
interface Props {
  candidates: Task[];
  onClose: () => void;
  onOpenTask: (id: number) => void;
  onPublish: (ids: number[]) => Promise<{ published: number[]; skipped: number[] }>;
}

const ready = (t: Task) => Boolean(t.noteHeadline?.trim());

export function PublishNotesModal({ candidates, onClose, onOpenTask, onPublish }: Props) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(candidates.filter(ready).map(t => t.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Only ids still on the list: a task published or unmarked elsewhere while
  // this window is open drops out of `candidates` and must not be sent.
  const chosen = candidates.filter(t => selected.has(t.id) && ready(t)).map(t => t.id);

  const publish = async () => {
    if (chosen.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { skipped } = await onPublish(chosen);
      if (skipped.length > 0) {
        setError(`Not published: ${skipped.map(id => `#${id}`).join(', ')} - check it is Done and has a headline.`);
        setBusy(false);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Publish to customers"
      width={680}
      onClose={onClose}
      footer={
        <>
          <span className={own.count}>
            {candidates.length === 0 ? 'Nothing waiting' : `${candidates.length} waiting`}
          </span>
          <span className={styles.spacer} />
          <button type="button" className={styles.ghost} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={styles.primary}
            disabled={chosen.length === 0 || busy}
            onClick={() => void publish()}
          >
            {busy ? 'Publishing…' : `Publish ${chosen.length}`}
          </button>
        </>
      }
    >
      <p className={own.intro}>
        Every customer sees these in the Intelligence Center&apos;s &quot;מה חדש&quot; popup, once.
      </p>

      {candidates.length === 0 && (
        <p className={own.empty}>
          No release notes waiting. A task shows up here when it is marked For customers and moved to Done.
        </p>
      )}

      {candidates.map(t => (
        <article key={t.id} className={`${own.item} ${selected.has(t.id) ? '' : own.itemOff}`}>
          <input
            type="checkbox"
            className={own.check}
            checked={selected.has(t.id) && ready(t)}
            disabled={!ready(t)}
            onChange={() => toggle(t.id)}
            aria-label={`Publish #${t.id}`}
          />
          <div className={own.main}>
            <button type="button" className={own.task} onClick={() => { onOpenTask(t.id); onClose(); }}>
              #{t.id} {t.title}
            </button>
            {ready(t) ? (
              <div className={own.preview} dir="rtl" lang="he">
                <div className={own.headline}>{t.noteHeadline}</div>
                {t.noteBody && <div className={own.body}>{t.noteBody}</div>}
              </div>
            ) : (
              <div className={own.missing}>No headline yet - open the task to write the note</div>
            )}
          </div>
        </article>
      ))}

      {error && <p className={own.error}>{error}</p>}
    </Modal>
  );
}
