import { useState } from 'react';
import { api } from '../api';
import { Card, Dialog, DialogForm, Field, Icon, Loading, Page, Tag, adminUi } from '../ui';
import { useLoad } from '../useLoad';
import type { PersonDraft, PersonWithHours, Role } from '../types';
import styles from '../management.module.css';

const ROLE_LABEL: Record<Role, string> = { owner: 'בעלים', developer: 'מפתח' };

/** הגדרות: who is on the list. In V0 that is the only setting. */
export function SettingsPage() {
  const { data: people, error, reload } = useLoad(api.people);
  const [dialog, setDialog] = useState<{ person: PersonWithHours | null } | null>(null);

  return (
    <Page
      title="הגדרות"
      sub="מי נמצא ברשימה. הגישה עצמה למערכת נפתחת בנפרד, בדף ההרשאות של Aspect."
      action={<button type="button" className={`${adminUi.btn} ${adminUi.btnPrimary}`} onClick={() => setDialog({ person: null })}><Icon name="plus" size={16} /> אדם חדש</button>}
    >
      {!people ? <Loading error={error} /> : (
        <Card title="צוות" note={`${people.length} אנשים`}>
          {people.map(person => (
            <div
              key={person.id}
              className={`${styles.row} ${styles.rowLink}`}
              role="button"
              tabIndex={0}
              onClick={() => setDialog({ person })}
              onKeyDown={e => { if (e.key === 'Enter') setDialog({ person }); }}
            >
              <div className={styles.rowBody}>
                <span className={styles.rowName}>{person.name}</span>
                <span className={styles.rowLine} dir="ltr" style={{ textAlign: 'right' }}>{person.email}</span>
              </div>
              <Tag tone={person.active ? 'ok' : 'plain'}>{person.active ? ROLE_LABEL[person.role] : 'לא פעיל'}</Tag>
            </div>
          ))}
        </Card>
      )}
      {dialog && (
        <PersonDialog
          person={dialog.person}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); reload(); }}
        />
      )}
    </Page>
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
