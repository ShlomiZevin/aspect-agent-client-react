/**
 * "All agents" is for the Lybi team only (task #985). Not real auth — the
 * same light super-admin unlock as the hidden /users page
 * (services/superAdminService); once unlocked, apiRequest sends the key and
 * the server's requireSuperAdmin lets /api/manage/customer-problems through.
 */

import { useState, type FormEvent } from 'react';
import { unlockSuperAdmin } from '../../../services/superAdminService';
import { COPY } from '../../copy';
import styles from './AllGate.module.css';

export function AllGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (unlockSuperAdmin(code.trim())) onUnlocked();
    else setWrong(true);
  };

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <h1 className={styles.title}>{COPY.gateTitle}</h1>
        <p className={styles.text}>{COPY.gateText}</p>
        <div className={styles.row}>
          <input
            className={styles.input}
            type="password"
            inputMode="numeric"
            autoFocus
            value={code}
            placeholder={COPY.gatePlaceholder}
            onChange={e => { setCode(e.target.value); setWrong(false); }}
          />
          <button className={styles.button} type="submit" disabled={!code.trim()}>{COPY.gateButton}</button>
        </div>
        {/* Reserved line — the message never moves the card. */}
        <div className={styles.error} aria-live="polite">{wrong ? COPY.gateWrong : ' '}</div>
      </form>
    </div>
  );
}
