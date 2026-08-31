import { useState } from 'react';
import { Modal } from '../Modal';
import type { Person } from '../../types';
import styles from '../NewTaskModal/NewTaskModal.module.css';

/**
 * Asks who is using the board.
 *
 * Offers the roster as buttons first, because in practice the answer is almost
 * always one of three people and picking a name beats typing it. Free text stays
 * available so a new person is not blocked by not being on the list yet.
 */
interface Props {
  people: Person[];
  onCancel: () => void;
  onPick: (name: string) => void;
  /** Adds a name to the roster so it can be assigned work and @mentioned. */
  onAddPerson: (name: string) => Promise<unknown>;
}

export function IdentityModal({ people, onCancel, onPick, onAddPerson }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const known = (n: string) => people.some(p => p.name.toLowerCase() === n.toLowerCase());

  /**
   * A name typed rather than picked joins the roster.
   *
   * Without this you could sign comments as someone nobody can assign work to or
   * @mention — the two lists would drift apart silently, which is what happened
   * on the old board.
   */
  const submit = async (raw: string) => {
    const clean = raw.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      if (!known(clean)) await onAddPerson(clean).catch(() => { /* still let them in */ });
      onPick(clean);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Who are you?"
      width={440}
      onClose={onCancel}
      footer={
        <>
          <span className={styles.spacer} />
          <button type="button" className={styles.ghost} onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={styles.primary}
            disabled={!name.trim() || busy}
            onClick={() => submit(name)}
          >
            {busy ? '…' : known(name.trim()) ? 'Continue' : 'Add and continue'}
          </button>
        </>
      }
    >
      <form className={styles.form} onSubmit={e => { e.preventDefault(); void submit(name); }}>
        {people.length > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>Pick your name</span>
            <div className={styles.row}>
              {people.map(p => (
                <button key={p.name} type="button" className={styles.ghost} onClick={() => onPick(p.name)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className={styles.field}>
          <span className={styles.label}>{people.length > 0 ? 'Or type it' : 'Your name'}</span>
          <input
            className={styles.input}
            value={name}
            placeholder="e.g. Kosta"
            onChange={e => setName(e.target.value)}
          />
        </label>

        <span className={styles.hint}>
          Used to sign your comments and to work out what is waiting on you. Kept in this
          browser only — there are no accounts yet. A new name is added to the roster so
          others can assign you work.
        </span>

        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
