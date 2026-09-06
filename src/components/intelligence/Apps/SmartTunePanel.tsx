/**
 * Smart Tune — the right-side scoped-chat panel over the Procurement screen.
 *
 * Slides in beside the page (from the left in RTL) WITHOUT navigating: the
 * main screen stays interactive, so a buyer can look at the rows the chat is
 * talking about while it answers. Minimize hides the panel and keeps the
 * conversation; Close throws the conversation away.
 *
 * THE ONE RULE OF THIS PANEL: the chat never changes anything. A request to
 * move items comes back as a PROPOSAL CARD — a preview with the interpreted
 * filter quoted, a sample table, and a Process button. Only that button (a
 * plain POST to the module's execute route) moves items, and the result
 * carries an Undo. The chat turn and the state change are different
 * transports on purpose, so "the model said it moved things" can never be
 * the only record of a move.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './SmartTunePanel.module.css';
import { useLanguage } from '../../../context/LanguageContext';
import { useUserContext } from '../../../context/UserContext';
import { tuneChatService, TuneChatUnavailableError } from '../../../services/tuneChatService';
import { replenishmentService } from '../../../services/replenishmentService';
import { formatDateOnly } from '../dateFormat';
import type { ProcurementGroup, TuneProposal, TuneExecuteResult } from '../../../types/replenishment';

interface Props {
  datasetId: string;
  baseURL?: string;
  /** From getAgentConfig(datasetId) — null when the dataset has no agent entry. */
  agentName: string | null;
  /** The client's name for the intro line (agent displayName, or the dataset id). */
  brand: string;
  /** The group the panel was opened on — every message is scoped to it. */
  group: ProcurementGroup;
  groupLabel: string;
  itemCount: number;
  supplierCount: number;
  dataThrough: string | null;
  /** Hidden-not-unmounted when false, so minimize keeps the conversation. */
  open: boolean;
  onMinimize: () => void;
  onClose: () => void;
  /** Items moved (or a move was undone) — the chips and plan are stale. */
  onPlanChanged: () => void;
}

type ProposalStatus = 'idle' | 'executing' | 'done' | 'cancelled' | 'expired';

type Msg =
  | { kind: 'user'; id: number; text: string }
  | { kind: 'assistant'; id: number; text: string }
  | { kind: 'error'; id: number; text: string }
  | {
      kind: 'proposal'; id: number;
      proposal: TuneProposal;
      status: ProposalStatus;
      result?: TuneExecuteResult;
      reverted?: boolean;
      /** A failed action, shown on the card without losing its state. */
      actionError?: string | null;
    };

