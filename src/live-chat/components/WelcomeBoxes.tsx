import type { Dict, Lang } from '../i18n';
import { DEFAULT_QUESTIONS, type QuickQuestion } from '../liveConfig';

interface Props {
  t: Dict;
  lang: Lang;
  /** Optional author-configured questions; falls back to the defaults. */
  questions?: QuickQuestion[];
  onPick: (text: string) => void;
}

/** Shown when there's no conversation yet — a grid of starter questions.
 *  (The builder will eventually let authors configure these per-agent.) */
export function WelcomeBoxes({ t, lang, questions, onPick }: Props) {
  const list = questions && questions.length > 0 ? questions : DEFAULT_QUESTIONS;
  return (
    <div className="welcome">
      <h3 className="welcome-title">{t.quickTitle}</h3>
      <div className="welcome-grid">
        {list.map((q, i) => (
          <button key={i} className="quick-box" onClick={() => onPick(q.text[lang])}>
            <span className="quick-ic">{q.icon}</span>
            <span className="quick-tx" dir="auto">{q.text[lang]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
