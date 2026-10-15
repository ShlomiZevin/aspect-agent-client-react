/**
 * The chat's finance answer: a statement card above the reply.
 *
 * The statement itself is the shared `StatementTable` — the same component the
 * Apps finance screens draw — so the chat and the app never drift apart. This
 * file only adds the card chrome: the report's title, the periods it compares
 * and any notice the books came back with (task #116).
 *
 * Demo-only by construction: only the Aspect demo crew's `get_finance_report`
 * attaches the `finance.report` envelope, and an unknown action kind renders
 * nothing, so no other client's chat is touched.
 */

import styles from './FinanceReportCard.module.css';
import { useLanguage } from '../../../context/LanguageContext';
import { StatementTable } from '../../finance/StatementTable';
import type { StatementBlock } from '../../finance/StatementTable';
import type { ChatActionEnvelope } from './chatAction';

interface FinancePayload {
  title?: string;
  periods?: { a?: string; b?: string; data_closed_through?: string };
  notice?: string | null;
  columns?: string[];
  blocks?: StatementBlock[];
}

const WORDS = {
  he: { closedThrough: 'הספרים סגורים עד', vs: 'מול' },
  en: { closedThrough: 'Books closed through', vs: 'vs' },
};

export function FinanceReportCard({ action }: { action: ChatActionEnvelope }) {
  const { language } = useLanguage();
  const w = WORDS[language === 'he' ? 'he' : 'en'];
  const payload = action.payload as unknown as FinancePayload;
  const periods = payload.periods;

  const subtitle = [
    periods?.a && periods?.b ? `${periods.a} ${w.vs} ${periods.b}` : null,
    periods?.data_closed_through ? `${w.closedThrough} ${periods.data_closed_through}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={styles.card} dir="rtl">
      <div className={styles.head}>
        <div className={styles.title}>{payload.title}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
      {payload.notice && <div className={styles.notice}>{payload.notice}</div>}
      <div className={styles.body}>
        <StatementTable columns={payload.columns ?? []} blocks={payload.blocks ?? []} variant="compact" />
      </div>
    </div>
  );
}