/** Omit that distributes over a union — the built-in collapses it to common keys. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

let nextId = 1;

export function SmartTunePanel({
  datasetId, baseURL, agentName, brand, group, groupLabel,
  itemCount, supplierCount, dataThrough, open, onMinimize, onClose, onPlanChanged,
}: Props) {
  const { t, language } = useLanguage();
  const { userId } = useUserContext();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ctrlEnter, setCtrlEnter] = useState(false);

  // One conversation per panel life — Close unmounts and the next open starts fresh.
  const conversationIdRef = useRef<string>(crypto.randomUUID());
  const streamRef = useRef<HTMLDivElement | null>(null);

  // Follow the conversation down, the way every chat surface here does.
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const push = (msg: DistributiveOmit<Msg, 'id'>) =>
    setMessages(m => [...m, { ...msg, id: nextId++ } as Msg]);

  const patchProposal = (id: number, patch: Partial<Extract<Msg, { kind: 'proposal' }>>) =>
    setMessages(m => m.map(msg => (msg.kind === 'proposal' && msg.id === id ? { ...msg, ...patch } : msg)));

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setInput('');
    push({ kind: 'user', text });

    // No agent entry for this dataset means no chat endpoint to talk to —
    // the same honest sentence as a server without the feature.
    if (!agentName) {
      push({ kind: 'error', text: t('procurement.tune.notEnabled') });
      return;
    }

    setSending(true);
    try {
      const reply = await tuneChatService.send({
        agentName,
        baseURL,
        message: text,
        conversationId: conversationIdRef.current,
        userId,
        language,
        moduleScope: {
          moduleId: 'replenishment',
          scopeId: 'tune',
          context: { group, datasetId },
        },
      });
      if (reply.text) push({ kind: 'assistant', text: reply.text });
      if (reply.proposal) push({ kind: 'proposal', proposal: reply.proposal, status: 'idle' });
      if (!reply.text && !reply.proposal) {
        push({ kind: 'error', text: t('procurement.tune.turnFailed') });
      }
    } catch (e) {
      if (e instanceof TuneChatUnavailableError) {
        push({ kind: 'error', text: t('procurement.tune.notEnabled') });
      } else {
        console.error('[smart-tune]', e);
        push({ kind: 'error', text: t('procurement.tune.turnFailed') });
      }
    } finally {
      setSending(false);
    }
  };

  const process = async (msg: Extract<Msg, { kind: 'proposal' }>) => {
    patchProposal(msg.id, { status: 'executing', actionError: null });
    try {
      const result = await replenishmentService.executeProposal(datasetId, msg.proposal.proposalId, baseURL);
      patchProposal(msg.id, { status: 'done', result });
      onPlanChanged();
    } catch (e) {
      // The server words a stale preview as "expired" (410) — that card is
      // done for; anything else keeps the preview so Process can be retried.
      const expired = e instanceof Error && /expired/i.test(e.message);
      console.error('[smart-tune] execute', e);
      patchProposal(msg.id, expired
        ? { status: 'expired', actionError: null }
        : { status: 'idle', actionError: t('procurement.tune.actionFailed') });
    }
  };

  const cancel = async (msg: Extract<Msg, { kind: 'proposal' }>) => {
    // The card is dismissed either way; the server just gets told, so the
    // proposal cannot be executed later from another tab.
    patchProposal(msg.id, { status: 'cancelled', actionError: null });
    try {
      await replenishmentService.cancelProposal(datasetId, msg.proposal.proposalId, baseURL);
    } catch (e) {
      console.error('[smart-tune] cancel', e);
    }
  };

  const revert = async (msg: Extract<Msg, { kind: 'proposal' }>) => {
    if (!msg.result) return;
    try {
      await replenishmentService.revertOperation(datasetId, msg.result.operationId, baseURL);
      patchProposal(msg.id, { reverted: true, actionError: null });
      onPlanChanged();
    } catch (e) {
      console.error('[smart-tune] revert', e);
      patchProposal(msg.id, { actionError: t('procurement.tune.actionFailed') });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    if (ctrlEnter) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); void send(input); }
      return; // plain Enter = newline while the checkbox is on
    }
    if (!e.shiftKey) { e.preventDefault(); void send(input); }
  };

  // Composed at render so it follows the language toggle like everything else.
  const intro = t('procurement.tune.intro')
    .replace('{brand}', brand)
    .replace('{group}', groupLabel)
    .replace('{n}', itemCount.toLocaleString())
    .replace('{m}', supplierCount.toLocaleString());

  const contextLine = t('procurement.tune.context')
    .replace('{date}', dataThrough ? formatDateOnly(dataThrough, language === 'he' ? 'he' : 'en') : '—')
    .replace('{group}', groupLabel)
    .replace('{n}', itemCount.toLocaleString());

  const chips = [t('procurement.tune.chip1'), t('procurement.tune.chip2'), t('procurement.tune.chip3')];

  return (
    <aside
      className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
      aria-label={t('procurement.tune.title')}
      aria-hidden={!open}
      // Minimized keeps the DOM (the conversation) but must not keep the
      // focus order — inert takes the whole subtree out of tabbing.
      inert={!open}
    >
      <div className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.title}>
            <span className={styles.titleGlyph} aria-hidden="true">✦</span>
            {t('procurement.tune.title')}
          </span>
          <span className={styles.context}>{contextLine}</span>
        </div>
        <button type="button" className={styles.iconBtn} onClick={onMinimize}
          aria-label={t('procurement.tune.minimize')} title={t('procurement.tune.minimize')}>−</button>
        <button type="button" className={styles.iconBtn} onClick={onClose}
          aria-label={t('procurement.tune.close')} title={t('procurement.tune.close')}>×</button>
      </div>

      <div className={styles.stream} ref={streamRef}>
        <div className={styles.assistantMsg}>{intro}</div>

        {messages.length === 0 && (
          <div className={styles.chips}>
            {chips.map(c => (
              <button key={c} type="button" className={styles.chip} onClick={() => void send(c)}>
                {c}
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => {
          if (msg.kind === 'user') return <div key={msg.id} className={styles.userMsg}>{msg.text}</div>;
          if (msg.kind === 'assistant') return <div key={msg.id} className={styles.assistantMsg}>{msg.text}</div>;
          if (msg.kind === 'error') return <div key={msg.id} className={styles.errorMsg}>{msg.text}</div>;
          return (
            <ProposalCard
              key={msg.id}
              msg={msg}
              t={t}
              language={language === 'he' ? 'he' : 'en'}
              groupLabelOf={g => t(`procurement.groups.${g}`)}
              onProcess={() => void process(msg)}
              onCancel={() => void cancel(msg)}
              onRevert={() => void revert(msg)}
            />
          );
        })}

        {sending && <div className={styles.thinking}>{t('procurement.tune.thinking')}</div>}
      </div>

      <div className={styles.composer}>
        <div className={styles.inputRow}>
          <textarea
            className={styles.input}
            rows={1}
            value={input}
            placeholder={t('procurement.tune.placeholder')}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={t('procurement.tune.placeholder')}
          />
          <button
            type="button"
            className={styles.sendBtn}
            disabled={sending || !input.trim()}
            onClick={() => void send(input)}
            aria-label={t('procurement.tune.send')}
            title={t('procurement.tune.send')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <label className={styles.ctrlEnter}>
          <input type="checkbox" checked={ctrlEnter} onChange={e => setCtrlEnter(e.target.checked)} />
          {t('procurement.tune.ctrlEnter')}
        </label>
      </div>
    </aside>
  );
}

/* -- the previewed change ------------------------------------------------- */

