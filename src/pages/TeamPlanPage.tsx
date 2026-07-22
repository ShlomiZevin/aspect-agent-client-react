import { useEffect, useRef, useState } from 'react';
import s from './TeamPlanPage.module.css';

// Loads a Hebrew webfont (Assistant) once, mirroring the intelligence/fonts.ts
// pattern — keeps the page's Hebrew typography crisp without touching global CSS.
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap';
function ensureFonts() {
  if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

const MODE_KEY = 'aspect_team_plan_mode';

interface Role {
  initial: string; name: string; title: string; color: string;
  cost: string; per: string; note: string; goal: string; gold?: boolean;
}

const ROLES: Role[] = [
  {
    initial: 'S', name: 'Shlomi', title: 'CTO as a Service · הובלה', color: 'var(--seg-shlomi)',
    cost: '30,000', per: '/ חודש · לפני עלויות מודלים וענן',
    note: 'מוביל את הצוות, הארכיטקטורה וכיוון המוצר, ונשאר האחריות המקצועית הכוללת של הפעילות.',
    goal: 'יעד: כל התמונה',
  },
  {
    initial: 'K', name: 'Kosta', title: 'פיתוח · טעינת נתונים וערוצים', color: 'var(--seg-kosta)',
    cost: '≈ 20,000', per: '/ חודש',
    note: 'הופך את טעינת הנתונים לאוטומטית, אמינה ועמידה — כדי שנוכל לצרף עוד ועוד לקוחות בלי שהכל יישבר.',
    goal: 'יעד: צירוף לקוחות בקנה מידה',
  },
  {
    initial: 'V', name: 'Vova', title: 'פיתוח · מוצר ה-AI הבא', color: 'var(--seg-vova)',
    cost: '≈ 20,000', per: '/ חודש',
    note: 'בונה את המנוע של המוצר החדש: משימות שרצות אוטומטית ע״י מודלים — הכנה, שאילתות ואפילו סקריפטים.',
    goal: 'יעד: המוצר מהדור הבא',
  },
  {
    initial: 'O', name: 'Ofir', title: 'דאטה סיינס · מחקר ומודלים', color: 'var(--seg-ofir)',
    cost: '20,000', per: '/ חודש · תמורה נמוכה במיוחד',
    note: 'מוקדשת במאה אחוז למחקר: מריצה מודלים שמוצאים את התובנות עצמן, ומכינה סקריפטים למוצר ה-BI.',
    goal: 'יעד: התובנות שמוכרות', gold: true,
  },
];

const MONTHS = [
  { idx: 'חודש 01', title: 'לייצב ולחזק את הטעינה', desc: 'להפוך את צירוף הלקוחות לאמין וניתן לחזרה. Kosta נכנס לעניינים, והלקוחות הקיימים יציבים לגמרי.' },
  { idx: 'חודש 02', title: 'יסודות המוצר + תחילת מחקר', desc: 'Vova בונה את מנוע התובנות הגנרטיבי. Ofir מתחילה להריץ מודלים ראשונים על דאטה אמיתי.' },
  { idx: 'חודש 03', title: 'תובנות אוטומטיות ראשונות בשטח', desc: 'לקוחות פיילוט מקבלים תובנות שנוצרות אוטומטית. מצרפים מכה של לקוחות חדשים מקצה לקצה — להוכיח שהמכונה עובדת.' },
];

const ALIGN = [
  { goal: 'מוח משותף מהרבה עסקים קטנים', deliver: 'מנוע ה-AI של Vova + המודלים של Ofir' },
  { goal: 'לצרף הרבה לקוחות בלי שהכל יישבר', deliver: 'תהליך הטעינה האמין של Kosta' },
  { goal: 'תובנות אמיתיות שמוכרות', deliver: 'המחקר והדאטה סיינס של Ofir' },
  { goal: 'מוצר מהדור הבא — לא רק דשבורד', deliver: 'הובלת המוצר של Shlomi + הצוות' },
];

export function TeamPlanPage() {
  const [mode, setMode] = useState<'light' | 'dark'>(
    () => (localStorage.getItem(MODE_KEY) as 'light' | 'dark') || 'light'
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Aspect — תוכנית צוות ותקציב';
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
    ensureFonts();
    return () => { document.documentElement.dir = 'ltr'; };
  }, []);

  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);

  // Scroll-reveal — only enabled when motion is allowed; content is visible by
  // default so nothing hides if the observer never runs.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return;
    el.classList.add(s.animOn);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add(s.in); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    el.querySelectorAll(`.${s.reveal}`).forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <div className={s.page} data-mode={mode} ref={rootRef}>

      <div className={s.topbar}>
        <div className={`${s.wrap} ${s.topbarIn}`}>
          <div className={s.brand}>
            <div className={s.brandMark}>A</div>
            <div>
              <div className={s.brandName}>Aspect</div>
              <div className={s.brandSub}>בינה עסקית לעסקים קטנים</div>
            </div>
          </div>
          <div className={s.topRight}>
            <span className={s.chipInternal}>מסמך פנימי · לדיון</span>
            <button
              className={s.themeBtn}
              onClick={() => setMode(m => (m === 'dark' ? 'light' : 'dark'))}
              title="החלפת מצב תצוגה" aria-label="החלפת מצב בהיר/כהה"
            >
              {mode === 'dark' ? <SunGlyph /> : <MoonGlyph />}
            </button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <header className={s.hero}>
        <div className={s.heroBg} />
        <div className={s.heroGlow} />
        <div className={`${s.wrap} ${s.heroIn}`}>
          <div className={s.eyebrow}>תוכנית צוות ותקציב · Q1–Q3</div>
          <h1 className={s.h1}>צוות קטן ומנוהל — <span className={s.accent}>לתפעול, מוצר ומחקר במקביל</span></h1>
          <p className={s.heroLead}>
            היום כל הפעילות נשענת על אדם אחד. כדי לתת שירות אמין להרבה לקוחות, לבנות את מוצר
            ה-AI הבא, וגם להריץ מחקר — צריך עוד ידיים, שאני מנהל. המסמך מסביר <strong>מי, למה,
            כמה, ולפי איזו תוכנית</strong>. כל שקל מחובר ליעד של המשקיעים.
          </p>

          <div className={s.stats}>
            <div className={s.stat}>
              <div className={`${s.statNum} ${s.num}`}>≈ 90,000<span className={s.cur}>₪</span></div>
              <div className={s.statLabel}>קצב שריפה חודשי — כוח אדם</div>
            </div>
            <div className={s.stat}>
              <div className={s.statNum}>4</div>
              <div className={s.statLabel}>אנשים — צוות רזה, מנוהל על ידי Shlomi</div>
            </div>
            <div className={s.stat}>
              <div className={s.statNum}>רוב ההוצאה גמישה</div>
              <div className={s.statLabel}>אפשר להגדיל או לעצור לפי העומס</div>
            </div>
          </div>
        </div>
      </header>

      {/* SITUATION TODAY */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.split}>
            <div>
              <div className={s.eyebrow}>נקודת הפתיחה</div>
              <h2 className={s.h2}>המצב היום: הכל על אדם אחד</h2>
              <p className={s.lead}>
                טעינת נתונים, מוצר, תשתית ותמיכה — הכל יושב כרגע על Shlomi בלבד. זה עובד,
                ואפילו טוב. אבל זו נקודת כשל יחידה, וזו גם התקרה של כמה אפשר לגדול.
              </p>
              <p className={s.bodyMax}>
                אם רוצים לצרף עשרות לקוחות, לבנות מוצר חדש, <strong>וגם להריץ מחקר</strong> — במקביל —
                יד אחת פשוט לא מספיקה. לא כדי להחליף אותי, אלא כדי שאני <strong>אנהל</strong> צוות
                שמבצע, כך שנרוץ מהר ובבטחה בו-זמנית.
              </p>
            </div>
            <div className={s.callout}>
              <div className={`${s.calloutTop} ${s.calloutGold}`}>
                <div className="k">1</div>
                <div className="t">כל הפעילות — על אדם אחד</div>
              </div>
              <div className={s.calloutBody}>
                טעינת נתונים · מוצר · תשתית · תמיכה — <strong>הכל תלוי באדם יחיד.</strong>{' '}
                כל עוד זה כך, כל צירוף לקוח חדש וכל פיתוח מתחרים על אותן שעות.
              </div>
            </div>
          </div>

          <div className={s.research}>
            <div className={s.researchIco}>🔬</div>
            <div>
              <h3>ומחקר הוא סיפור בפני עצמו</h3>
              <p>
                מחקר הוא <strong>ניסוי וטעייה</strong>: חלק גדול מהניסיונות לא יעבדו — וזה בסדר,
                ככה בדיוק מגיעים לתובנות שמייצרות ערך. בגלל זה הוא דורש מישהו שמוקדש לו
                <strong> במאה אחוז</strong>, לא ״בין לבין״ בין משימות פיתוח. זה בדיוק התפקיד של הדאטה סיינס.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ORG — two disciplines */}
      <section style={{ background: 'var(--surface-2)' }}>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div style={{ textAlign: 'center', maxWidth: '56ch', marginInline: 'auto' }}>
            <div className={`${s.eyebrow} ${s.eyebrowCenter}`}>מבנה הצוות</div>
            <h2 className={s.h2}>שתי דיסציפלינות, תחת ניהול אחד</h2>
            <p className={s.lead} style={{ marginInline: 'auto' }}>
              Shlomi מוביל ומנהל. מתחתיו הצוות מחולק לשניים: פיתוח, ודאטה סיינס.
            </p>
          </div>

          <div className={s.org}>
            <div className={s.orgLead}>
              <div className="role">Shlomi · CTO</div>
              <div className="sub">מוביל, מנהל, ואחראי מקצועית</div>
            </div>
            <div className={s.orgBranches}>
              <div className={s.orgGroup}>
                <div className={s.groupLabel}>פיתוח</div>
                <div className={s.orgMembers}>
                  <div className={s.orgNode}><div className="who">Kosta</div><div className="what">טעינת נתונים וערוצים</div></div>
                  <div className={s.orgNode}><div className="who">Vova</div><div className="what">מוצר ה-AI הבא</div></div>
                </div>
              </div>
              <div className={`${s.orgGroup} ${s.gold}`}>
                <div className={s.groupLabel}>דאטה סיינס</div>
                <div className={s.orgMembers}>
                  <div className={s.orgNode}><div className="who">Ofir</div><div className="what">מחקר ומודלים</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TEAM & COST */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>הצוות והעלות</div>
          <h2 className={s.h2}>מי עושה מה — וכמה זה עולה</h2>
          <p className={s.lead}>כל תפקיד פותח יכולת אחת שחסרה לנו היום כדי לגדול.</p>

          <div className={s.roles}>
            {ROLES.map(r => (
              <div key={r.name} className={`${s.role} ${r.gold ? s.gold : ''}`}>
                <span className={s.roleBar} style={{ background: r.color }} />
                <div className={s.roleHead}>
                  <div className={s.avatar} style={{ background: `linear-gradient(145deg, ${r.color}, color-mix(in srgb, ${r.color} 62%, #000))` }}>
                    {r.initial}
                  </div>
                  <div>
                    <div className={s.roleName}>{r.name}</div>
                    <div className={s.roleTitle}>{r.title}</div>
                  </div>
                </div>
                <div className={s.roleCost}>
                  <span className={`${s.amt} ${s.num}`}>{r.cost}<span className={s.cur}>₪</span></span>
                  <span className={s.per}>{r.per}</span>
                </div>
                <p className={s.roleNote}>{r.note}</p>
                <span className={s.roleGoal}>{r.goal}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW WE STAY LEAN — tooling + no QA */}
      <section style={{ background: 'var(--surface-2)' }}>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>איך נשארים רזים</div>
          <h2 className={s.h2}>כלים שמכפילים תפוקה — ולמה אין QA</h2>
          <p className={s.lead}>הצוות קטן במכוון. הנה מה שמאפשר לו לספק כמו צוות גדול בהרבה.</p>

          <div className={s.leanGrid}>
            <div className={s.leanCard}>
              <div className={s.leanHd}>
                <div className={s.leanIco}>⌘</div>
                <h3>כולם עובדים עם Claude Code</h3>
              </div>
              <p>
                כל אנשי הצוות עובדים עם <strong>Claude Code</strong> — מנוי חודשי של כ-<strong>$100 לאדם</strong>,
                שנותן לצרכים שלנו שימוש כמעט אינסופי בטוקנים. עלות זניחה מול המשכורות, שמכפילה את
                מה שכל אחד מספיק לעשות. בהמשך נבחן מנוי אחר לפי הצורך.
              </p>
              <span className={s.leanTag}>~$100 לאדם / חודש · תפוקה × כמה מונים</span>
            </div>
            <div className={s.leanCard}>
              <div className={s.leanHd}>
                <div className={s.leanIco}>✓</div>
                <h3>אין תפקיד QA נפרד</h3>
              </div>
              <p>
                עם Claude Code עבודת המפתח הופכת <strong>ניהולית</strong>: לוודא שמה שמוסרים ל-Claude
                מבוצע נכון — גם ברמת הקוד וגם ברמת המוצר. הבקרה הזו מוטמעת בתוך העבודה עצמה,
                ולכן אין צורך בשלב או בתפקיד QA נפרד.
              </p>
              <span className={s.leanTag}>בקרה מוטמעת — לא עוד משרה</span>
            </div>
          </div>
        </div>
      </section>

      {/* BURN */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>קצב השריפה</div>
          <h2 className={s.h2}>כמה זה עולה בחודש</h2>

          <div className={s.burnHero}>
            <div className={`${s.burnNum} ${s.num}`}><span className={s.approx}>≈</span>90,000<span className={s.cur}>₪</span></div>
            <div className={s.burnPer}>לחודש · כוח אדם בלבד</div>
          </div>

          <div className={s.bar} role="img" aria-label="פירוק קצב השריפה החודשי לפי אנשי הצוות">
            <span style={{ width: '33.3%', background: 'var(--seg-shlomi)' }} />
            <span style={{ width: '22.2%', background: 'var(--seg-kosta)' }} />
            <span style={{ width: '22.2%', background: 'var(--seg-vova)' }} />
            <span style={{ width: '22.2%', background: 'var(--seg-ofir)' }} />
          </div>
          <div className={s.legend}>
            <div className={s.legendItem}><span className={s.dot} style={{ background: 'var(--seg-shlomi)' }} /><b>Shlomi</b> · 30,000 ₪</div>
            <div className={s.legendItem}><span className={s.dot} style={{ background: 'var(--seg-kosta)' }} /><b>Kosta</b> · ≈ 20,000 ₪</div>
            <div className={s.legendItem}><span className={s.dot} style={{ background: 'var(--seg-vova)' }} /><b>Vova</b> · ≈ 20,000 ₪</div>
            <div className={s.legendItem}><span className={s.dot} style={{ background: 'var(--seg-ofir)' }} /><b>Ofir</b> · 20,000 ₪</div>
          </div>

          <div className={s.burnNote}>
            <strong>עלויות התשתית (מודלים + ענן) הן בנפרד</strong> — לפי צריכה בפועל ובשקיפות מלאה.
            היום הן ״מוסתרות״ בתוך התשלום החודשי שלי; בתוכנית הזו הן גלויות וברורות, כך שרואים
            בדיוק לאן הולך כל שקל. (מנויי Claude Code — כ-$100 לאדם — זניחים ונכללים בתשתית.)
          </div>
          <div className={s.burnTag}>זה קצב שריפה חודשי — לא התחייבות שנתית. הצוות גדל או מתכווץ לפי הקצב שנכתיב.</div>
        </div>
      </section>

      {/* FLEXIBILITY */}
      <section style={{ background: 'var(--surface-2)' }}>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>שליטה בהוצאה</div>
          <h2 className={s.h2}>רוב הכסף גמיש — לא נעול</h2>
          <p className={s.lead}>מבנה שמאפשר להאיץ כשצריך, ולהאט בלי כאב אם צריך.</p>

          <div className={s.flexGrid}>
            <div className={`${s.flexCol} ${s.flexGreen}`}>
              <div className={s.flexHd}>
                <div className={s.flexIco}>↕</div>
                <div>
                  <h3>גמיש</h3>
                  <div className={s.tiny}>ניתן לעצור מיידית — ללא הודעה מוקדמת</div>
                </div>
              </div>
              <div className={s.flexWho}>
                <span className={s.pill}>Kosta</span>
                <span className={s.pill}>Vova</span>
              </div>
              <p>פרילנסרים שאני עובד איתם שנים — אמינים לחלוטין. אפשר להאיץ, להאט או לעצור בכל רגע, בלי הודעה מוקדמת ובלי פיצויים. ההוצאה נצמדת בדיוק לעומס בפועל.</p>
            </div>
            <div className={`${s.flexCol} ${s.flexGold}`}>
              <div className={s.flexHd}>
                <div className={s.flexIco}>★</div>
                <div>
                  <h3>מחויבות</h3>
                  <div className={s.tiny}>עובדת — הודעה מוקדמת רגילה</div>
                </div>
              </div>
              <div className={s.flexWho}>
                <span className={s.pill}>Ofir</span>
              </div>
              <p>עובדת שכירה (מהמשרד / היברידי). ההתחייבות היחידה בתוכנית — ותמורה יוצאת דופן: מוסמכת/דוקטורנטית בדאטה סיינס שרוצה דריסת רגל בשוק, בעלות נמוכה במיוחד.</p>
            </div>
          </div>
          <div className={s.flexBottom}><span className={s.g}>מינוף גבוה</span> · <span className={s.y}>נעילה נמוכה</span></div>
        </div>
      </section>

      {/* QUARTER PLAN */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>התוכנית</div>
          <h2 className={s.h2}>רבעון ראשון מפורט — שניים הבאים בקווים כלליים</h2>
          <p className={s.planNote}>
            זו תוכנית עבודה — כיוון להתקדם לפיו. בעולם של טכנולוגיה דברים זזים ומתפתחים,
            אז זה ״מחויב״ במובן של כיוון וקצב, לא חקוק באבן.
          </p>

          <div className={s.qLabel}>
            <span className={s.tag}>רבעון 1</span>
            <span className={s.qTxt}>לבנות בסיס יציב — ולהוכיח שהמכונה עובדת</span>
          </div>
          <div className={s.months}>
            {MONTHS.map(m => (
              <div key={m.idx} className={s.month}>
                <div className={s.idx}>{m.idx}</div>
                <div className={s.mtitle}>{m.title}</div>
                <div className={s.mdesc}>{m.desc}</div>
              </div>
            ))}
          </div>

          <div className={s.qSoft}>
            <div className={s.qcard}>
              <div className={s.qLabel} style={{ margin: '0 0 4px' }}><span className={`${s.tag} ${s.tagSoft}`}>רבעון 2</span></div>
              <div className={s.qt}>קנה מידה</div>
              <p>צירוף אוטומטי של הרבה יותר לקוחות; המוצר מתרחב לעוד סוגי דאטה; ספריית התובנות גדלה ומשתכללת.</p>
            </div>
            <div className={s.qcard}>
              <div className={s.qLabel} style={{ margin: '0 0 4px' }}><span className={`${s.tag} ${s.tagSoft}`}>רבעון 3</span></div>
              <div className={s.qt}>המוח המשותף</div>
              <p>בינה חוצת-לקוחות: השוואות (benchmarks) על פני כל ה-Long Tail, שירות עצמי, ואריזה מסחרית למכירה.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ALIGNMENT — deliverables vs goals */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>התאמה ליעד</div>
          <h2 className={s.h2}>מה הצוות מספק — מול היעדים של המשקיעים</h2>

          <div className={s.alignList}>
            {ALIGN.map(a => (
              <div key={a.goal} className={s.alignRow}>
                <div className={s.alignGoal}><span className={s.mini}>יעד המשקיעים</span>{a.goal}</div>
                <div className={s.alignArrow}>←</div>
                <div className={s.alignDo}><span className={s.mini}>מה הצוות מספק</span>{a.deliver}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section style={{ paddingTop: 0 }}>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.closing}>
            <div className={s.eyebrow}>הבקשה</div>
            <h2>לאשר את תוכנית הצוות והתקציב החודשי</h2>
            <p>
              כדי לעבור מ״אדם אחד שמחזיק את הכל״ לצוות מנוהל שמריץ תפעול, מוצר ומחקר במקביל.
              זה מה שצריך כדי לממש את מה שהמשקיעים קנו: מוח משותף שמשרת את ה-Long Tail — באמינות, ובקצב.
            </p>
            <div className={s.sign}>— Shlomi <span className="r">· CTO, Aspect</span></div>
          </div>
        </div>
      </section>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footerIn}`}>
          <span>Aspect · בינה עסקית לעסקים קטנים</span>
          <span>מסמך פנימי — לדיון בלבד</span>
        </div>
      </footer>

    </div>
  );
}

function SunGlyph() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}
function MoonGlyph() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
}
