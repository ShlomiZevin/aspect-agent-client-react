/**
 * Lybi Gate (beta) — the page's words. Hebrew, plain, gender-neutral, like
 * the rest of the management center (src/manage/copy.ts).
 */

import type { GateAction, GateBy } from './gateApi';

export const G = {
  title: 'Lybi Gate',
  beta: 'בטא',
  scopeNote: 'חל על כל הסביבה – לא על סוכן אחד',
  bannerTitle: 'גרסת בטא – עדיין לא מחוברת לסוכנים',
  bannerText: 'המדיניות, המפתחות, החיבורים והיומן כאן אמיתיים ונשמרים בשרת. "בנק ההדגמה" הוא בנק דמה שלנו, כדי שאפשר יהיה לראות את כל הדרך.',
  notConfigured: 'השער עדיין לא מוגדר בשרת הזה (חסרים מפתחות הצפנה). צריך לפנות לצוות Lybi.',
  loadFailed: 'לא הצלחנו לטעון את השער. אפשר לנסות שוב.',
  refresh: 'לבדוק שוב',
  updated: 'עודכן',

  // KPIs
  kPolicy: 'מדיניות פעילה',
  kPolicyNone: 'אין עדיין',
  kVersion: (v: number) => `גרסה ${v}`,
  kSignedBy: 'נחתמה ע״י',
  kPending: 'ממתינים להחלטה',
  kPendingUnit: 'שדות חדשים',
  kKeys: 'מפתחות פעילים',
  kKeysUnit: 'לשליחה מהבנק',
  kIn: 'נכנסו היום',
  kOut: 'יצאו לבנק היום',
  kRejected: 'נדחו היום',
  kCalls: 'קריאות',

  // Connections
  connTitle: 'החיבורים בין הבנק ל־Lybi',
  connFile: 'קבצים מהבנק',
  connFileSub: 'הבנק מעלה קובץ, וכל רשומה עוברת בשער',
  connApi: 'הבנק שולח ל־Lybi',
  connApiSub: 'מערכת הבנק שולחת רשומות ב־API, עם מפתח',
  connRecords: (n: number) => `${n} רשומות`,
  connKeys: (n: number) => `${n} מפתחות פעילים`,
  upload: 'העלאת קובץ',
  manageKeys: 'מפתחות',
  kindLookup: 'Lybi שואלת את הבנק באמצע שיחה',
  kindHandoff: 'Lybi מעבירה לבנק בסיום',
  test: 'בדיקה',
  testing: 'בודקים…',
  edit: 'עריכה',
  testOk: (ms: number) => `החיבור תקין · ${ms} מ״ש`,
  testFail: 'החיבור לא ענה כמו שצריך',
  never: 'עוד לא נבדק',
  lastCall: 'פעם אחרונה',
  noBank: 'עוד לא חובר בנק',
  noBankSub: 'מחברים את בנק ההדגמה כדי לראות את כל הדרך: המפתח הציבורי שלו, שאלה באמצע שיחה והעברה בסיום.',
  connectMock: 'חיבור בנק ההדגמה',
  newConnection: 'חיבור חדש',
  bankKey: 'המפתח של הבנק',

  // Policy
  polTitle: 'מה קורה לכל שדה לפני שהוא מגיע למודל',
  polEmpty: 'עדיין אין מדיניות. מעלים קובץ או שולחים רשומות, ו־Lybi מציעה מה לעשות בכל שדה.',
  polSigned: (v: number) => `גרסה חתומה ${v}`,
  polDraft: (v: number) => `טיוטה ${v}`,
  polChanges: (n: number) => (n === 1 ? 'שינוי אחד מול הגרסה החתומה' : `${n} שינויים מול הגרסה החתומה`),
  polNoChanges: 'אין שינויים מול הגרסה החתומה',
  polNew: (n: number) => (n === 1 ? 'שדה חדש ממתין להחלטה' : `${n} שדות חדשים ממתינים להחלטה`),
  sign: 'אישור וחתימה',
  versions: 'גרסאות',
  colField: 'שדה',
  colWhat: 'מה זה',
  colAction: 'מה עושים',
  colMeaning: 'מה זה אומר',
  change: 'שינוי',
  newTag: 'חדש',
  byDetector: 'נבדק בקוד',
  byDetectorTip: 'זוהה בבדיקת המספר עצמו (ספרת ביקורת או מבנה) – אותה בדיקה שחוסמת מידע רגיש בצ׳אט של Lybi',
  byName: 'לפי שם השדה',
  byNameTip: 'אין עדיין בדיקה לסוג הזה – הזיהוי לפי שם השדה',
  signTitle: 'אישור וחתימה על המדיניות',
  signBody: 'מהרגע הזה כל רשומה, מכל חיבור, תעבור לפי המדיניות הזו. הגרסה נחתמת ונשמרת, ואפשר לראות אותה בכל רגע.',
  signBodyNew: (n: number) => `יש ${n} שדות חדשים שעוד לא הוחלט עליהם. אם ממשיכים, הם ייחתמו לפי ההצעה של Lybi.`,
  signConfirm: 'לחתום',
  signConfirmNew: 'לחתום עם ההצעות',
  signNothing: 'אין טיוטה לחתימה',
  fieldTitle: (f: string) => `מה עושים בשדה ${f}`,
  fieldDetected: 'Lybi זיהתה',
  save: 'שמירה',
  versionsTitle: 'גרסאות המדיניות',
  vSigned: 'חתומה',
  vDraft: 'טיוטה',
  vValid: 'החתימה תקינה',
  vInvalid: 'החתימה לא תקינה',
  vFields: (n: number) => `${n} שדות`,

  // Keys
  keysTitle: 'מפתחות לשליחה מהבנק',
  keysSub: 'מערכת הבנק שולחת רשומות לכתובת הזו, עם מפתח בכותרת Authorization.',
  keyName: 'שם המפתח',
  keyNamePh: 'למשל: מערכת ה־CRM',
  createKey: 'יצירת מפתח',
  keyOnce: 'זה הרגע היחיד שבו המפתח מוצג. כדאי להעתיק אותו עכשיו – Lybi שומרת רק טביעה שלו.',
  copy: 'העתקה',
  copied: 'הועתק',
  revoke: 'ביטול',
  revokeTitle: 'ביטול מפתח',
  revokeBody: (n: string) => `המפתח "${n}" יפסיק לעבוד מיד. מערכת שמשתמשת בו לא תוכל לשלוח עוד.`,
  keyActive: 'פעיל',
  keyRevoked: 'בוטל',
  keyLastUsed: 'שימוש אחרון',
  keyNever: 'עוד לא היה בשימוש',
  noKeys: 'עוד אין מפתחות.',
  example: 'דוגמת קריאה',

  // Upload
  uploadTitle: 'העלאת קובץ מהבנק',
  uploadDrop: 'גוררים לכאן קובץ CSV או JSON',
  uploadPick: 'בחירת קובץ',
  uploadSample: 'נתוני דוגמה',
  uploadSampleNote: 'לידים בדויים לפתיחת חשבון',
  uploadReady: (n: number, f: string) => `${n} רשומות מוכנות · ${f}`,
  uploadSend: 'שליחה דרך השער',
  uploadDone: (n: number) => `${n} רשומות עברו בשער`,
  uploadNew: (n: number) => `${n} שדות חדשים נוספו לטיוטה`,
  uploadBad: 'לא הצלחנו לקרוא את הקובץ',
  uploadNoBank: 'קודם צריך לחבר בנק – בלי המפתח שלו אי אפשר להצפין.',

  // Records
  recTitle: 'רשומות אחרונות',
  recEmpty: 'עוד אין רשומות.',
  colTime: 'זמן',
  colSource: 'מקור',
  colRef: 'מזהה',
  colModel: 'מה המודל מקבל',
  recModelCount: (m: number, n: number) => `${m} מתוך ${n} שדות`,
  src: { api: 'API', file: 'קובץ', bank: 'תשובת הבנק' } as Record<string, string>,
  view: 'צפייה',
  recTitleOne: 'רשומה',
  recStored: 'מה נשמר ב־Lybi',
  recModel: 'מה המודל מקבל',
  askBank: 'לשאול את הבנק',
  handoff: 'להעביר לבנק',
  callSent: 'מה יצא מ־Lybi',
  callAnswer: 'תשובת הבנק אחרי השער – מה המודל מקבל',
  callHandoff: 'הבנק אישר',
  callOpened: (ok: number, n: number) => `${ok} מתוך ${n} שדות נפתחו במפתח של הבנק`,
  callNew: (n: number) => `${n} שדות בתשובה חדשים למדיניות – הם מוסתרים עד שחותמים`,
  callFailed: 'הבנק לא ענה כמו שצריך',
  notSent: 'לא נשלח',
  noLookup: 'אין חיבור לשאלה באמצע שיחה',
  noHandoff: 'אין חיבור להעברה בסיום',
  answers: 'תשובות הבנק לרשומה הזו',

  // Stored values
  stHide: 'לא נשמר',
  stEnc: '🔒 נעול לבנק',
  stEmpty: '—',
  absent: 'לא מגיע',

  // Try
  tryTitle: 'ניסיון רשומה',
  trySub: 'מדביקים רשומה ורואים מה יקרה לה – בלי לשמור כלום.',
  tryUseSigned: 'לפי הגרסה החתומה',
  tryUseDraft: 'לפי הטיוטה',
  tryRun: 'לנסות',
  tryBadJson: 'הרשומה צריכה להיות אובייקט JSON אחד',
  tryUnknown: (n: number) => `${n} שדות לא מוכרים למדיניות – יוסתרו`,

  // Log
  logTitle: 'יומן חי',
  logSub: 'כל קריאה שנכנסת ויוצאת, וכל שינוי. בלי ערכים – רק שמות שדות ופעולות.',
  logEmpty: 'היומן ריק.',
  colDir: 'כיוון',
  colKind: 'מה קרה',
  colStatus: 'מצב',
  colDetails: 'פרטים',
  dir: { in: 'נכנס', out: 'יוצא', admin: 'ניהול' } as Record<string, string>,
  status: { ok: 'הצליח', rejected: 'נדחה', error: 'שגיאה' } as Record<string, string>,
  kind: {
    inbound: 'רשומות מהבנק', file: 'העלאת קובץ', bank_call: 'Lybi שאלה את הבנק', bank_answer: 'תשובת הבנק',
    handoff: 'העברה לבנק', policy_signed: 'מדיניות נחתמה', key_created: 'מפתח נוצר', key_revoked: 'מפתח בוטל',
    connection_saved: 'חיבור נשמר', connection_deleted: 'חיבור נמחק', connection_test: 'בדיקת חיבור',
    bank_connected: 'בנק חובר', test: 'ניסיון רשומה',
  } as Record<string, string>,

  // Connection modal
  connEditTitle: 'עריכת חיבור',
  connNewTitle: 'חיבור חדש לבנק',
  cName: 'שם',
  cKind: 'מתי Lybi פונה',
  cUrl: 'כתובת',
  cFields: 'שדות לשליחה',
  cFieldsHint: 'מופרדים בפסיק. * = כל השדות. כל שדה יוצא לפי המדיניות שלו.',
  cAuthHeader: 'כותרת הרשאה',
  cAuthSecret: 'ערך ההרשאה',
  cAuthKeep: 'ריק = להשאיר את הערך השמור',
  cDelete: 'מחיקה',
  cDeleteTitle: 'מחיקת חיבור',
  cDeleteBody: (n: string) => `החיבור "${n}" יימחק. Lybi לא תפנה אליו יותר.`,
  cBad: 'צריך שם וכתובת https תקינה',

  close: 'סגירה',
  cancel: 'ביטול',
  working: 'רגע…',
  failed: 'הפעולה לא הצליחה. אפשר לנסות שוב.',
};

