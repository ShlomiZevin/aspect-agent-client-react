import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { hours, shortDate } from '../format';
import { Card, Dialog, DialogForm, Field, Icon, Loading, Num, Page, adminUi } from '../ui';
import { useLoad } from '../useLoad';
import type { ClientDraft, Service } from '../types';
import styles from '../management.module.css';

const SERVICE_STATUSES = ['פעיל', 'בהטמעה', 'מושהה'];

export function ClientsPage() {
  const { data: clients, error, reload } = useLoad(api.clients);
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();

  return (
    <Page
      title="לקוחות"
      sub={clients ? `${clients.length} לקוחות` : undefined}
      action={<button type="button" className={`${adminUi.btn} ${adminUi.btnPrimary}`} onClick={() => setAdding(true)}><Icon name="plus" size={16} /> לקוח חדש</button>}
    >
      {!clients ? <Loading error={error} /> : (
        <Card>
          {clients.length === 0 ? <p className={styles.quietLine}>עוד אין לקוחות.</p> : (
            <>
              <div className={`${styles.tableHead} ${styles.clientsGrid}`}>
                <span>לקוח</span><span>שעות החודש</span><span>הבא בתור</span>
              </div>
              {clients.map(client => (
                <div
                  key={client.id}
                  className={`${styles.tableRow} ${styles.clientsGrid} ${styles.rowLink}`}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/management/clients/${client.id}`)}
                  onKeyDown={e => { if (e.key === 'Enter') navigate(`/management/clients/${client.id}`); }}
                >
                  <span className={styles.cellName}>{client.name}</span>
                  <span>
                    <Num>{hours(client.hoursThisMonth)}</Num>
                    {client.packageHours !== null && <> מתוך <Num>{hours(client.packageHours)}</Num></>}
                  </span>
                  <span>
                    {client.nextStep || '—'}
                    {client.nextStepDate && <span className={styles.cellSoft}><Num>{shortDate(client.nextStepDate)}</Num></span>}
                  </span>
                </div>
              ))}
            </>
          )}
        </Card>
      )}
      {adding && (
        <ClientDialog
          title="לקוח חדש"
          initial={{ name: '', logoUrl: '', packageHours: '', services: [], nextStep: '', nextStepDate: '' }}
          onSave={draft => api.createClient(draft)}
          onClose={() => setAdding(false)}
          onDone={() => { setAdding(false); reload(); }}
        />
      )}
    </Page>
  );
}

export function ClientDialog({ title, initial, onSave, onClose, onDone, showNote = false }: {
  title: string;
  initial: ClientDraft;
  onSave: (draft: ClientDraft, note: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
  showNote?: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const [note, setNote] = useState('');
  const set = (change: Partial<ClientDraft>) => setDraft(current => ({ ...current, ...change }));
  const setService = (index: number, change: Partial<Service>) =>
    set({ services: draft.services.map((s, i) => (i === index ? { ...s, ...change } : s)) });

  return (
    <Dialog title={title} onClose={onClose}>
      <DialogForm onSave={() => onSave(draft, note)} onDone={onDone} onCancel={onClose}>
        <Field label="שם הלקוח">
          <input className={styles.input} value={draft.name} onChange={e => set({ name: e.target.value })} />
        </Field>
        <div className={styles.formRow}>
          <Field label="שעות בחבילה בחודש">
            <input className={styles.input} type="number" min="0" step="0.5" value={draft.packageHours} onChange={e => set({ packageHours: e.target.value })} />
          </Field>
          <Field label="קישור ללוגו (לא חובה)">
            <input className={styles.input} dir="ltr" value={draft.logoUrl ?? ''} onChange={e => set({ logoUrl: e.target.value })} />
          </Field>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>שירותים</span>
          {draft.services.map((service, index) => (
            <div className={styles.serviceRow} key={index}>
              <input className={styles.input} aria-label="שם השירות" value={service.name} onChange={e => setService(index, { name: e.target.value })} />
              <select className={styles.input} aria-label="סטטוס" value={service.status} onChange={e => setService(index, { status: e.target.value })}>
                {SERVICE_STATUSES.map(status => <option key={status}>{status}</option>)}
              </select>
              <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} aria-label="הסרת השירות" onClick={() => set({ services: draft.services.filter((_, i) => i !== index) })}>
                <Icon name="trash" />
              </button>
            </div>
          ))}
          <div>
            <button type="button" className={adminUi.btn} onClick={() => set({ services: [...draft.services, { name: '', status: SERVICE_STATUSES[0] }] })}>
              <Icon name="plus" size={16} /> הוספת שירות
            </button>
          </div>
        </div>

        <div className={styles.formRow}>
          <Field label="הצעד הבא">
            <input className={styles.input} value={draft.nextStep ?? ''} onChange={e => set({ nextStep: e.target.value })} />
          </Field>
          <Field label="תאריך">
            <input className={styles.input} type="date" value={draft.nextStepDate ?? ''} onChange={e => set({ nextStepDate: e.target.value })} />
          </Field>
        </div>

        {showNote && (
          <Field label="הערה חדשה (פגישה, שיחה)">
            <textarea className={styles.input} value={note} onChange={e => setNote(e.target.value)} />
          </Field>
        )}
      </DialogForm>
    </Dialog>
  );
}
