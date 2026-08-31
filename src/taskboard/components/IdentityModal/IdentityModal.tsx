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
}

export function IdentityModal({ people, onCancel, onPick }: Props) {
  const [name, setName] = useState('');

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
            disabled={!name.trim()}
            onClick={() => onPick(name.trim())}
          >
            Continue
          </button>
        </>
      }
    >
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (name.trim()) onPick(name.trim()); }}>
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
          browser only — there are no accounts yet.
        </span>

        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
