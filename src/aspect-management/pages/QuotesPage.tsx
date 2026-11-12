import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { daysText, money, shortDate, todayInIsrael } from '../format';
import { Card, Dialog, DialogForm, Field, Icon, Loading, Num, Page, Stat, Tag, adminUi, type Tone } from '../ui';
import { useLoad } from '../useLoad';
import type { ProjectDraft, Quote, QuoteDraft, QuoteStatus } from '../types';
import { ProjectDialog } from './ProjectsPage';
import styles from '../management.module.css';

const STATUS: Record<QuoteStatus, { label: string; tone: Tone }> = {
  preparing: { label: 'בהכנה', tone: 'wait' },
  sent: { label: 'נשלח', tone: 'plain' },
  pending: { label: 'ממתין לאישור', tone: 'wait' },
  won: { label: 'נסגר', tone: 'ok' },
  lost: { label: 'אבד', tone: 'plain' },
};

const emptyDraft: QuoteDraft = { clientId: '', subject: '', amount: '', status: 'preparing', sentDate: '', lastFollowupDate: '' };

const toDraft = (quote: Quote): QuoteDraft => ({
  clientId: quote.clientId,
  subject: quote.subject,
  amount: String(quote.amount),
  status: quote.status,
  sentDate: quote.sentDate ?? '',
  lastFollowupDate: quote.lastFollowupDate ?? '',
});

