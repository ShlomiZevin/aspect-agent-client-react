import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './AspectBattleCardPage.module.css';

/* ===== Aspect Platform — Digital Battle Card =====
 * Internal sales-enablement page at /aspect-marketing.
 * Bilingual (English / Hebrew) with a language switcher in the nav.
 */

type Lang = 'en' | 'he';

type Strings = {
  docTitle: string;
  brandName: string;
  brandSub: string;
  classified: string;
  nav: { objections: string; scenario: string; platform: string; cheat: string };
  hero: { line1: string; line2: string };
  sectionLabels: { obj: string; scenario: string; platform: string; cheat: string };
  obj1: {
    num: string;
    tag: string;
    question: ReactNode;
    answerKicker: string;
    headline: ReactNode;
    tpTitle: string;
    tp: ReactNode[];
    proofKicker: string;
    proofQuote: ReactNode;
    proofStats: { stat: ReactNode; label: string }[];
    footerLabel: string;
    footerText: ReactNode;
  };
  obj2: {
    num: string;
    tag: string;
    question: ReactNode;
    answerKicker: string;
    headline: ReactNode;
    tpTitle: string;
    tp: ReactNode[];
    proofKicker: string;
    proofQuote: ReactNode;
    proofStats: { stat: ReactNode; label: string }[];
    footerLabel: string;
    footerText: ReactNode;
  };
  scenario: {
    metaA: string;
    metaB: string;
    prompt: ReactNode;
    withoutLabel: string;
    withoutStatus: string;
    withoutSteps: { time: string; text: ReactNode }[];
    withoutCostLabel: string;
    withoutCostVal: string;
    withLabel: string;
    withStatus: string;
    withSteps: { time: string; text: ReactNode }[];
    withCostLabel: string;
    withCostVal: ReactNode;
    punchKicker: string;
    punchText: ReactNode;
  };
  platform: {
    lede: string;
    modules: { tag: string; name: string; desc: ReactNode }[];
    noteKicker: string;
    noteText: ReactNode;
  };
  cheat: {
    lines: { q: ReactNode; a: ReactNode }[];
  };
  closing: {
    kicker: string;
    title: ReactNode;
    body: ReactNode;
    primary: string;
    secondary: string;
  };
  footer: { brand: string; note: string; meta: string };
};

