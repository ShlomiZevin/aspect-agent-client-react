import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { todayInIsrael, useText } from '../format';
import { Dialog, DialogForm, Field, Icon, Loading, Num, PageHead, Tag, type Tone } from '../ui';
import { useLoad } from '../useLoad';
import type { ProjectDraft, Quote, QuoteDraft, QuoteStatus } from '../types';
import { ProjectDialog } from './ProjectsPage';
import styles from '../ledger.module.css';

const STATUS_TONE: Record<QuoteStatus, Tone> = {
  preparing: 'wait',
  sent: 'plain',
  pending: 'wait',
  won: 'ok',
  lost: 'plain',
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
  const { t, money, daysText, shortDate } = useText();

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
    // A quote is a price agreed in advance.
    billingType: 'fixed',
    quoteId: quote.id,
  });

  return (
    <div className={styles.page}>
      <PageHead
        title={t('quotes.title')}
        sub={t('quotes.sub')}
        accent={t('quotes.accent')}
        action={<button type="button" className={styles.btnPrimary} onClick={() => setPicked({ quote: null })}><Icon name="plus" size={20} /> {t('quotes.new')}</button>}
      />
      {!data ? <Loading error={error} /> : (
        <>
          <div className={styles.moneyBand}>
            <span className={styles.moneyIcon}><Icon name="money" size={64} stroke={1.6} /></span>
            <div className={styles.moneyMain}>
              <span className={styles.moneyLabel}>{t('quotes.totalOpen')}</span>
              <div className={styles.moneyTotal}><Num>{money(data.openTotal)}</Num></div>
            </div>
            <div className={styles.moneyCount}>
              <span className={styles.bigNumber}>{data.open.length}</span>
              {t('quotes.openCount')}
            </div>
          </div>

          {data.open.length > 0 && (
            <>
              <div className={`${styles.tableHead} ${styles.quotesGrid}`}>
                <span>{t('common.client')}</span><span>{t('quotes.amount')}</span><span>{t('quotes.subject')}</span><span>{t('common.status')}</span><span>{t('quotes.age')}</span>
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
                  <span><Num>{money(quote.amount)}</Num></span>
                  <span>{quote.subject}</span>
                  <span><Tag tone={STATUS_TONE[quote.status]}>{t(`quoteStatus.${quote.status}`)}</Tag></span>
                  <span className={quote.ageDays >= 7 ? styles.ageLate : undefined}>
                    {quote.ageDays >= 7 && <Icon name="alert" size={20} stroke={2.2} />} {daysText(quote.ageDays)}
                  </span>
                </div>
              ))}
            </>
          )}

          {data.closed.length > 0 && (
            <section className={styles.closedBlock}>
              <h2 className={styles.closedBand}><Icon name="trophy" size={30} stroke={2} /> {t('quotes.wonThisMonth')}</h2>
              {data.closed.map(quote => (
                <div className={`${styles.tableRow} ${styles.closedGrid}`} key={quote.id}>
                  <span className={styles.cellName}>{quote.clientName}</span>
                  <span>
                    {quote.subject}
                    {quote.closedDate && <span className={styles.cellSoft}><Num>{shortDate(quote.closedDate)}</Num></span>}
                  </span>
                  <span><Num>{money(quote.amount)}</Num></span>
                  {quote.projectId
                    ? <span><Tag tone="ok">{t('quotes.becameProject')}</Tag></span>
                    : <button type="button" className={styles.btnPrimary} onClick={() => startConvert(quote)}>{t('quotes.toProject')}</button>}
                </div>
              ))}
            </section>
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
    </div>
  );
}

function QuoteDialog({ quote, onClose, onDone }: { quote: Quote | null; onClose: () => void; onDone: () => void }) {
  const [draft, setDraft] = useState(quote ? toDraft(quote) : emptyDraft);
  const set = (change: Partial<QuoteDraft>) => setDraft(current => ({ ...current, ...change }));
  const { data: clients } = useLoad(api.clients);
  const { t } = useText();

  return (
    <Dialog title={quote ? quote.subject : t('quotes.new')} onClose={onClose}>
      <DialogForm
        onSave={() => (quote ? api.updateQuote(quote.id, draft) : api.createQuote(draft))}
        onDone={onDone}
        onCancel={onClose}
      >
        <Field label={t('common.client')}>
          <select className={styles.input} value={draft.clientId} onChange={e => set({ clientId: Number(e.target.value) || '' })}>
            <option value="">{t('common.choose')}</option>
            {clients?.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        <Field label={t('quotes.subject')}>
          <input className={styles.input} value={draft.subject} onChange={e => set({ subject: e.target.value })} />
        </Field>
        <div className={styles.formRow}>
          <Field label={t('common.amount')}>
            <input className={styles.input} type="number" min="0" value={draft.amount} onChange={e => set({ amount: e.target.value })} />
          </Field>
          <Field label={t('common.status')}>
            <select className={styles.input} value={draft.status} onChange={e => set({ status: e.target.value as QuoteStatus })}>
              {(Object.keys(STATUS_TONE) as QuoteStatus[]).map(status => <option key={status} value={status}>{t(`quoteStatus.${status}`)}</option>)}
            </select>
          </Field>
        </div>
        <div className={styles.formRow}>
          <Field label={t('quotes.sentOn')}>
            <input className={styles.input} type="date" value={draft.sentDate} onChange={e => set({ sentDate: e.target.value })} />
          </Field>
          <Field label={t('quotes.lastFollowup')}>
            <input className={styles.input} type="date" value={draft.lastFollowupDate} onChange={e => set({ lastFollowupDate: e.target.value })} />
          </Field>
        </div>
        <div>
          <button type="button" className={styles.btnQuiet} onClick={() => set({ lastFollowupDate: todayInIsrael() })}>
            {t('quotes.followedToday')}
          </button>
        </div>
      </DialogForm>
    </Dialog>
  );
}
