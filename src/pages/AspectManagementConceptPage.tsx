import { useCallback, useEffect, useRef, useState } from 'react';
import { PageCommentsProvider, SectionComments, type CommentTokens } from '../components/common';
import { getBaseURL } from '../services/api';
import styles from './AspectManagementConceptPage.module.css';

/**
 * Aspect Management — version 0 look & feel.
 *
 * Four looks for Itzik's management system, each shown on the SAME six
 * screens (his morning, a developer's hour report, a client, projects, quotes,
 * asking a question), so he compares looks, not features. One button per look
 * ("this one"), notes under each, one note box at the end. Kept radically
 * short: Itzik reads almost nothing — the screens do the talking.
 *
 * The looks were generated (GPT Image 2.5 flare / sunburst, LOW) from prompts
 * that state what each screen is for and what it holds, plus a design
 * direction per look — never a layout.
 *
 * The choice and the notes ride on the existing page-comments API rather than
 * a new endpoint: the client can be deployed on its own, the server cannot. A
 * choice is stored as a comment under the `prio-look` id; SectionComments only
 * lists its own section's id, so a choice never shows up among the notes.
 */

const PAGE_KEY = 'aspect-management';
/** The id the choice is stored under. A HYPHEN, not a colon: the server
 *  validates ids against /^[a-z0-9][a-z0-9-]{0,99}$/ and refuses the rest.
 *  A new id for this round — earlier rounds stored under `prio-direction`. */
const CHOICE_ID = 'prio-look';
const NAME_KEY = 'aspect_page_comment_author';
const IMG_DIR = '/aspect-management/look';
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
    add: 'מה לשנות?',
    name: 'השם שלך',
    placeholder: 'מה אהבת, מה לא',
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

/** The six screens, in the order every look shows them. */
const SCREENS = [
  { n: 1, name: 'הבוקר שלך' },
  { n: 2, name: 'מפתח מדווח שעות' },
  { n: 3, name: 'לקוח' },
  { n: 4, name: 'פרויקטים' },
  { n: 5, name: 'הצעות מחיר' },
  { n: 6, name: 'שואלים את המערכת' },
];

interface LookDef {
  id: string;
  letter: string;
  name: string;
  line: string;
}

const LOOKS: LookDef[] = [
  { id: 'room', letter: 'א', name: 'חדר מצב', line: 'רואים מיד מה דורש החלטה ומה עובד.' },
  { id: 'ledger', letter: 'ב', name: 'פנקס חכם', line: 'כל העבודה מסודרת במקום אחד שאי אפשר לפספס.' },
  { id: 'brief', letter: 'ג', name: 'המנהל השקט', line: 'המערכת אומרת רק מה חשוב, בשפה פשוטה.' },
  { id: 'route', letter: 'ד', name: 'על המסלול', line: 'כל לקוח ופרויקט מתקדם במסלול ברור.' },
];
const VALID = LOOKS.map(l => l.id);

interface StoredChoice { value: string; author: string }

function useChoice() {
  const base = getBaseURL();
  const [choice, setChoice] = useState<StoredChoice | null>(null);
  const choiceRef = useRef(choice);
  choiceRef.current = choice;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${base}/api/page-comments/${PAGE_KEY}`)
      .then(r => (r.ok ? r.json() : { comments: [] }))
      .then(d => {
        if (cancelled) return;
        let last: StoredChoice | null = null;
        // Last writer wins: the list arrives oldest first.
        for (const c of Array.isArray(d.comments) ? d.comments : []) {
          if (c.sectionId !== CHOICE_ID) continue;
          const value = String(c.body || '').trim();
          if (VALID.includes(value)) last = { value, author: String(c.author || '') };
        }
        setChoice(last);
      })
      .catch(() => { /* the looks still show without the mark */ });
    return () => { cancelled = true; };
  }, [base]);

  const choose = useCallback(async (value: string, author: string) => {
    const previous = choiceRef.current;
    setChoice({ value, author });
    setFailed(false);
    try {
      const res = await fetch(`${base}/api/page-comments/${PAGE_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: CHOICE_ID, author, body: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      // A choice that was never stored must not sit there looking saved.
      setChoice(previous);
      setFailed(true);
    }
  }, [base]);

  return { choice, choose, failed };
}

