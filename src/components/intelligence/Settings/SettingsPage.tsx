/**
 * Customer-facing Intelligence Center settings (task #69) — currently just
 * Data Chat prepared questions. Follow-up to task #63, which built the same
 * {icon, text, question} editing UI on the hidden internal admin page
 * (IntelligenceAdminPage's DatasetQuickQuestionsPage) so the customer had to
 * ask Kosta/Noa to change a tile. This is that same editor, moved onto the
 * customer's own side of the product and wired to the customer-scoped write
 * endpoint (PUT /api/insights/:datasetId/quick-questions — quickQuestions
 * only, see insights.routes.js) rather than the admin PUT, which also
 * touches enabled/brandLabel/prompts.
 */
import { useEffect, useState } from 'react';
import { insightsService } from '../../../services/insightsService';
import { useLanguage } from '../../../context/LanguageContext';
import type { QuickQuestion } from '../../../types/agent';
import styles from './SettingsPage.module.css';

interface Props {
  datasetId: string;
}

export function SettingsPage({ datasetId }: Props) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<QuickQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    insightsService.getQuickQuestions(datasetId).then(qs => {
      if (!cancelled) setRows(qs);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [datasetId]);

  const update = (i: number, patch: Partial<QuickQuestion>) => {
    setSaved(false);
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const remove = (i: number) => {
    setSaved(false);
    setRows(rs => rs.filter((_, idx) => idx !== i));
  };
  const add = () => {
    setSaved(false);
    setRows(rs => [...rs, { icon: '✦', text: '', question: '' }]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const clean = await insightsService.setQuickQuestions(datasetId, rows);
      setRows(clean);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <div className={styles.title}>{t('intel.settings.title')}</div>
      </div>
      <div className={styles.subtitle}>{t('intel.settings.subtitle')}</div>

      {loading ? (
        <div className={styles.empty}>…</div>
      ) : (
        <div className={styles.card}>
          {rows.length === 0 && <div className={styles.empty}>{t('intel.settings.empty')}</div>}
          {rows.length > 0 && (
            <div className={styles.headerLabels}>
              <span className={styles.iconCol}>{t('intel.settings.icon')}</span>
              <span className={styles.labelCol}>{t('intel.settings.label')}</span>
              <span className={styles.questionCol}>{t('intel.settings.question')}</span>
              <span className={styles.removeCol} />
            </div>
          )}
          <div className={styles.qqList}>
            {rows.map((r, i) => (
              <div className={styles.qqRow} key={i}>
                <input
                  className={styles.qqIconInput}
                  value={r.icon}
                  onChange={e => update(i, { icon: e.target.value })}
                  placeholder="🙂"
                />
                <input
                  className={styles.qqTextInput}
                  value={r.text || ''}
                  onChange={e => update(i, { text: e.target.value })}
                  placeholder={t('intel.settings.label')}
                />
                <input
                  className={styles.qqQuestionInput}
                  value={r.question || ''}
                  onChange={e => update(i, { question: e.target.value })}
                  placeholder={t('intel.settings.question')}
                />
                <button className={styles.removeBtn} onClick={() => remove(i)} aria-label={t('intel.settings.remove')}>✕</button>
              </div>
            ))}
          </div>
          <div className={styles.actionsRow}>
            <button className={styles.addBtn} onClick={add}>{t('intel.settings.add')}</button>
            <div className={styles.saveGroup}>
              {saved && <span className={styles.savedNote}>{t('intel.settings.saved')}</span>}
              <button className={styles.saveBtn} onClick={save} disabled={saving}>
                {saving ? t('intel.settings.saving') : t('intel.settings.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
