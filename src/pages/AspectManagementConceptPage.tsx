import { useCallback, useEffect, useRef, useState } from 'react';
import { PageCommentsProvider, SectionComments, type CommentTokens } from '../components/common';
import { getBaseURL } from '../services/api';
import styles from './AspectManagementConceptPage.module.css';

/**
 * Aspect Management — הצעות קונספט למסכים.
 *
 * A concepts report, not a spec: for each screen of the system Itzik asked
 * for, two genuinely different design directions, generated as real
 * interfaces, with one question under each pair — which direction, and what
 * to change. His own written spec is NOT reproduced here; he wrote it through
 * an AI and what he actually needs to react to is what the thing looks like.
 *
 * The choice and the notes ride on the existing page-comments API rather than
 * a new endpoint: the client can be deployed on its own, the server cannot, so
 * a new route would mean this page could not ship. A choice is stored as a
 * comment under a `prio-<screen>` id — SectionComments only ever lists its own
 * section's id, so a choice never shows up inside the notes beside it.
 */

const PAGE_KEY = 'aspect-management';
/** The id a choice is stored under. A HYPHEN, not a colon: the server
 *  validates ids against /^[a-z0-9][a-z0-9-]{0,99}$/ and refuses the rest. */
const PRIO_PREFIX = 'prio-';
const NAME_KEY = 'aspect_page_comment_author';
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap';

function ensureFonts() {
  if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

const COMMENT_TOKENS: CommentTokens = {
  border: '#e3e3f0',
  text: '#141427',
  faint: '#76769a',
  paper: '#ffffff',
  paperBorder: '#e3e3f0',
  noteAccent: '#4f46e5',
  font: "'Assistant', ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif",
  dir: 'rtl',
  strings: {
    one: 'הערה אחת',
    many: '{n} הערות',
    hide: 'סגירת ההערות',
    add: 'מה לשנות כאן?',
    name: 'השם שלך',
    placeholder: 'מה חסר, מה מיותר, ומה צריך להיראות אחרת',
    send: 'שליחה',
    sending: 'שולח…',
    cancel: 'ביטול',
    remove: 'מחיקה',
    removeTitle: 'מחיקת הערה',
    removeConfirm: 'ההערה תימחק לכולם. אי אפשר לשחזר.',
    failed: 'השמירה נכשלה. נסו שוב.',
    loading: 'טוען…',
  },
};

/** Which design language was chosen: the id of one of the three. */
type ChoiceId = string;
const VALID_CHOICES = ['calm', 'cards', 'talk'];

interface StoredChoice { value: ChoiceId; author: string }

function useChoices() {
  const base = getBaseURL();
  const [chosen, setChosen] = useState<Record<string, StoredChoice>>({});
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${base}/api/page-comments/${PAGE_KEY}`)
      .then(r => (r.ok ? r.json() : { comments: [] }))
      .then(d => {
        if (cancelled) return;
        const map: Record<string, StoredChoice> = {};
        for (const c of Array.isArray(d.comments) ? d.comments : []) {
          if (typeof c.sectionId !== 'string' || !c.sectionId.startsWith(PRIO_PREFIX)) continue;
          const value = String(c.body || '').trim() as ChoiceId;
          if (!VALID_CHOICES.includes(value)) continue;
          // Last writer wins: the list arrives oldest first.
          map[c.sectionId.slice(PRIO_PREFIX.length)] = { value, author: String(c.author || '') };
        }
        setChosen(map);
      })
      .catch(() => { /* the concepts still read without the marks */ });
    return () => { cancelled = true; };
  }, [base]);

  const choose = useCallback(async (screenId: string, value: ChoiceId, author: string) => {
    const previous = chosenRef.current[screenId];
    setChosen(prev => ({ ...prev, [screenId]: { value, author } }));
    setFailed(false);
    try {
      const res = await fetch(`${base}/api/page-comments/${PAGE_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: `${PRIO_PREFIX}${screenId}`, author, body: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      // A choice that was never stored must not sit there looking saved.
      setChosen(prev => {
        const next = { ...prev };
        if (previous) next[screenId] = previous; else delete next[screenId];
        return next;
      });
      setFailed(true);
    }
  }, [base]);

  return { chosen, choose, failed };
}

