import { useState } from 'react';
import { api } from '../api';
import { Dialog, DialogForm, Field, Icon, Loading, PageHead } from '../ui';
import { useLoad } from '../useLoad';
import type { PersonDraft, PersonWithHours, Role } from '../types';
import styles from '../ledger.module.css';

const ROLE_LABEL: Record<Role, string> = { owner: 'בעלים', developer: 'מפתח' };

/** הגדרות: who is on the list. In V0 that is the only setting. */
export function SettingsPage() {
  const { data: people, error, reload } = useLoad(api.people);
  const [dialog, setDialog] = useState<{ person: PersonWithHours | null } | null>(null);

  return (
    <div className={styles.page}>
      <PageHead
        title="הגדרות"
        sub="מי נמצא ברשימה"
        action={<button type="button" className={styles.btnPrimary} onClick={() => setDialog({ person: null })}><Icon name="plus" size={22} stroke={2.2} /> אדם חדש</button>}
      />
      {!people ? <Loading error={error} /> : (
        <>
          <div className={styles.rows}>
            {people.map(person => (
              <div
                key={person.id}
                className={`${styles.row} ${styles.rowLink} ${styles.personRow}`}
                role="button"
                tabIndex={0}
                onClick={() => setDialog({ person })}
                onKeyDown={e => { if (e.key === 'Enter') setDialog({ person }); }}
              >
                <span className={styles.rowChevron}><Icon name="chevronStart" size={22} stroke={2} /></span>
                <span className={styles.rowName}>{person.name}</span>
                <span className={`${styles.roleTag} ${!person.active ? styles.roleOff : person.role === 'owner' ? styles.roleOwner : styles.roleDev}`}>
                  {person.active ? ROLE_LABEL[person.role] : 'לא פעיל'}
                </span>
                <span className={styles.personEmail} dir="ltr">{person.email}</span>
              </div>
            ))}
          </div>
          <p className={styles.handNote}>הגישה עצמה למערכת נפתחת בנפרד, בדף ההרשאות של Aspect</p>
        </>
      )}
      {dialog && (
        <PersonDialog
          person={dialog.person}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); reload(); }}
        />
      )}
    </div>
  );
}

function PersonDialog({ person, onClose, onDone }: { person: PersonWithHours | null; onClose: () => void; onDone: () => void }) {
  const [draft, setDraft] = useState<PersonDraft>(
    person ? { name: person.name, email: person.email, role: person.role, active: person.active }
      : { name: '', email: '', role: 'developer', active: true },
  );
  const set = (change: Partial<PersonDraft>) => setDraft(current => ({ ...current, ...change }));

  return (
    <Dialog title={person ? person.name : 'אדם חדש'} onClose={onClose}>
      <DialogForm
        onSave={() => (person ? api.updatePerson(person.id, draft) : api.createPerson(draft))}
        onDone={onDone}
        onCancel={onClose}
      >
        <Field label="שם">
          <input className={styles.input} value={draft.name} onChange={e => set({ name: e.target.value })} />
        </Field>
        <Field label="אימייל">
          <input className={styles.input} dir="ltr" type="email" value={draft.email} onChange={e => set({ email: e.target.value })} />
        </Field>
        <Field label="תפקיד">
          <select className={styles.input} value={draft.role} onChange={e => set({ role: e.target.value as Role })}>
            <option value="developer">{ROLE_LABEL.developer}</option>
            <option value="owner">{ROLE_LABEL.owner}</option>
          </select>
        </Field>
        <label className={styles.checkLine}>
          <input className={styles.checkbox} type="checkbox" checked={draft.active} onChange={e => set({ active: e.target.checked })} />
          פעיל
        </label>
        <p className={styles.formHint}>הגישה עצמה למערכת נפתחת בנפרד, בדף ההרשאות של Aspect.</p>
      </DialogForm>
    </Dialog>
  );
}
