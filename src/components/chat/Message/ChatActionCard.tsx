/**
 * Chat-action cards — module actions rendered inside the REAL chat.
 *
 * A scoped module tool (Smart Tune's propose_group_change is the first) may
 * attach an ACTION ENVELOPE to its result; the server forwards it as a
 * persisted `chat_action` thinking step, and this file turns that step into
 * a card. The registry below maps envelope `kind` → renderer; an unknown
 * kind renders nothing, so old clients survive new modules and vice versa.
 *
 * THE ONE RULE: the chat turn never changes anything. The card is a preview
 * with the interpreted filter quoted; only its Process button (a plain POST
 * to the module's own route) applies the change, and the result carries an
 * Undo. Cards re-rendered from an old conversation first ask the server for
 * the proposal's CURRENT state, so a button never acts on a state the buyer
 * is no longer looking at.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './ChatActionCard.module.css';
import { useLanguage } from '../../../context/LanguageContext';
import { replenishmentService } from '../../../services/replenishmentService';
import { formatDateOnly } from '../../intelligence/dateFormat';
import type { ProcurementGroup, TuneProposal, TuneExecuteResult } from '../../../types/replenishment';
import type { ChatActionEnvelope } from './chatAction';

/**
 * Tell the page that hosts the chat that module state changed (the
 * Procurement screen refreshes its chips and rows on this). Works through
 * the widget iframe; on the full chat page parent === window and the
 * message is simply unheard — harmless either way.
 */
function notifyModuleChanged(action: ChatActionEnvelope) {
  try {
    (window.parent || window).postMessage({
      type: 'aspect:module-action',
      module: action.module,
      datasetId: action.datasetId,
      event: 'plan_changed',
    }, window.location.origin);
  } catch { /* messaging is best-effort */ }
}

export function ChatActionCard({ action, baseURL }: { action: ChatActionEnvelope; baseURL?: string }) {
  // The registry: one branch per action kind. A second module's action adds
  // a branch here and nothing else in the chat changes.
  if (action.kind === 'replenishment.group_move_proposal') {
    return <ProposalActionCard action={action} baseURL={baseURL} />;
  }
  return null;
}

/* -- Smart Tune: the previewed group move --------------------------------- */

type ProposalStatus = 'loading' | 'idle' | 'executing' | 'done' | 'cancelled' | 'expired';