interface DirectionDef {
  id: string;
  letter: string;
  name: string;
  idea: string;
  what: string;
  shots: { img: string; caption: string }[];
}

/**
 * Three design LANGUAGES for the whole system, not seven screens to judge one
 * by one. Each is shown on the same two screens — the owner's daily view and
 * the developer's reporting — so they can be compared like for like, and the
 * reader makes ONE choice at the end.
 */
const DIRECTIONS: DirectionDef[] = [
  {
    id: 'calm',
    letter: 'א',
    name: 'שקט',
    idea: 'מסך אחד אומר לך דבר אחד.',
    what: 'המערכת עונה על השאלה החשובה — "הכל בסדר היום?" — במשפט גדול אחד, ומתחתיו ארבעה מספרים. כל השאר מחכה מאחורה עד שתבקש אותו.',
    shots: [
      { img: 'dir_calm_owner.jpg', caption: 'המסך שלך בבוקר' },
      { img: 'dir_calm_dev.jpg', caption: 'הדיווח של המפתח' },
    ],
  },
  {
    id: 'cards',
    letter: 'ב',
    name: 'כרטיסים',
    idea: 'כמה כרטיסים גדולים, בכל אחד נושא אחד ומה לעשות איתו.',
    what: 'חריגה בתקציב, לקוחות שמחכים, הצעות שיצאו — כל נושא הוא כרטיס עם מספר אחד וכפתור אחד. בלי טבלאות, בלי תפריטים עמוקים.',
    shots: [
      { img: 'dir_cards_owner.jpg', caption: 'המסך שלך בבוקר' },
      { img: 'dir_cards_dev.jpg', caption: 'הדיווח של המפתח' },
    ],
  },
  {
    id: 'talk',
    letter: 'ג',
    name: 'המערכת מדברת',
    idea: 'משפטים קצרים במקום טבלאות.',
    what: 'המערכת מספרת לך מה קרה אתמול ומה צריך החלטה, בשורות קצרות עם המספרים בתוך המשפט — כמו עוזר אישי שמעדכן אותך בבוקר.',
    shots: [
      { img: 'dir_talk_owner.jpg', caption: 'המסך שלך בבוקר' },
      { img: 'dir_talk_dev.jpg', caption: 'הדיווח של המפתח' },
    ],
  },
];

function Direction({ def, chosen }: {
  def: DirectionDef;
  chosen: Record<string, StoredChoice>;
}) {
  const picked = chosen.direction?.value === def.id;
  return (
    <section className={`${styles.section} ${picked ? styles.sectionChosen : ''}`} id={def.id}>
      <div className={styles.sectionHead}>
        <span className={styles.num}>{def.letter}</span>
        <h2 className={styles.h2}>{def.name}</h2>
      </div>
      <p className={styles.idea}>{def.idea}</p>
      <p className={styles.lead}>{def.what}</p>

      <div className={styles.concepts}>
        {def.shots.map(shot => (
          <figure key={shot.img} className={styles.concept}>
            <figcaption className={styles.conceptHead}>
              <span className={styles.conceptCaption}>{shot.caption}</span>
            </figcaption>
            {/* Opens full size in a new tab — the point is the screen itself. */}
            <a href={`/aspect-management/${shot.img}`} target="_blank" rel="noreferrer">
              <img src={`/aspect-management/${shot.img}`} alt={`${def.name} — ${shot.caption}`} loading="lazy" />
            </a>
          </figure>
        ))}
      </div>

      <div className={styles.notes}>
        <SectionComments sectionId={def.id} />
      </div>
    </section>
  );
}

