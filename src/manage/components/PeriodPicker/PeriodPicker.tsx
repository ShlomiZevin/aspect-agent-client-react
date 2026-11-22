/**
 * The period toggle of the problems and conversations pages (#1001):
 * היום · השבוע · טווח. "טווח" opens a small window with two days (from, to —
 * Israel days, inclusive, up to MAX_RANGE_DAYS, never past today); once
 * set, that segment shows the days ("1.11–15.11") in a fixed-width slot, so
 * the header never moves.
 */

import { useEffect, useRef, useState } from 'react';
import type { ProblemPeriod } from '../../../types/manage';
import { IconCalendar, IconClose } from '../../icons';
import { COPY } from '../../copy';
import { MAX_RANGE_DAYS, israelToday, periodDays, periodLabel } from '../../period';
import m from '../ConversationModal/ConversationModal.module.css';
import s from './PeriodPicker.module.css';

interface Props {
  period: ProblemPeriod;
  onChange: (p: ProblemPeriod) => void;
  now: Date;
}

export function PeriodPicker({ period, onChange, now }: Props) {
  const [picking, setPicking] = useState(false);
  const custom = period.range === 'custom';

  return (
    <>
      <div className={s.toggle} role="tablist">
        {(['today', 'week'] as const).map(r => (
          <button key={r} type="button" role="tab" aria-selected={period.range === r}
            className={`${s.btn} ${period.range === r ? s.on : ''}`} onClick={() => onChange({ range: r })}>
            {r === 'today' ? COPY.today : COPY.week}
          </button>
        ))}
        <button type="button" role="tab" aria-selected={custom} title={COPY.rangeTitle}
          className={`${s.btn} ${s.rangeBtn} ${custom ? s.on : ''}`} onClick={() => setPicking(true)}>
          <IconCalendar size={13} />
          <span className={s.rangeText}>{custom ? periodLabel(period, now) : COPY.range}</span>
        </button>
      </div>
      {picking && (
        <RangeModal
          initial={custom ? period : null}
          today={israelToday(now)}
          onApply={p => { setPicking(false); onChange(p); }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

function RangeModal({ initial, today, onApply, onClose }: {
  initial: { from: string; to: string } | null;
  today: string;
  onApply: (p: ProblemPeriod) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(initial?.from || today);
  const [to, setTo] = useState(initial?.to || today);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = () => {
    if (!from || !to) return setError(COPY.rangeMissing);
    if (from > to) return setError(COPY.rangeOrder);
    if (periodDays(from, to) > MAX_RANGE_DAYS) return setError(COPY.rangeTooLong(MAX_RANGE_DAYS));
    // Never past today (the server refuses it): a typed future day becomes today.
    onApply({ range: 'custom', from: from > today ? today : from, to: to > today ? today : to });
  };

  return (
    <div className={m.backdrop} data-manage-root dir="rtl" lang="he" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${m.dialog} ${s.dialog}`} role="dialog" aria-modal="true" aria-labelledby="manage-range-title">
        <header className={m.head}>
          <div className={m.headText}>
            <h2 id="manage-range-title" className={m.title}>{COPY.rangeTitle}</h2>
          </div>
          <button type="button" className={m.close} onClick={onClose} aria-label={COPY.close}>
            <IconClose size={16} />
          </button>
        </header>
        <form className={`${m.body} ${s.body}`} onSubmit={e => { e.preventDefault(); apply(); }}>
          <div className={s.fields}>
            <label className={s.field}>
              <span>{COPY.rangeFrom}</span>
              <input ref={first} type="date" value={from} max={today} required
                onChange={e => { setFrom(e.target.value); setError(null); }} />
            </label>
            <label className={s.field}>
              <span>{COPY.rangeTo}</span>
              <input type="date" value={to} max={today} required
                onChange={e => { setTo(e.target.value); setError(null); }} />
            </label>
          </div>
          {/* Reserved line: a message never resizes the window. */}
          <p className={s.error} role="status">{error || ' '}</p>
          <button type="submit" hidden />
        </form>
        <footer className={m.foot}>
          <button type="button" className={m.closeBtn} onClick={onClose}>{COPY.cancel}</button>
          <button type="button" className={s.apply} onClick={apply}>{COPY.rangeApply}</button>
        </footer>
      </div>
    </div>
  );
}
