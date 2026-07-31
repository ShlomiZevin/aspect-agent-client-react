import type { InsightConfidenceCheck } from '../../../types/insights';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './ConfidencePanel.module.css';

export function ConfidencePanel({ score, basis, checks }: {
  score: number;
  basis: string;
  checks: InsightConfidenceCheck[];
}) {
  const { t } = useLanguage();
  const label = score >= 85 ? t('intel.confidence.high') : score >= 60 ? t('intel.confidence.medium') : t('intel.confidence.low');
  const r = 15.9;
  const circumference = 100;
  const dash = `${score / 100 * circumference} ${circumference}`;

  return (
    <div className={styles.card}>
      <div className={styles.title}>{t('intel.detail.confidence')}</div>
      <div className={styles.top}>
        <div className={styles.gaugeWrap}>
          <svg width={110} height={110} viewBox="0 0 42 42">
            <circle cx="21" cy="21" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" />
            {/* SVG circles start their path at 3 o'clock and trace clockwise
                by default — rotate -90deg around the center so 0% sits at 12
                o'clock, the way a progress ring is expected to read. */}
            <circle cx="21" cy="21" r={r} fill="none" stroke="url(#confgrad)" strokeWidth="5" strokeDasharray={dash} strokeLinecap="round" transform="rotate(-90 21 21)" />
            <defs>
              <linearGradient id="confgrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8B5CF6" />
                <stop offset="1" stopColor="#F0ABFC" />
              </linearGradient>
            </defs>
          </svg>
          <div className={styles.gaugeText}>
            <span className={styles.gaugeScore}>{score}%</span>
            <span className={styles.gaugeLabel}>{label}</span>
          </div>
        </div>
        <div className={styles.basis}>{basis}</div>
      </div>

      <div className={styles.checks}>
        {checks.map(c => (
          <div className={styles.check} key={c.text}>
            <span className={c.positive ? styles.checkPos : styles.checkNeg}>{c.positive ? '✓' : '!'}</span>
            <span className={styles.checkText}>{c.text}</span>
          </div>
        ))}
      </div>

      <div className={styles.footer}>{t('intel.detail.confidenceFooter')}</div>
    </div>
  );
}