function Look({ def, picked, onPick, onOpen }: {
  def: LookDef;
  picked: StoredChoice | null;
  onPick: (value: string, author: string) => void;
  onOpen: (src: string, alt: string) => void;
}) {
  const isPicked = picked?.value === def.id;
  return (
    <section className={`${styles.look} ${isPicked ? styles.lookPicked : ''}`} id={def.id}>
      <div className={styles.lookHead}>
        <span className={styles.letter}>{def.letter}</span>
        <div>
          <h2 className={styles.lookName}>{def.name}</h2>
          <p className={styles.lookLine}>{def.line}</p>
        </div>
      </div>

      <div className={styles.screens}>
        {SCREENS.map(s => {
          const src = `${IMG_DIR}/${def.id}-${s.n}.jpg`;
          const alt = `${def.name} — ${s.name}`;
          return (
            <figure key={s.n} className={styles.screen}>
              <button type="button" className={styles.shot} onClick={() => onOpen(src, alt)} aria-label={`הגדלה: ${alt}`}>
                <img src={src} alt={alt} loading="lazy" />
              </button>
              <figcaption className={styles.screenName}>{s.name}</figcaption>
            </figure>
          );
        })}
      </div>

      <div className={styles.lookFoot}>
        <PickButton id={def.id} isPicked={isPicked} who={isPicked ? picked?.author : undefined} onPick={onPick} />
      </div>
      <div className={styles.notes}>
        <SectionComments sectionId={`look-${def.id}`} />
      </div>
    </section>
  );
}

/**
 * "This one". The choice needs a name; when none is known yet the first click
 * asks for it right there, instead of a button that silently does nothing.
 */
function PickButton({ id, isPicked, who, onPick }: {
  id: string;
  isPicked: boolean;
  who?: string;
  onPick: (value: string, author: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState('');

  const storedName = () => {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  };

  const click = () => {
    const known = storedName().trim();
    if (known) onPick(id, known);
    else setAsking(true);
  };

  const confirm = () => {
    const who = name.trim();
    if (!who) return;
    try { localStorage.setItem(NAME_KEY, who); } catch { /* private mode */ }
    setAsking(false);
    onPick(id, who);
  };

  if (asking) {
    return (
      <form className={styles.nameAsk} onSubmit={e => { e.preventDefault(); confirm(); }}>
        <input
          className={styles.nameInput}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="השם שלך"
          aria-label="השם שלך"
          autoFocus
        />
        <button type="submit" className={styles.pick} disabled={!name.trim()}>אישור</button>
      </form>
    );
  }

  return (
    <div className={styles.pickRow}>
      <button type="button" className={styles.pick} aria-pressed={isPicked} onClick={click}>
        {isPicked ? '✓ זה שבחרת' : 'זה מוצא חן בעיניי'}
      </button>
      {isPicked && who && <span className={styles.pickWho}>נבחר על ידי {who}</span>}
    </div>
  );
}

export function AspectManagementConceptPage() {
  useEffect(() => {
    ensureFonts();
    document.title = 'Aspect Management — איך המערכת תיראה';

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
    document.body.style.background = '#f4f4f1';
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

  const { choice, choose, failed } = useChoice();
  const [open, setOpen] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <PageCommentsProvider pageKey={PAGE_KEY} t={COMMENT_TOKENS}>
      <div className={styles.page}>
        <div className={styles.bar}>
          <span className={styles.barName}>Aspect Management</span>
          <nav className={styles.barNav}>
            {LOOKS.map(l => (
              <a key={l.id} className={styles.barLink} href={`#${l.id}`}>{l.letter}. {l.name}</a>
            ))}
          </nav>
        </div>

        <header className={styles.hero}>
          <h1 className={styles.h1}>איך המערכת שלך תיראה?</h1>
          <p className={styles.lede}>ארבעה סגנונות. אותם שישה מסכים. תבחר את מה שנעים לך.</p>
          <p className={styles.note}>השמות והמספרים — דוגמה. לחיצה על מסך מגדילה אותו.</p>
          {failed && <p className={styles.saveFailed}>הבחירה לא נשמרה. נסו שוב.</p>}
        </header>

        {LOOKS.map(def => (
          <Look key={def.id} def={def} picked={choice} onPick={choose} onOpen={(src, alt) => setOpen({ src, alt })} />
        ))}

        <div className={styles.closing}>
          <h2 className={styles.closingTitle}>משהו חסר? משהו מיותר?</h2>
          <div className={styles.notes}>
            <SectionComments sectionId="look-closing" />
          </div>
        </div>

        {open && (
          <div className={styles.lightbox} onClick={() => setOpen(null)} role="dialog" aria-label={open.alt}>
            <img src={open.src} alt={open.alt} />
            <button type="button" className={styles.lightboxClose} onClick={() => setOpen(null)} aria-label="סגירה">✕</button>
          </div>
        )}
      </div>
    </PageCommentsProvider>
  );
}
