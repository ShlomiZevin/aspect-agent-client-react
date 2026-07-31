import type { ReactNode } from 'react';
import type { Dict, Lang } from '../i18n';
import { DEFAULT_QUESTIONS, type QuickQuestion } from '../liveConfig';

interface Props {
  t: Dict;
  lang: Lang;
  /** Optional author-configured questions; falls back to the defaults. */
  questions?: QuickQuestion[];
  /** The centred composer card (Noa pulls the composer up into the welcome). */
  composer?: ReactNode;
  onPick: (text: string) => void;
}

/**
 * Empty-state welcome (Noa design): an intro line beside a small round brand
 * mark ("I run a conversation, not a form"), the composer as a centred card,
 * then the starter questions as quiet outline pills below it.
 */
export function WelcomeBoxes({ t, lang, questions, composer, onPick }: Props) {
  const list = questions && questions.length > 0 ? questions : DEFAULT_QUESTIONS;
  return (
    <div className="welcome">
      <div className="welcome-intro">
        <span className="welcome-mark"><img src="/img/lybi-spiral.png" alt="" /></span>
        <span className="welcome-intro-tx" dir="auto">{t.welcomeIntro}</span>
      </div>

      {composer && <div className="welcome-composer">{composer}</div>}

      <div className="welcome-pills">
        {list.map((q, i) => (
          <button key={i} className="welcome-pill" onClick={() => onPick(q.text[lang])} dir="auto">
            {q.text[lang]}
          </button>
        ))}
      </div>
    </div>
  );
}