function ProposalActionCard({ action, baseURL }: { action: ChatActionEnvelope; baseURL?: string }) {
  const { t, language } = useLanguage();
  const lang = language === 'he' ? 'he' : 'en';
  const proposal = action.payload as unknown as TuneProposal;
  const datasetId = action.datasetId;

  const [status, setStatus] = useState<ProposalStatus>('loading');
  const [result, setResult] = useState<TuneExecuteResult | null>(null);
  const [operationId, setOperationId] = useState<number | null>(null);
  const [reverted, setReverted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync with the proposal's CURRENT server-side state before offering any
  // button — this card may be minutes or days old. Deduped by ref because
  // StrictMode double-invokes effects.
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    replenishmentService.proposalStatus(datasetId, proposal.proposalId, baseURL)
      .then(s => {
        if (s.status === 'proposed') { setStatus('idle'); return; }
        if (s.status === 'executed') {
          setStatus('done');
          if (s.operation) {
            setOperationId(s.operation.operationId);
            setResult({
              operationId: s.operation.operationId,
              applied: s.operation.applied,
              skipped: s.operation.skipped,
              targetGroup: proposal.targetGroup,
            });
            setReverted(s.operation.status === 'reverted');
          }
          return;
        }
        setStatus(s.status === 'cancelled' ? 'cancelled' : 'expired');
      })
      // If the state cannot be read, offer the buttons anyway — Process
      // re-checks on the server and reports the truth.
      .catch(() => setStatus('idle'));
  }, [datasetId, proposal.proposalId, proposal.targetGroup, baseURL]);

  const process = async () => {
    setStatus('executing');
    setActionError(null);
    try {
      const r = await replenishmentService.executeProposal(datasetId, proposal.proposalId, baseURL);
      setResult(r);
      setOperationId(r.operationId);
      setStatus('done');
      notifyModuleChanged(action);
    } catch (e) {
      const expired = e instanceof Error && /expired/i.test(e.message);
      if (expired) { setStatus('expired'); return; }
      setStatus('idle');
      setActionError(t('procurement.tune.actionFailed'));
    }
  };

  const cancel = async () => {
    setStatus('cancelled');
    try { await replenishmentService.cancelProposal(datasetId, proposal.proposalId, baseURL); }
    catch (e) { console.error('[chat-action] cancel', e); }
  };

  const revert = async () => {
    if (!operationId) return;
    try {
      await replenishmentService.revertOperation(datasetId, operationId, baseURL);
      setReverted(true);
      setActionError(null);
      notifyModuleChanged(action);
    } catch {
      setActionError(t('procurement.tune.actionFailed'));
    }
  };

  const groupLabelOf = (g: ProcurementGroup) => t(`procurement.groups.${g}`);
  const more = proposal.count - (proposal.sample?.length ?? 0);
  const muted = status === 'cancelled' || status === 'expired';

  return (
    <div className={`${styles.card} ${muted ? styles.cardMuted : ''}`}>
      <div className={styles.cardSummary}>
        {t('procurement.tune.proposalSummary')
          .replace('{n}', proposal.count.toLocaleString())
          .replace('{group}', groupLabelOf(proposal.targetGroup))}
      </div>
      {/* The filter AS THE SYSTEM UNDERSTOOD IT, quoted — this is what the
          buyer checks before pressing Process. */}
      <div className={styles.cardInterpreted}>{proposal.interpreted}</div>

      <div className={styles.cardTableWrap}>
        <table className={styles.cardTable}>
          <thead>
            <tr>
              <th>{t('procurement.tune.col.code')}</th>
              <th>{t('procurement.tune.col.item')}</th>
              <th>{t('procurement.tune.col.stock')}</th>
              <th>{t('procurement.tune.col.pace')}</th>
              <th>{t('procurement.tune.col.sendBy')}</th>
            </tr>
          </thead>
          <tbody>
            {(proposal.sample ?? []).map(row => (
              <tr key={row.sku}>
                <td className={styles.cellNum}>{row.sku}</td>
                <td className={styles.cellItem}><bdi>{row.item}</bdi></td>
                <td className={styles.cellNum}>
                  {row.stockTracked === false
                    ? <span title={t('procurement.groups.notInStockTip')}>—</span>
                    : row.inStock.toLocaleString()}
                </td>
                <td className={styles.cellNum}>{row.salesPerDay.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className={styles.cellNum}>{row.orderByDate ? formatDateOnly(row.orderByDate, lang) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {more > 0 && (
        <div className={styles.cardMore}>{t('procurement.tune.andMore').replace('{n}', more.toLocaleString())}</div>
      )}

      {status === 'idle' && (
        <div className={styles.cardActions}>
          <button type="button" className={styles.processBtn} onClick={() => void process()}>
            {t('procurement.tune.process')}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={() => void cancel()}>
            {t('procurement.tune.cancel')}
          </button>
          {actionError && <span className={styles.cardError}>{actionError}</span>}
        </div>
      )}

      {status === 'executing' && (
        <div className={styles.cardExecuting}>
          <div className={styles.slimBar}><div className={styles.slimBarFill} /></div>
          {t('procurement.tune.executing').replace('{n}', proposal.count.toLocaleString())}
        </div>
      )}

      {status === 'done' && result && (
        <div className={styles.cardDone}>
          <span className={styles.doneStrip}>
            {reverted
              ? t('procurement.tune.reverted').replace('{n}', result.applied.toLocaleString())
              : (result.skipped > 0
                ? t('procurement.tune.doneSkipped')
                  .replace('{n}', result.applied.toLocaleString())
                  .replace('{k}', result.skipped.toLocaleString())
                : t('procurement.tune.done').replace('{n}', result.applied.toLocaleString()))}
          </span>
          {!reverted && operationId !== null && (
            <button type="button" className={styles.undoBtn} onClick={() => void revert()}>
              {t('procurement.tune.undo')}
            </button>
          )}
          {actionError && <span className={styles.cardError}>{actionError}</span>}
        </div>
      )}

      {status === 'cancelled' && <div className={styles.cardStatusLine}>{t('procurement.tune.cancelled')}</div>}
      {status === 'expired' && <div className={styles.cardStatusLine}>{t('procurement.tune.expired')}</div>}
    </div>
  );
}