/** 5. הכסף שבדרך: open quotes, and a won quote can become a project. */
export function QuotesPage() {
  const { data, error, reload } = useLoad(api.quotes);
  const [picked, setPicked] = useState<{ quote: Quote | null } | null>(null);
  const [converting, setConverting] = useState<ProjectDraft | null>(null);
  const [params, setParams] = useSearchParams();

  // Arriving from a morning alert opens that quote.
  const fromLink = data && [...data.open, ...data.closed].find(q => q.id === Number(params.get('open')));
  const dialog = picked ?? (fromLink ? { quote: fromLink } : null);
  const close = () => {
    setPicked(null);
    setParams({}, { replace: true });
  };

  const startConvert = (quote: Quote) => setConverting({
    clientId: quote.clientId,
    name: quote.subject,
    hoursBudget: '',
    dueDate: '',
    status: 'active',
    amount: String(quote.amount),
    quoteId: quote.id,
  });

  const waiting = data?.open.filter(q => q.ageDays >= 7).length ?? 0;
  // The closed list also keeps an older won quote until it becomes a project.
  const monthStart = `${todayInIsrael().slice(0, 8)}01`;
  const wonThisMonth = data?.closed.filter(q => q.closedDate && q.closedDate >= monthStart) ?? [];

  return (
    <Page
      title="הכסף שבדרך"
      sub="הצעות מחיר פתוחות"
      action={<button type="button" className={`${adminUi.btn} ${adminUi.btnPrimary}`} onClick={() => setPicked({ quote: null })}><Icon name="plus" size={16} /> הצעה חדשה</button>}
    >
      {!data ? <Loading error={error} /> : (
        <>
          <div className={styles.stats}>
            <Stat label="סה״כ הצעות פתוחות" value={<Num>{money(data.openTotal)}</Num>} />
            <Stat label="הצעות פתוחות" value={data.open.length} />
            <Stat label="בלי מעקב שבוע ומעלה" value={waiting} late={waiting > 0} />
            <Stat label="נסגרו החודש" value={wonThisMonth.length} note={<Num>{money(wonThisMonth.reduce((sum, q) => sum + q.amount, 0))}</Num>} />
          </div>

          <Card title="הצעות פתוחות">
            {data.open.length === 0 ? <p className={styles.quietLine}>אין הצעות פתוחות.</p> : (
              <>
                <div className={`${styles.tableHead} ${styles.quotesGrid}`}>
                  <span>לקוח</span><span>נושא</span><span>סכום</span><span>סטטוס</span><span>עודכן לפני</span>
                </div>
                {data.open.map(quote => (
                  <div
                    key={quote.id}
                    className={`${styles.tableRow} ${styles.quotesGrid} ${styles.rowLink}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPicked({ quote })}
                    onKeyDown={e => { if (e.key === 'Enter') setPicked({ quote }); }}
                  >
                    <span className={styles.cellName}>{quote.clientName}</span>
                    <span>{quote.subject}</span>
                    <span><Num>{money(quote.amount)}</Num></span>
                    <span><Tag tone={STATUS[quote.status].tone}>{STATUS[quote.status].label}</Tag></span>
                    <span>{quote.ageDays >= 7 ? <Tag tone="late">{daysText(quote.ageDays)}</Tag> : daysText(quote.ageDays)}</span>
                  </div>
                ))}
              </>
            )}
          </Card>

          {data.closed.length > 0 && (
            <Card title="נסגרו">
              {data.closed.map(quote => (
                <div className={`${styles.tableRow} ${styles.closedGrid}`} key={quote.id}>
                  <span className={styles.cellName}>{quote.clientName}</span>
                  <span>
                    {quote.subject}
                    {quote.closedDate && <span className={styles.cellSoft}><Num>{shortDate(quote.closedDate)}</Num></span>}
                  </span>
                  <span><Num>{money(quote.amount)}</Num></span>
                  {quote.projectId
                    ? <span><Tag tone="ok">הפך לפרויקט</Tag></span>
                    : <span><button type="button" className={adminUi.btn} onClick={() => startConvert(quote)}>הפוך לפרויקט</button></span>}
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {dialog && (
        <QuoteDialog
          quote={dialog.quote}
          onClose={close}
          onDone={() => { close(); reload(); }}
        />
      )}
      {converting && (
        <ProjectDialog
          initial={converting}
          onClose={() => setConverting(null)}
          onDone={() => { setConverting(null); reload(); }}
        />
      )}
    </Page>
  );
}

function QuoteDialog({ quote, onClose, onDone }: { quote: Quote | null; onClose: () => void; onDone: () => void }) {
  const [draft, setDraft] = useState(quote ? toDraft(quote) : emptyDraft);
  const set = (change: Partial<QuoteDraft>) => setDraft(current => ({ ...current, ...change }));
  const { data: clients } = useLoad(api.clients);

  return (
    <Dialog title={quote ? quote.subject : 'הצעה חדשה'} onClose={onClose}>
      <DialogForm
        onSave={() => (quote ? api.updateQuote(quote.id, draft) : api.createQuote(draft))}
        onDone={onDone}
        onCancel={onClose}
      >
        <Field label="לקוח">
          <select className={styles.input} value={draft.clientId} onChange={e => set({ clientId: Number(e.target.value) || '' })}>
            <option value="">בחירה</option>
            {clients?.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        <Field label="נושא">
          <input className={styles.input} value={draft.subject} onChange={e => set({ subject: e.target.value })} />
        </Field>
        <div className={styles.formRow}>
          <Field label="סכום (₪)">
            <input className={styles.input} type="number" min="0" value={draft.amount} onChange={e => set({ amount: e.target.value })} />
          </Field>
          <Field label="סטטוס">
            <select className={styles.input} value={draft.status} onChange={e => set({ status: e.target.value as QuoteStatus })}>
              {(Object.keys(STATUS) as QuoteStatus[]).map(status => <option key={status} value={status}>{STATUS[status].label}</option>)}
            </select>
          </Field>
        </div>
        <div className={styles.formRow}>
          <Field label="נשלח בתאריך">
            <input className={styles.input} type="date" value={draft.sentDate} onChange={e => set({ sentDate: e.target.value })} />
          </Field>
          <Field label="מעקב אחרון">
            <input className={styles.input} type="date" value={draft.lastFollowupDate} onChange={e => set({ lastFollowupDate: e.target.value })} />
          </Field>
        </div>
        <div>
          <button type="button" className={adminUi.btn} onClick={() => set({ lastFollowupDate: todayInIsrael() })}>
            <Icon name="check" size={16} /> עקבתי היום
          </button>
        </div>
      </DialogForm>
    </Dialog>
  );
}