const EN: Strings = {
  docTitle: 'Aspect · Battle Card',
  brandName: 'Aspect',
  brandSub: 'Battle Card',
  classified: 'SALES ENABLEMENT · INTERNAL USE',
  nav: {
    objections: 'The Two Objections',
    scenario: 'Live Scenario',
    platform: 'Platform',
    cheat: 'Cheat Sheet',
  },
  hero: { line1: 'The Aspect Platform', line2: 'Battle Card' },
  sectionLabels: {
    obj: 'The Two Objections That Close The Deal',
    scenario: 'Live Scenario — Friday, 4:47 PM',
    platform: 'What’s actually under the hood',
    cheat: 'Cheat sheet — one-liners for the room',
  },
  obj1: {
    num: '01',
    tag: 'The “just buy Claude” objection',
    question: <>“Why do I need you when I can just get Claude and connect it to my database?”</>,
    answerKicker: 'Land this in 15 seconds',
    headline: <>Claude is an engine. It is not a vehicle. An engine bolted to a database without architecture is not a product — it is technical debt with a chat interface.</>,
    tpTitle: 'Talking points',
    tp: [
      <><strong>The “AI magic” myth.</strong> There is no prompt that safely connects an LLM to enterprise data. Schemas drift, joins explode, PII leaks, costs balloon. The hard part is everything that surrounds the model.</>,
      <><strong>We use Claude too.</strong> Aspect runs on Claude for the heavy lifting — including natural-language-to-SQL. We are not competing with the model. We are the production stack that makes the model safe to point at a real business.</>,
      <><strong>Build vs. buy math.</strong> An internal team can absolutely wire a chat box to Postgres in a weekend. Scaling that to 200 tables, real users, governance, latency budgets, and trustworthy answers is an 18-month rebuild — and most teams ship version one as unmaintainable tech debt.</>,
      <><strong>Aspect is the orchestration layer.</strong> Multi-agent routing, schema understanding, query planning, performance caching, audit, guardrails. Teams ship in weeks instead of quarters, and answers stay accurate as the business evolves.</>,
    ],
    proofKicker: 'Reframe in the room',
    proofQuote: <>“Sure — and you could also pour jet fuel into a sedan. The fuel is not the problem. We sell the airplane that knows how to use it without crashing into your data warehouse.”</>,
    proofStats: [
      { stat: <>10×</>, label: 'faster to first answer' },
      { stat: '0', label: 'prompts to maintain' },
      { stat: '~18 mo', label: 'internal rebuild avoided' },
    ],
    footerLabel: 'If they push back',
    footerText: <>Ask them: <em>“Who on your team owns the schema graph, the query optimizer, and the agent routing — today, in production?”</em> Silence is the answer. That silence is what Aspect is.</>,
  },
  obj2: {
    num: '02',
    tag: 'The “prove the ROI” objection',
    question: <>“How can I calculate or measure the exact profit your application will provide?”</>,
    answerKicker: 'Land this in 15 seconds',
    headline: <>Measure time-to-insight and the cost of the analyst hours you are <em>not</em> burning. Then add the value of the insights you would never have found at all.</>,
    tpTitle: 'Talking points',
    tp: [
      <><strong>Direct attribution is the wrong lens.</strong> Nobody can directly attribute a quarter of revenue to a single dashboard. That has never been the question for BI. It is not the question for AI either.</>,
      <><strong>Measure resource deflection.</strong> Every report Aspect answers on the fly is a ticket that did not go to BI, engineering, or data science. Most customers see 60–80% of routine ad-hoc requests resolved without filing a ticket.</>,
      <><strong>Measure time-to-insight.</strong> Five-day analyst turnaround becomes forty-five seconds. The CFO who can ask a question and get an answer in the same meeting makes different decisions than the CFO who has to wait until Tuesday.</>,
      <><strong>Measure inferred value.</strong> The multi-agent crew surfaces profit leaks, anomalies, and second-order patterns no one was looking for. You cannot pre-calculate the ROI on an insight you did not know existed — but you can absolutely book the savings once it does.</>,
    ],
    proofKicker: 'Reframe in the room',
    proofQuote: <>“If I asked you to ROI your BI team line by line, you couldn’t either — but you would never fire them. Aspect compounds that same team. The math is the same; the multiplier is bigger.”</>,
    proofStats: [
      { stat: '45s', label: 'vs. 5-day BI ticket' },
      { stat: '70%', label: 'fewer ad-hoc tickets' },
      { stat: <>∞</>, label: 'insights you’d never ask for' },
    ],
    footerLabel: 'If they push back',
    footerText: <>Offer the 30-day baseline: <em>“Pick three questions your business actually waited on last quarter. We’ll answer them in front of you. You tell us what that would have cost without us.”</em> They quote you the ROI themselves.</>,
  },
  scenario: {
    metaA: 'Mid-market retailer · 41 stores · 3 DCs',
    metaB: 'VP Operations · Slack DM to CFO',
    prompt: <>“Why are returns spiking in the Southwest region this week? I need an answer before Monday’s board call.”</>,
    withoutLabel: 'Without Aspect',
    withoutStatus: 'BI ticket, manual pull',
    withoutSteps: [
      { time: 'Friday 5:02 PM', text: <>Analyst files a Jira ticket against the data team.</> },
      { time: 'Monday 9:30 AM', text: <>Ticket triaged. Slot found Wednesday.</> },
      { time: 'Wednesday', text: <>Analyst writes joins across orders, returns, SKUs, DCs, suppliers.</> },
      { time: 'Thursday', text: <>First chart lands. VP asks the obvious follow-up. Loop again.</> },
      { time: 'Following Monday', text: <>Board meeting. Answer is partial. Decision is deferred.</> },
    ],
    withoutCostLabel: 'Cost',
    withoutCostVal: '~14 analyst hours · 1 week of bleed',
    withLabel: 'With Aspect',
    withStatus: 'Multi-agent crew, 47 seconds',
    withSteps: [
      { time: '0s', text: <><strong>Analytics Agent</strong> parses the question, identifies the metric, delegates the data pull.</> },
      { time: '4s', text: <><strong>Schema Builder</strong> resolves a return-rate view across orders, returns, SKUs, DCs — no hand-written joins.</> },
      { time: '11s', text: <><strong>NL→SQL</strong> produces the query.<strong> Long Query Assistance</strong> stages a temporary warehouse so the scan finishes in seconds, not minutes.</> },
      { time: '28s', text: <>Spike isolated to <strong>one SKU</strong> at <strong>DC-West</strong>. Cross-referenced with supplier batch <code>#A-2241</code> — a packaging defect.</> },
      { time: '47s', text: <><strong>Data Assistance Agent</strong> recommends rerouting that SKU through DC-Central until batch <code>#A-2241</code> is exhausted. Estimated avoided loss: <strong>$48K / week</strong>.</> },
    ],
    withCostLabel: 'Outcome',
    withCostVal: <>14 analyst hours saved · $48K/week bleed stopped · decision made Friday</>,
    punchKicker: 'The point',
    punchText: <>Aspect did not just retrieve data. It <em>planned</em> — it noticed a bottleneck, traced it to a root cause, and suggested a resource reallocation. That is the difference between a chat box and an operational intelligence platform.</>,
  },
  platform: {
    lede: 'Aspect is not a wrapper. It is an operational intelligence platform with four production modules that together turn a model into a system the business can rely on.',
    modules: [
      { tag: 'MODULE 01', name: 'Multi-Agent Crew', desc: <>Specialized agents — Analytics, Data Assistance, and domain-specific roles — that delegate, debate, and compose answers. One question, many minds.</> },
      { tag: 'MODULE 02', name: 'Natural Language to SQL', desc: <>Translates business questions into accurate, production-grade SQL. Type-aware, join-aware, dialect-aware. Powered by Claude under the hood; tuned by Aspect on top.</> },
      { tag: 'MODULE 03', name: 'Database Schema Builder', desc: <>Builds an optimized retrieval graph over the live schema — relationships, semantics, sensitive columns. The model never sees raw DDL; it sees something better.</> },
      { tag: 'MODULE 04', name: 'Long Query Assistance', desc: <>Dynamically analyzes complex queries and provisions temporary on-the-fly data warehouses so heavy analyses return in seconds, not coffee breaks.</> },
    ],
    noteKicker: 'Position it like this',
    noteText: <>“Aspect feels like a next-generation RAG, but it doesn’t just retrieve — it analyzes, plans, and recommends. Ask it for the last two months of income and it answers. Ask it where you’re bleeding profit and it goes looking.”</>,
  },
  cheat: {
    lines: [
      { q: <>“Isn’t this just ChatGPT for our database?”</>, a: <>ChatGPT is the spark plug. Aspect is the car. The plug is not the problem.</> },
      { q: <>“Why can’t our data team build this?”</>, a: <>They can — in eighteen months, on the third rewrite. We sell you those eighteen months.</> },
      { q: <>“What if Claude changes their pricing or model?”</>, a: <>Aspect is model-routed. Swap the engine without touching the airplane.</> },
      { q: <>“How accurate is the SQL?”</>, a: <>Schema-grounded, type-checked, and validated before execution. We don’t hallucinate joins — we don’t need to.</> },
      { q: <>“What about governance and PII?”</>, a: <>Column-level policy lives in the schema graph, not the prompt. The model never sees what it’s not allowed to see.</> },
      { q: <>“Can it handle huge queries?”</>, a: <>Long Query Assistance spins up temporary warehouses on the fly. Heavy analyses return in seconds.</> },
    ],
  },
  closing: {
    kicker: 'Before you walk into the meeting',
    title: <>Two answers. Sixty seconds each. That’s the deal.</>,
    body: <>If you remember nothing else: Claude is the engine, Aspect is the vehicle. ROI is measured in deflected tickets, time-to-insight, and the questions your customer didn’t even know to ask. Lead with that. Everything else is detail.</>,
    primary: 'Re-read the objections',
    secondary: 'Open the scenario',
  },
  footer: {
    brand: 'Aspect Platform',
    note: 'Operational Intelligence · Internal sales reference',
    meta: 'v1.0 · Battle Card',
  },
};

const HE: Strings = {
  docTitle: 'Aspect · מדריך מכירה',
  brandName: 'Aspect',
  brandSub: 'מדריך מכירה',
  classified: 'תמיכה במכירות · לשימוש פנימי',
  nav: {
    objections: 'שתי ההתנגדויות',
    scenario: 'תרחיש חי',
    platform: 'הפלטפורמה',
    cheat: 'דף עזר',
  },
  hero: { line1: 'פלטפורמת Aspect', line2: 'מדריך מכירה' },
  sectionLabels: {
    obj: 'שתי ההתנגדויות שסוגרות את העסקה',
    scenario: 'תרחיש חי — יום שישי, 16:47',
    platform: 'מה באמת מתחת למכסה',
    cheat: 'דף עזר — שורות קצרות לחדר',
  },
  obj1: {
    num: '01',
    tag: 'התנגדות "פשוט תקנו Claude"',
    question: <>"בשביל מה אני צריך אתכם, אם אני יכול פשוט לקחת Claude ולחבר אותו למסד הנתונים שלי?"</>,
    answerKicker: 'תמסרו את זה ב-15 שניות',
    headline: <>Claude הוא מנוע. הוא לא רכב. מנוע שמחובר למסד נתונים בלי ארכיטקטורה הוא לא מוצר — הוא חוב טכני עם ממשק צ'אט.</>,
    tpTitle: 'נקודות לשיחה',
    tp: [
      <><strong>מיתוס "הקסם של ה-AI".</strong> אין פרומפט שמחבר LLM לדאטה ארגוני בצורה בטוחה. סכמות זזות, JOINs מתפוצצים, PII דולף, עלויות מתפוצצות. החלק הקשה הוא כל מה שמסביב למודל.</>,
      <><strong>גם אנחנו משתמשים ב-Claude.</strong> Aspect רצה על Claude לעבודה הכבדה — כולל תרגום שפה טבעית ל-SQL. אנחנו לא מתחרים במודל. אנחנו ה-stack של הייצור שהופך את המודל לבטוח לכוון מולו על עסק אמיתי.</>,
      <><strong>חישוב Build מול Buy.</strong> צוות פנימי יכול לחבר תיבת צ'אט ל-Postgres בסוף שבוע. לקחת את זה ל-200 טבלאות, משתמשים אמיתיים, גוברנס, תקציבי latency ותשובות אמינות — זה שכתוב של 18 חודשים. רוב הצוותים משחררים גרסה 1 כחוב טכני בלתי-תחזיק.</>,
      <><strong>Aspect היא שכבת התזמור.</strong> ניתוב רב-סוכני, הבנת סכמה, תכנון שאילתות, מטמון לביצועים, ביקורת, guardrails. צוותים משחררים תוך שבועות במקום רבעונים, והתשובות נשארות מדויקות גם כשהעסק מתפתח.</>,
    ],
    proofKicker: 'מסגור מחדש בחדר',
    proofQuote: <>"בטח — ואפשר גם לצקת דלק סילוני לסדאן. הדלק הוא לא הבעיה. אנחנו מוכרים את המטוס שיודע איך להשתמש בו בלי להתרסק על מחסן הנתונים שלכם."</>,
    proofStats: [
      { stat: <>10×</>, label: 'מהיר יותר עד התשובה הראשונה' },
      { stat: '0', label: 'פרומפטים לתחזק' },
      { stat: '~18 ח׳', label: 'שכתוב פנימי שנחסך' },
    ],
    footerLabel: 'אם הם דוחפים בחזרה',
    footerText: <>שאלו אותם: <em>"מי בצוות שלכם אחראי היום על גרף הסכמה, על אופטימייזר השאילתות ועל ניתוב הסוכנים — בייצור?"</em> השתיקה היא התשובה. השתיקה הזו היא בדיוק Aspect.</>,
  },
  obj2: {
    num: '02',
    tag: 'התנגדות "תוכיחו את ה-ROI"',
    question: <>"איך אני יכול לחשב או למדוד את הרווח המדויק שהאפליקציה שלכם תיתן לי?"</>,
    answerKicker: 'תמסרו את זה ב-15 שניות',
    headline: <>תמדדו את הזמן-לתובנה ואת עלות שעות האנליסט שאתם <em>לא</em> שורפים. ואז תוסיפו את הערך של התובנות שלא הייתם מוצאים בכלל.</>,
    tpTitle: 'נקודות לשיחה',
    tp: [
      <><strong>ייחוס ישיר זה לא העדשה הנכונה.</strong> אף אחד לא יכול לייחס ישירות רבעון של הכנסה לדשבורד בודד. זו מעולם לא הייתה השאלה ל-BI. וזו לא השאלה גם ל-AI.</>,
      <><strong>תמדדו הסטת משאבים.</strong> כל דוח ש-Aspect עונה עליו בזמן אמת הוא טיקט שלא הלך ל-BI, להנדסה או ל-Data Science. רוב הלקוחות רואים 60–80% מהבקשות האד-הוק נסגרות בלי לפתוח טיקט.</>,
      <><strong>תמדדו זמן-לתובנה.</strong> זמן תגובה של חמישה ימים מאנליסט הופך לארבעים וחמש שניות. סמנכ"ל הכספים שיכול לשאול שאלה ולקבל תשובה באותה ישיבה — מקבל החלטות אחרות מסמנכ"ל שצריך לחכות עד יום שלישי.</>,
      <><strong>תמדדו ערך נגזר.</strong> הצוות הרב-סוכני מציף דליפות רווח, חריגות ותבניות מסדר שני שאף אחד לא חיפש. אי אפשר לחשב מראש ROI על תובנה שלא ידעת שקיימת — אבל בהחלט אפשר לרשום את החיסכון ברגע שהיא מופיעה.</>,
    ],
    proofKicker: 'מסגור מחדש בחדר',
    proofQuote: <>"אם הייתי מבקש מכם לחשב ROI שורה-שורה על צוות ה-BI שלכם, גם אתם לא הייתם יכולים — אבל לא הייתם מפטרים אותם. Aspect מעצים את אותו הצוות בדיוק. המתמטיקה זהה; המכפיל גדול יותר."</>,
    proofStats: [
      { stat: '45ש', label: 'מול טיקט BI של 5 ימים' },
      { stat: '70%', label: 'פחות טיקטים אד-הוק' },
      { stat: <>∞</>, label: 'תובנות שלא הייתם חושבים לבקש' },
    ],
    footerLabel: 'אם הם דוחפים בחזרה',
    footerText: <>הציעו בסיס של 30 יום: <em>"בחרו שלוש שאלות שהעסק שלכם באמת חיכה עליהן ברבעון האחרון. נענה עליהן מולכם. אתם תגידו לנו כמה זה היה עולה לכם בלעדינו."</em> הם מצטטים לכם את ה-ROI בעצמם.</>,
  },
  scenario: {
    metaA: 'רשת קמעונאות בינונית · 41 חנויות · 3 מרכזי הפצה',
    metaB: 'סמנכ"ל תפעול · הודעת Slack לסמנכ"ל כספים',
    prompt: <>"למה ההחזרות מזנקות באזור הדרום-מערב השבוע? אני צריך תשובה לפני ישיבת הדירקטוריון ביום שני."</>,
    withoutLabel: 'בלי Aspect',
    withoutStatus: 'טיקט BI, משיכה ידנית',
    withoutSteps: [
      { time: 'יום שישי 17:02', text: <>אנליסט פותח טיקט Jira נגד צוות הדאטה.</> },
      { time: 'יום שני 09:30', text: <>הטיקט עובר מיון. נמצא חלון זמן ליום רביעי.</> },
      { time: 'יום רביעי', text: <>האנליסט כותב JOINs בין הזמנות, החזרות, SKUs, מרכזי הפצה וספקים.</> },
      { time: 'יום חמישי', text: <>הגרף הראשון מגיע. סמנכ"ל התפעול שואל את שאלת ההמשך המתבקשת. סבב נוסף.</> },
      { time: 'יום שני שלאחר מכן', text: <>ישיבת דירקטוריון. התשובה חלקית. ההחלטה נדחית.</> },
    ],
    withoutCostLabel: 'עלות',
    withoutCostVal: '~14 שעות אנליסט · שבוע של דימום',
    withLabel: 'עם Aspect',
    withStatus: 'צוות רב-סוכני, 47 שניות',
    withSteps: [
      { time: '0ש', text: <><strong>סוכן האנליטיקה</strong> מנתח את השאלה, מזהה את המטריקה ומאציל את משיכת הדאטה.</> },
      { time: '4ש', text: <><strong>בונה הסכמה</strong> מחבר תצוגת return-rate על הזמנות, החזרות, SKUs ומרכזי הפצה — בלי JOINs בכתב יד.</> },
      { time: '11ש', text: <><strong>NL→SQL</strong> מייצר את השאילתא. <strong>סיוע לשאילתות ארוכות</strong> מקים מחסן זמני כדי שהסריקה תסתיים בשניות, לא בדקות.</> },
      { time: '28ש', text: <>הזינוק מבודד ל<strong>SKU אחד</strong> ב<strong>DC-West</strong>. הצלבה מול אצוות ספק <code>#A-2241</code> — פגם באריזה.</> },
      { time: '47ש', text: <><strong>סוכן סיוע הדאטה</strong> ממליץ לנתב מחדש את ה-SKU הזה דרך DC-Central עד שאצוות <code>#A-2241</code> תיגמר. הפסד מוערך שנמנע: <strong>48K$ לשבוע</strong>.</> },
    ],
    withCostLabel: 'תוצאה',
    withCostVal: <>14 שעות אנליסט נחסכו · 48K$/שבוע של דימום נעצרו · החלטה התקבלה ביום שישי</>,
    punchKicker: 'הפואנטה',
    punchText: <>Aspect לא רק אחזרה דאטה. היא <em>תכננה</em> — היא זיהתה צוואר בקבוק, עקבה אחר שורש הבעיה והציעה הקצאה מחדש של משאבים. זה ההבדל בין תיבת צ'אט לפלטפורמת אינטליגנציה תפעולית.</>,
  },
  platform: {
    lede: 'Aspect היא לא wrapper. היא פלטפורמת אינטליגנציה תפעולית עם ארבעה מודולי ייצור שיחד הופכים מודל למערכת שהעסק יכול לסמוך עליה.',
    modules: [
      { tag: 'מודול 01', name: 'צוות רב-סוכני', desc: <>סוכנים מומחים — אנליטיקה, סיוע בדאטה ותפקידים תחומיים — שמאצילים, מתווכחים ומרכיבים תשובות. שאלה אחת, הרבה ראשים.</> },
      { tag: 'מודול 02', name: 'שפה טבעית ל-SQL', desc: <>מתרגם שאלות עסקיות ל-SQL מדויק וברמת ייצור. מודע לטיפוסים, ל-JOINs ולדיאלקטים. מונע על-ידי Claude מתחת למכסה; מכוון על-ידי Aspect מעליו.</> },
      { tag: 'מודול 03', name: 'בונה סכמת מסד נתונים', desc: <>בונה גרף אחזור מאופטם מעל הסכמה החיה — קשרים, סמנטיקה ועמודות רגישות. המודל לא רואה DDL גולמי; הוא רואה משהו טוב יותר.</> },
      { tag: 'מודול 04', name: 'סיוע לשאילתות ארוכות', desc: <>מנתח דינמית שאילתות מורכבות ומקצה מחסני נתונים זמניים בזמן אמת, כך שניתוחים כבדים חוזרים בשניות, לא בהפסקות קפה.</> },
    ],
    noteKicker: 'תמקמו את זה ככה',
    noteText: <>"Aspect מרגישה כמו RAG מהדור הבא, אבל היא לא רק מאחזרת — היא מנתחת, מתכננת וממליצה. תשאלו אותה את ההכנסות של החודשיים האחרונים והיא עונה. תשאלו אותה איפה אתם מדממים רווח, והיא יוצאת לחפש."</>,
  },
  cheat: {
    lines: [
      { q: <>"זה לא סתם ChatGPT למסד הנתונים שלנו?"</>, a: <>ChatGPT הוא המצת. Aspect היא הרכב. המצת הוא לא הבעיה.</> },
      { q: <>"למה צוות הדאטה שלנו לא יכול לבנות את זה?"</>, a: <>הם יכולים — בעוד שמונה-עשר חודשים, בכתיבה השלישית. אנחנו מוכרים לכם את שמונה-עשר החודשים האלה.</> },
      { q: <>"מה אם Claude ישנו את התמחור או את המודל?"</>, a: <>Aspect מנתבת בין מודלים. תחליפו את המנוע בלי לגעת במטוס.</> },
      { q: <>"כמה מדויק ה-SQL?"</>, a: <>מבוסס סכמה, בדוק טיפוסים ואומת לפני הרצה. אנחנו לא מהזים JOINs — אין לנו צורך.</> },
      { q: <>"מה לגבי גוברנס ו-PII?"</>, a: <>מדיניות ברמת עמודה חיה בגרף הסכמה, לא בפרומפט. המודל לא רואה מה שאסור לו לראות.</> },
      { q: <>"היא יכולה להתמודד עם שאילתות ענק?"</>, a: <>סיוע לשאילתות ארוכות מקים מחסנים זמניים בזמן אמת. ניתוחים כבדים חוזרים בשניות.</> },
    ],
  },
  closing: {
    kicker: 'לפני שאתם נכנסים לפגישה',
    title: <>שתי תשובות. שישים שניות כל אחת. זאת העסקה.</>,
    body: <>אם תזכרו רק דבר אחד: Claude הוא המנוע, Aspect היא הרכב. ROI נמדד בטיקטים שהוסטו, בזמן-לתובנה, ובשאלות שהלקוח שלכם אפילו לא ידע לשאול. תתחילו עם זה. כל השאר הוא פרטים.</>,
    primary: 'קרא שוב את ההתנגדויות',
    secondary: 'פתח את התרחיש',
  },
  footer: {
    brand: 'פלטפורמת Aspect',
    note: 'אינטליגנציה תפעולית · מסמך מכירות פנימי',
    meta: 'גרסה 1.0 · מדריך מכירה',
  },
};

function useReveal(deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll(`.${styles.reveal}`);
    if (!els.length) return;
    els.forEach((el) => el.classList.remove(styles.revealIn));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.revealIn);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/* ===== Reusable bits ===== */

function ClassifiedBadge({ text }: { text: string }) {
  return (
    <div className={styles.classified}>
      <span className={styles.classifiedDot} />
      <span className={styles.classifiedText}>{text}</span>
    </div>
  );
}

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <div className={styles.sectionLabel}>
      <span className={styles.sectionIndex}>{index}</span>
      <span className={styles.sectionLine} />
      <span className={styles.sectionTitle}>{label}</span>
    </div>
  );
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const next: Lang = lang === 'en' ? 'he' : 'en';
  const label = lang === 'en' ? 'עברית' : 'English';
  return (
    <button
      className={styles.langToggle}
      onClick={() => onChange(next)}
      aria-label={`Switch to ${label}`}
    >
      {label}
    </button>
  );
}

/* ===== Page ===== */

export function AspectBattleCardPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = lang === 'he' ? HE : EN;
  const isHe = lang === 'he';
  const ref = useReveal([lang]);

  useEffect(() => {
    document.title = t.docTitle;
  }, [t.docTitle]);

  return (
    <div ref={ref} className={`${styles.page} ${isHe ? styles.rtl : ''}`} dir={isHe ? 'rtl' : 'ltr'} lang={isHe ? 'he' : 'en'}>
      {/* ===== Nav ===== */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <a href="#top" className={styles.brand}>
            <span className={styles.brandMark}>
              <span className={styles.brandDotA} />
              <span className={styles.brandDotB} />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>{t.brandName}</span>
              <span className={styles.brandSub}>{t.brandSub}</span>
            </span>
          </a>
          <div className={styles.navLinks}>
            <a href="#objections" className={styles.navLink}>{t.nav.objections}</a>
            <a href="#scenario" className={styles.navLink}>{t.nav.scenario}</a>
            <a href="#platform" className={styles.navLink}>{t.nav.platform}</a>
            <a href="#cheat" className={styles.navLink}>{t.nav.cheat}</a>
          </div>
          <LangToggle lang={lang} onChange={setLang} />
        </div>
      </nav>

      {/* ===== Hero ===== */}
      <header id="top" className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <ClassifiedBadge text={t.classified} />
          <h1 className={styles.heroTitle}>
            <span className={styles.heroLine1}>{t.hero.line1}</span>
            <span className={styles.heroLine2}>{t.hero.line2}</span>
          </h1>
        </div>
      </header>

      <main className={styles.main}>
        {/* ===== Objections ===== */}
        <section id="objections" className={`${styles.section} ${styles.objectionsSection}`}>
          <SectionLabel index="01" label={t.sectionLabels.obj} />

          <div className={styles.objections}>
            {/* OBJECTION 1 */}
            <article className={`${styles.objection} ${styles.reveal}`}>
              <div className={styles.objHeader}>
                <span className={styles.objNum}>{t.obj1.num}</span>
                <span className={styles.objTag}>{t.obj1.tag}</span>
              </div>

              <h2 className={styles.objQuestion}>{t.obj1.question}</h2>

              <div className={styles.objHeadlineAnswer}>
                <span className={styles.answerKicker}>{t.obj1.answerKicker}</span>
                <p className={styles.answerHeadline}>{t.obj1.headline}</p>
              </div>

              <div className={styles.objBody}>
                <div className={styles.talkingPoints}>
                  <h4 className={styles.tpTitle}>{t.obj1.tpTitle}</h4>
                  <ul className={styles.tpList}>
                    {t.obj1.tp.map((node, i) => <li key={i}>{node}</li>)}
                  </ul>
                </div>

                <div className={styles.proofCard}>
                  <span className={styles.proofKicker}>{t.obj1.proofKicker}</span>
                  <p className={styles.proofQuote}>{t.obj1.proofQuote}</p>
                  <div className={styles.proofGrid}>
                    {t.obj1.proofStats.map((s, i) => (
                      <div key={i}>
                        <span className={styles.proofStat}>{s.stat}</span>
                        <span className={styles.proofLabel}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.objFooter}>
                <span className={styles.objFooterLabel}>{t.obj1.footerLabel}</span>
                <p className={styles.objFooterText}>{t.obj1.footerText}</p>
              </div>
            </article>

            {/* OBJECTION 2 */}
            <article className={`${styles.objection} ${styles.reveal}`}>
              <div className={styles.objHeader}>
                <span className={styles.objNum}>{t.obj2.num}</span>
                <span className={styles.objTag}>{t.obj2.tag}</span>
              </div>

              <h2 className={styles.objQuestion}>{t.obj2.question}</h2>

              <div className={styles.objHeadlineAnswer}>
                <span className={styles.answerKicker}>{t.obj2.answerKicker}</span>
                <p className={styles.answerHeadline}>{t.obj2.headline}</p>
              </div>

              <div className={styles.objBody}>
                <div className={styles.talkingPoints}>
                  <h4 className={styles.tpTitle}>{t.obj2.tpTitle}</h4>
                  <ul className={styles.tpList}>
                    {t.obj2.tp.map((node, i) => <li key={i}>{node}</li>)}
                  </ul>
                </div>

                <div className={styles.proofCard}>
                  <span className={styles.proofKicker}>{t.obj2.proofKicker}</span>
                  <p className={styles.proofQuote}>{t.obj2.proofQuote}</p>
                  <div className={styles.proofGrid}>
                    {t.obj2.proofStats.map((s, i) => (
                      <div key={i}>
                        <span className={styles.proofStat}>{s.stat}</span>
                        <span className={styles.proofLabel}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.objFooter}>
                <span className={styles.objFooterLabel}>{t.obj2.footerLabel}</span>
                <p className={styles.objFooterText}>{t.obj2.footerText}</p>
              </div>
            </article>
          </div>
        </section>

        {/* ===== Scenario ===== */}
        <section id="scenario" className={`${styles.section} ${styles.scenarioSection}`}>
          <SectionLabel index="02" label={t.sectionLabels.scenario} />

          <div className={`${styles.scenarioFrame} ${styles.reveal}`}>
            <div className={styles.scenarioHeader}>
              <div className={styles.scenarioMeta}>
                <span className={styles.scenarioTag}>{t.scenario.metaA}</span>
                <span className={styles.scenarioTag}>{t.scenario.metaB}</span>
              </div>
              <p className={styles.scenarioPrompt}>{t.scenario.prompt}</p>
            </div>

            <div className={styles.scenarioCompare}>
              <div className={styles.scenarioCol}>
                <div className={styles.scenarioColHead}>
                  <span className={styles.scenarioColLabel}>{t.scenario.withoutLabel}</span>
                  <span className={styles.scenarioColStatus}>{t.scenario.withoutStatus}</span>
                </div>
                <ol className={styles.scenarioSteps}>
                  {t.scenario.withoutSteps.map((s, i) => (
                    <li key={i}>
                      <span className={styles.stepTime}>{s.time}</span>
                      <span className={styles.stepText}>{s.text}</span>
                    </li>
                  ))}
                </ol>
                <div className={styles.scenarioCost}>
                  <span className={styles.costLabel}>{t.scenario.withoutCostLabel}</span>
                  <span className={styles.costVal}>{t.scenario.withoutCostVal}</span>
                </div>
              </div>

              <div className={`${styles.scenarioCol} ${styles.scenarioColAspect}`}>
                <div className={styles.scenarioColHead}>
                  <span className={styles.scenarioColLabel}>{t.scenario.withLabel}</span>
                  <span className={styles.scenarioColStatus}>{t.scenario.withStatus}</span>
                </div>
                <ol className={styles.scenarioSteps}>
                  {t.scenario.withSteps.map((s, i) => (
                    <li key={i}>
                      <span className={styles.stepTime}>{s.time}</span>
                      <span className={styles.stepText}>{s.text}</span>
                    </li>
                  ))}
                </ol>
                <div className={styles.scenarioCost}>
                  <span className={styles.costLabel}>{t.scenario.withCostLabel}</span>
                  <span className={styles.costVal}>{t.scenario.withCostVal}</span>
                </div>
              </div>
            </div>

            <div className={styles.scenarioPunchline}>
              <span className={styles.punchKicker}>{t.scenario.punchKicker}</span>
              <p>{t.scenario.punchText}</p>
            </div>
          </div>
        </section>

        {/* ===== Platform / Modules ===== */}
        <section id="platform" className={`${styles.section} ${styles.platformSection}`}>
          <SectionLabel index="03" label={t.sectionLabels.platform} />
          <p className={`${styles.sectionLede} ${styles.reveal}`}>{t.platform.lede}</p>

          <div className={styles.modules}>
            {t.platform.modules.map((m) => (
              <article key={m.name} className={`${styles.module} ${styles.reveal}`}>
                <span className={styles.moduleTag}>{m.tag}</span>
                <h3 className={styles.moduleName}>{m.name}</h3>
                <p className={styles.moduleDesc}>{m.desc}</p>
              </article>
            ))}
          </div>

          <div className={`${styles.platformNote} ${styles.reveal}`}>
            <span className={styles.noteKicker}>{t.platform.noteKicker}</span>
            <p>{t.platform.noteText}</p>
          </div>
        </section>

        {/* ===== Cheat sheet ===== */}
        <section id="cheat" className={`${styles.section} ${styles.cheatSection}`}>
          <SectionLabel index="04" label={t.sectionLabels.cheat} />
          <div className={styles.cheatGrid}>
            {t.cheat.lines.map((l, i) => (
              <div key={i} className={`${styles.cheatItem} ${styles.reveal}`}>
                <p className={styles.cheatQ}>{l.q}</p>
                <p className={styles.cheatA}>{l.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Closing ===== */}
        <section className={`${styles.section} ${styles.closingSection}`}>
          <div className={`${styles.closingCard} ${styles.reveal}`}>
            <span className={styles.closingKicker}>{t.closing.kicker}</span>
            <h2 className={styles.closingTitle}>{t.closing.title}</h2>
            <p className={styles.closingBody}>{t.closing.body}</p>
            <div className={styles.closingActions}>
              <a className={styles.closingPrimary} href="#objections">{t.closing.primary}</a>
              <a className={styles.closingSecondary} href="#scenario">{t.closing.secondary}</a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLeft}>
            <span className={styles.footerBrand}>{t.footer.brand}</span>
            <span className={styles.footerNote}>{t.footer.note}</span>
          </div>
          <div className={styles.footerRight}>
            <span className={styles.footerMeta}>{t.footer.meta}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AspectBattleCardPage;