function ProposalCard({ msg, t, language, groupLabelOf, onProcess, onCancel, onRevert }: {
  msg: Extract<Msg, { kind: 'proposal' }>;
  t: (k: string) => string;
  language: 'en' | 'he';
  groupLabelOf: (g: ProcurementGroup) => string;
  onProcess: () => void;
  onCancel: () => void;
  onRevert: () => void;
}) {
  const { proposal, status, result, reverted, actionError } = msg;
  const target = groupLabelOf(proposal.targetGroup);
  const more = proposal.count - proposal.sample.length;
  const muted = status === 'cancelled' || status === 'expired';

  return (
    <div className={`${styles.card} ${muted ? styles.cardMuted : ''}`}>
      <div className={styles.cardSummary}>
        {t('procurement.tune.proposalSummary')
          .replace('{n}', proposal.count.toLocaleString())
          .replace('{group}', target)}
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
            {proposal.sample.map(row => (
              <tr key={row.sku}>
                <td className={styles.cellNum}>{row.sku}</td>
                <td className={styles.cellItem}><bdi>{row.item}</bdi></td>
                <td className={styles.cellNum}>
                  {row.stockTracked === false
                    ? <span title={t('procurement.groups.notInStockTip')}>—</span>
                    : row.inStock.toLocaleString()}
                </td>
                <td className={styles.cellNum}>{row.salesPerDay.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className={styles.cellNum}>{row.orderByDate ? formatDateOnly(row.orderByDate, language) : '—'}</td>
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
          <button type="button" className={styles.processBtn} onClick={onProcess}>
            {t('procurement.tune.process')}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
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
          {!reverted && (
            <button type="button" className={styles.undoBtn} onClick={onRevert}>
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