export function AspectManagementConceptPage() {
  useEffect(() => {
    ensureFonts();
    document.title = 'Aspect Management — הצעות קונספט';

    // The app's global CSS pins html, body and #root to height:100% with
    // overflow:hidden — right for the chat, fatal for a document: the page
    // rendered in full and simply would not scroll. Released while this page
    // is open and put back exactly as it was on the way out.
    const root = document.getElementById('root');
    const prev = {
      html: document.documentElement.style.cssText,
      body: document.body.style.cssText,
      root: root?.style.cssText ?? '',
    };
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.body.style.background = '#f6f7fb';
    if (root) {
      root.style.overflow = 'visible';
      root.style.height = 'auto';
      root.style.display = 'block';
    }
    return () => {
      document.documentElement.style.cssText = prev.html;
      document.body.style.cssText = prev.body;
      if (root) root.style.cssText = prev.root;
    };
  }, []);

  const { chosen, choose, failed } = useChoices();
  const picked = chosen.direction;
  const pickedName = picked ? DIRECTIONS.find(d => d.id === picked.value)?.name : null;

  return (
    <PageCommentsProvider pageKey={PAGE_KEY} t={COMMENT_TOKENS}>
      <div className={styles.page}>
        <div className={styles.bar}>
          <span className={styles.barName}>Aspect Management · הצעת עיצוב</span>
          <nav className={styles.barNav}>
            {DIRECTIONS.map(d => (
              <a key={d.id} className={styles.barLink} href={`#${d.id}`}>{d.name}</a>
            ))}
            <a className={styles.barLink} href="#choose">הבחירה</a>
          </nav>
        </div>

        <header className={styles.hero}>
          <h1 className={styles.h1}>שלוש דרכים שבהן המערכת יכולה להיראות</h1>
          <p className={styles.lede}>
            אותה מערכת, שלוש שפות עיצוב. כל אחת מוצגת על אותם שני מסכים: מה אתה רואה בבוקר,
            ואיך מפתח מדווח בסוף היום. תבחר אחת למטה — זו שנבחר תהיה השפה של כל המערכת.
          </p>
          <p className={styles.note}>
            השמות והמספרים בתמונות הם דוגמה בלבד. לחיצה על תמונה פותחת אותה בגדול.
          </p>
          {failed && <p className={styles.saveFailed}>הבחירה לא נשמרה. בדקו את החיבור ונסו שוב.</p>}
        </header>

        {DIRECTIONS.map(def => <Direction key={def.id} def={def} chosen={chosen} />)}

        <div className={styles.closing} id="choose">
          <div className={styles.closingCard}>
            <h2 className={styles.closingTitle}>איזו מהשלוש?</h2>
            <p className={styles.lead}>
              {pickedName
                ? `נבחר: ${pickedName}. אפשר לשנות בכל רגע, ולכתוב למטה מה להתאים.`
                : 'בחר אחת, וכתוב למטה אם משהו צריך להיות אחרת.'}
            </p>
            <DirectionChoice chosen={chosen} choose={choose} />
            <div className={styles.notes}>
              <SectionComments sectionId="closing" />
            </div>
          </div>
        </div>
      </div>
    </PageCommentsProvider>
  );
}

/** The one question the page asks: which of the three. */
function DirectionChoice({ chosen, choose }: {
  chosen: Record<string, StoredChoice>;
  choose: (screenId: string, value: ChoiceId, author: string) => void;
}) {
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  });
  const current = chosen.direction;

  const pick = (value: string) => {
    const who = name.trim();
    if (!who) return;
    try { localStorage.setItem(NAME_KEY, who); } catch { /* private mode */ }
    choose('direction', value as ChoiceId, who);
  };

  return (
    <div className={styles.priority}>
      {!name.trim() && (
        <span className={styles.nameAsk}>
          <input
            className={styles.nameInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="השם שלך"
            aria-label="השם שלך"
          />
        </span>
      )}
      {DIRECTIONS.map(d => (
        <button
          key={d.id}
          type="button"
          className={`${styles.chip} ${styles.chipBig}`}
          aria-pressed={current?.value === d.id}
          onClick={() => pick(d.id)}
          disabled={!name.trim()}
          title={name.trim() ? undefined : 'כתבו קודם את השם'}
        >
          {d.letter}. {d.name}
        </button>
      ))}
      {current && <span className={styles.priorityWho}>נבחר על ידי {current.author}</span>}
    </div>
  );
}
