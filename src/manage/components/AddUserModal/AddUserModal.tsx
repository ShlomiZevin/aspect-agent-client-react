/**
 * "הוספת משתמש" (#1002) — a person for the agent's customer chat: name +
 * phone (what they sign in with at /:agent/go) and an automatic suspension
 * (off / 24 h / 48 h, 48 h by default). The server runs Admin → Users' own
 * Add user (builder/services/manageUsers.js createUser). On "all" the agent
 * is picked here too. Same frame as the confirmation window.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ManageMe, ManageUser } from '../../../types/manage';
import { ManageApiError, manageService } from '../../../services/manageService';
import { IconClose } from '../../icons';
import { COPY } from '../../copy';
import s from '../ConversationModal/ConversationModal.module.css';
import c from '../ConfirmModal/ConfirmModal.module.css';
import f from './AddUserModal.module.css';

type Hours = 24 | 48 | null;

interface Props {
  /** The agent the page shows; null on "all" (picked in the form). */
  agentSlug: string | null;
  me: ManageMe;
  onAdded: (user: ManageUser) => void;
  onClose: () => void;
}

export function AddUserModal({ agentSlug, me, onAdded, onClose }: Props) {
  const agents = me.agents.filter(a => !a.archived);
  const [agent, setAgent] = useState(agentSlug || agents[0]?.slug || '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState<Hours>(48);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInput.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !agent) { setError(COPY.addMissing); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await manageService.createUser(agent, { name: name.trim(), phone: phone.trim(), autoSuspendHours: hours });
      onAdded(r.user);
    } catch (err) {
      setError(err instanceof ManageApiError && err.code === 'user_exists' ? COPY.addExists
        : err instanceof ManageApiError && err.code === 'bad_user' ? COPY.addMissing
          : COPY.actionFailed);
      setBusy(false);
    }
  };

  return (
    <div className={s.backdrop} data-manage-root dir="rtl" lang="he" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className={`${s.dialog} ${c.dialog}`} role="dialog" aria-modal="true" aria-labelledby="manage-add-user-title" onSubmit={submit}>
        <header className={s.head}>
          <div className={s.headText}>
            <h2 id="manage-add-user-title" className={s.title}>{COPY.addUser}</h2>
          </div>
          <button type="button" className={s.close} onClick={onClose} disabled={busy} aria-label={COPY.close}>
            <IconClose size={16} />
          </button>
        </header>
        <div className={s.body}>
          {!agentSlug && (
            <label className={f.field}>
              <span className={f.label}>{COPY.colAgent}</span>
              <select className={f.input} value={agent} onChange={e => setAgent(e.target.value)} disabled={busy}>
                {agents.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
              </select>
            </label>
          )}
          <label className={f.field}>
            <span className={f.label}>{COPY.fName}</span>
            <input ref={nameInput} className={f.input} dir="auto" value={name} placeholder={COPY.namePlaceholder}
              onChange={e => { setName(e.target.value); setError(null); }} disabled={busy} />
          </label>
          <label className={f.field} title={COPY.phoneTitle}>
            <span className={f.label}>{COPY.fPhone}</span>
            <input className={`${f.input} ${f.ltr}`} dir="ltr" type="tel" value={phone} placeholder={COPY.phonePlaceholder}
              onChange={e => { setPhone(e.target.value); setError(null); }} disabled={busy} />
          </label>
          <label className={f.field}>
            <span className={f.label}>{COPY.fAutoSuspend}</span>
            <select className={f.input} value={hours === null ? '' : String(hours)} disabled={busy}
              onChange={e => setHours(e.target.value === '' ? null : (Number(e.target.value) as 24 | 48))}>
              <option value="">{COPY.autoSuspendOff}</option>
              <option value="24">{COPY.autoSuspend24}</option>
              <option value="48">{COPY.autoSuspend48}</option>
            </select>
          </label>
          {/* Reserved line: a failure never resizes the window. */}
          <p className={c.error} role="status">{error || ' '}</p>
        </div>
        <footer className={s.foot}>
          <button type="button" className={s.closeBtn} onClick={onClose} disabled={busy}>{COPY.cancel}</button>
          <button type="submit" className={c.confirm} disabled={busy}>{busy ? COPY.working : COPY.addConfirm}</button>
        </footer>
      </form>
    </div>
  );
}
