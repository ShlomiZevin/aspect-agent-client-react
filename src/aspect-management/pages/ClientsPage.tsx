import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { SERVICE_STATUSES, useText } from '../format';
import { BillingSelect, Dialog, DialogForm, Field, Icon, Loading, Num, PageHead } from '../ui';
import { useLoad } from '../useLoad';
import type { ClientDraft, Service } from '../types';
import styles from '../ledger.module.css';

export function ClientsPage() {
  const { data: clients, error, reload } = useLoad(api.clients);
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const { t, hours, shortDate } = useText();

  return (
    <div className={styles.page}>
      <PageHead
        title={t('clients.title')}
        sub={clients ? t('clients.count', { n: clients.length }) : undefined}
        action={<button type="button" className={styles.btnPrimary} onClick={() => setAdding(true)}><Icon name="plus" size={22} stroke={2.2} /> {t('clients.new')}</button>}
      />
      {!clients ? <Loading error={error} /> : clients.length === 0 ? <p className={styles.quietLine}>{t('clients.empty')}</p> : (
        <>
          <div className={`${styles.tableHead} ${styles.clientsGrid}`}>
            <span /><span>{t('common.client')}</span><span>{t('common.hoursThisMonth')}<small className={styles.headNote}>{t('clients.ofPackage')}</small></span><span>{t('clients.activeProjects')}</span><span>{t('common.nextStep')}</span>
          </div>
          {clients.map(client => (
            <div
              key={client.id}
              className={`${styles.tableRow} ${styles.clientsGrid} ${styles.rowLink}`}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/aspect/management/clients/${client.id}`)}
              onKeyDown={e => { if (e.key === 'Enter') navigate(`/aspect/management/clients/${client.id}`); }}
            >
              <span className={styles.rowChevron}><Icon name="chevronStart" size={22} stroke={2} /></span>
              <span className={styles.cellName}>{client.name}</span>
              <span className={client.packageHours !== null && client.hoursThisMonth > client.packageHours ? styles.hoursOver : styles.hoursOk}>
                <b><Num>{hours(client.hoursThisMonth)}</Num></b>
                {client.packageHours !== null && <> {t('common.of')} <Num>{hours(client.packageHours)}</Num></>} {t('common.hours')}
              </span>
              <span className={styles.countCell}>{client.activeProjects}</span>
              <span className={styles.nextCell}>
                {client.nextStep ? <Icon name="calendar" size={22} stroke={1.6} /> : null}
                {client.nextStep || '—'}
                {client.nextStepDate && <span className={styles.nextDate}> · <Num>{shortDate(client.nextStepDate)}</Num></span>}
              </span>
            </div>
          ))}
        </>
      )}
      {adding && (
        <ClientDialog
          title={t('clients.new')}
          initial={{ name: '', logoUrl: '', packageHours: '', services: [], nextStep: '', nextStepDate: '', billingType: '' }}
          onSave={draft => api.createClient(draft)}
          onClose={() => setAdding(false)}
          onDone={() => { setAdding(false); reload(); }}
        />
      )}
    </div>
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
  const { t, serviceStatus } = useText();
  const set = (change: Partial<ClientDraft>) => setDraft(current => ({ ...current, ...change }));
  const setService = (index: number, change: Partial<Service>) =>
    set({ services: draft.services.map((s, i) => (i === index ? { ...s, ...change } : s)) });

  return (
    <Dialog title={title} onClose={onClose}>
      <DialogForm onSave={() => onSave(draft, note)} onDone={onDone} onCancel={onClose}>
        <Field label={t('clients.name')}>
          <input className={styles.input} value={draft.name} onChange={e => set({ name: e.target.value })} />
        </Field>
        <div className={styles.formRow}>
          <Field label={t('common.billingType')}>
            <BillingSelect value={draft.billingType} onChange={billingType => set({ billingType })} />
          </Field>
          <Field label={t('clients.package')}>
            <input className={styles.input} type="number" min="0" step="0.5" value={draft.packageHours} onChange={e => set({ packageHours: e.target.value })} />
          </Field>
        </div>
        <Field label={t('clients.logo')}>
          <input className={styles.input} dir="ltr" value={draft.logoUrl ?? ''} onChange={e => set({ logoUrl: e.target.value })} />
        </Field>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('clients.services')}</span>
          {draft.services.map((service, index) => (
            <div className={styles.serviceRow} key={index}>
              <input className={styles.input} aria-label={t('clients.serviceName')} value={service.name} onChange={e => setService(index, { name: e.target.value })} />
              <select className={styles.input} aria-label={t('common.status')} value={service.status} onChange={e => setService(index, { status: e.target.value })}>
                {Object.keys(SERVICE_STATUSES).map(status => <option key={status} value={status}>{serviceStatus(status)}</option>)}
              </select>
              <button type="button" className={styles.linkBtn} onClick={() => set({ services: draft.services.filter((_, i) => i !== index) })}>{t('clients.remove')}</button>
            </div>
          ))}
          <div>
            <button type="button" className={styles.linkBtn} onClick={() => set({ services: [...draft.services, { name: '', status: Object.keys(SERVICE_STATUSES)[0] }] })}>
              {t('clients.addService')}
            </button>
          </div>
        </div>

        <div className={styles.formRow}>
          <Field label={t('common.nextStep')}>
            <input className={styles.input} value={draft.nextStep ?? ''} onChange={e => set({ nextStep: e.target.value })} />
          </Field>
          <Field label={t('common.date')}>
            <input className={styles.input} type="date" value={draft.nextStepDate ?? ''} onChange={e => set({ nextStepDate: e.target.value })} />
          </Field>
        </div>

        {showNote && (
          <Field label={t('clients.note')}>
            <textarea className={styles.input} value={note} onChange={e => setNote(e.target.value)} />
          </Field>
        )}
      </DialogForm>
    </Dialog>
  );
}