export const TYPE_HE: Record<string, string> = {
  il_id: 'תעודת זהות', passport: 'דרכון', credit_card: 'כרטיס אשראי', iban: 'IBAN', bank_account: 'חשבון בנק',
  phone: 'טלפון', email: 'מייל', freetext: 'טקסט חופשי', fullname: 'שם', dob: 'תאריך לידה', amount: 'סכום',
  address: 'כתובת', internal: 'מידע פנימי של הבנק', plain: 'מידע רגיל',
};

export const ACTION_HE: Record<GateAction, string> = {
  pass: 'עובר כמו שהוא', hide: 'מוסתר', token: 'מוחלף באסימון', enc: 'מוצפן במפתח הבנק', conv: 'מצומצם',
};

export const ACTION_MEANING: Record<GateAction, string> = {
  pass: 'המודל רואה את הערך כמו שהוא.',
  hide: 'לא נשמר ולא מגיע לשום מקום.',
  token: 'המודל רואה סימן קבוע במקום הערך. רק הבנק יכול לפתוח אותו.',
  enc: 'נשמר נעול במפתח של הבנק. המודל לא יודע שהוא קיים.',
  conv: 'המודל רואה גרסה מצומצמת – גיל במקום תאריך, טווח במקום סכום, עיר במקום כתובת.',
};

export const BY_HE: Record<GateBy, string> = { detector: G.byDetector, name: G.byName, none: '' };

/** Types that have a "convert" (the server's detect.js canConvert). */
export const CONVERTIBLE = new Set(['credit_card', 'iban', 'phone', 'email', 'fullname', 'dob', 'amount', 'address', 'freetext']);

export const ACTIONS: GateAction[] = ['pass', 'hide', 'token', 'enc', 'conv'];
