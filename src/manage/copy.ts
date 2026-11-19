/**
 * The management center's own words (task #985). Hebrew only, by
 * direction: this surface is for Noa and Hila now and customers' super
 * users later, all Hebrew readers — so its strings live here instead of
 * the bilingual i18n file. Gender-neutral wording. The problem sentences
 * themselves come from the server (builder/services/customerProblems.js).
 */

export const COPY = {
  brandAlt: 'Lybi',
  centerName: 'מרכז הניהול',
  pageTitle: 'Lybi · מרכז הניהול',
  signOut: 'יציאה',
  signOutTitle: 'יציאה מהחשבון',

  // Sign-in
  signInTitle: 'כניסה למרכז הניהול',
  signInSub: 'כניסה עם חשבון Google',
  googleLoading: 'טוענים את הכניסה עם Google…',
  googleFailed: 'לא הצלחנו לטעון את הכניסה עם Google. אפשר לרענן את הדף.',
  googleOff: 'הכניסה עם Google עדיין לא מוגדרת בשרת הזה.',
  signInFailed: 'הכניסה לא הצליחה. אפשר לנסות שוב.',
  // "לכתובת <email> אין עדיין גישה" — the address sits in a <bdi> between the two.
  noAccessBefore: 'לכתובת',
  noAccessAfter: 'אין עדיין גישה', // kept on one line
  noAccessTitleUnknown: 'לכתובת הזו אין עדיין גישה',
  noAccessSub: 'כדי לקבל גישה צריך לפנות לצוות Lybi.',
  otherAccount: 'כניסה עם חשבון אחר',
  noAgents: 'עדיין אין סוכנים שאפשר להציג.',
  noAgentAccess: 'אין גישה לסוכן הזה.',
  backToMine: 'לסוכן שלי',

  // Scope + menu
  scopeLabel: 'תצוגה',
  allAgents: 'כל הסוכנים',
  menuLabel: 'תפריט',

  // The customer-problems page
  problemsMenu: 'תקלות בשיחות עם לקוחות',
  today: 'היום',
  week: 'השבוע',
  updated: 'עודכן',
  refresh: 'לבדוק שוב',

  kpiNeed: 'דורש טיפול',
  kpiOk: 'הכול תקין',
  kpiServed: 'שיחות עם לקוחות',
  kpiProblems: 'תקלות',
  kpiSlow: 'תשובות איטיות',
  kpiTest: 'תקלות בשיחות בדיקה',
  unitConversations: 'שיחות',
  unitSlow: 'יותר מדקה',
  unitTest: 'לא לקוחות אמיתיים',

  tableTitle: 'תקלות',
  groupNeed: 'דורש טיפול',
  groupInfo: 'לידיעה בלבד',
  colTime: 'זמן',
  colAgent: 'סוכן',
  colWhat: 'מה קרה',
  colKind: 'סוג',
  colStatus: 'מה לעשות',
  kind: { error: 'תקלה', no_reply: 'אין תשובה', slow_reply: 'תשובה איטית' } as Record<string, string>,
  view: 'צפייה',
  testTag: 'בדיקה',
  emptyToday: 'אין תקלות היום.',
  emptyWeek: 'אין תקלות השבוע.',
  showWeek: 'להצגת השבוע',
  // FSI/PDI keep "#313" in one piece inside the Hebrew line.
  customerNo: (id: number) => `לקוח ⁨#${id}⁩`,

  agentsTitle: 'מצב הסוכנים',
  colConversations: 'שיחות',
  colProblems: 'תקלות',
  colNeed: 'דורש טיפול',
  colAgentStatus: 'סטטוס',
  statusOk: 'תקין',
  statusAct: (n: number) => `${n} לטיפול`,

  // The conversation window
  conversationNo: (id: number) => `שיחה ⁨#${id}⁩`,
  fWhat: 'מה קרה',
  fTodo: 'מה לעשות',
  fEnded: 'איך זה נגמר',
  fWhen: 'מתי',
  fAgent: 'סוכן',
  fStarted: 'התחילה',
  fLast: 'פעילות אחרונה',
  fMessages: 'הודעות',
  fMessagesValue: (all: number, customer: number) => `${all} (${customer} של הלקוח)`,
  fPhase: 'שלב בשיחה',
  fKind: 'סוג שיחה',
  realCustomer: 'לקוח אמיתי',
  testConversation: 'שיחת בדיקה',
  lastMessages: 'ההודעות האחרונות',
  roleCustomer: 'לקוח',
  roleAgent: 'סוכן',
  investigate: 'חקירה ב־Builder',
  close: 'סגירה',
  convLoading: 'טוענים את השיחה…',
  convFailed: 'לא הצלחנו לטעון את פרטי השיחה.',
  noConversation: 'לתקלה הזו אין שיחה.',
  noMessages: 'אין הודעות להצגה.',

  // The users page (#999, #982, #991)
  usersMenu: 'משתמשים',
  realTitle: 'לקוחות אמיתיים',
  testTitle: 'משתמשי בדיקה',
  testHint: 'צוות, בדיקות וסקריפטים',
  showTest: 'הצגה',
  hideTest: 'הסתרה',
  colUser: 'משתמש',
  colPhone: 'טלפון',
  colCreated: 'נוצר',
  colLastActive: 'פעילות אחרונה',
  colActions: 'פעולות',
  noName: 'ללא שם',
  suspendedTag: 'מושעה',
  sharedTag: 'גם בסוכנים אחרים',
  sharedTitle: 'המשתמש משויך גם לסוכנים אחרים, ולכן אפשר לשנות אותו רק ב־Admin',
  actSuspend: 'השעיה',
  actReactivate: 'החזרה',
  actMakeReal: 'לקוח אמיתי',
  actMakeTest: 'לבדיקות',
  actDelete: 'מחיקה',
  emptyReal: 'אין עדיין לקוחות אמיתיים.',
  emptyTest: 'אין משתמשי בדיקה.',
  usersTruncated: (n: number) => `מוצגים ${n} המשתמשים שהיו פעילים לאחרונה`,
  testUser: 'משתמש בדיקה',

  // Confirming an action
  confirmSuspendTitle: (name: string) => `להשעות את ${name}?`,
  confirmSuspendBody: 'לא יהיה אפשר לשוחח עם הסוכן עד שיחזירו את המשתמש. שום דבר לא נמחק.',
  confirmReactivateTitle: (name: string) => `להחזיר את ${name}?`,
  confirmReactivateBody: 'אפשר יהיה לשוחח עם הסוכן שוב.',
  confirmRealTitle: (name: string) => `לסמן את ${name} כלקוח אמיתי?`,
  confirmRealBody: 'מעכשיו השיחות החדשות ייחשבו שיחות של לקוח אמיתי, והודעות אוטומטיות יוכלו להגיע אליהן. שיחות קיימות נשארות כמו שהן.',
  confirmTestTitle: (name: string) => `להעביר את ${name} למשתמשי בדיקה?`,
  confirmTestBody: 'מעכשיו השיחות החדשות ייחשבו שיחות בדיקה, והודעות אוטומטיות לא יגיעו אליהן. שיחות קיימות נשארות כמו שהן.',
  confirmDeleteTitle: (name: string) => `למחוק את ${name}?`,
  confirmDeleteBody: (n: number) => (n > 1
    ? `המשתמש ו־${n} השיחות יימחקו לצמיתות. אי אפשר לבטל את זה.`
    : n === 1
      ? 'המשתמש והשיחה יימחקו לצמיתות. אי אפשר לבטל את זה.'
      : 'המשתמש יימחק לצמיתות. אי אפשר לבטל את זה.'),
  cancel: 'ביטול',
  working: 'רגע…',
  actionFailed: 'הפעולה לא הצליחה. אפשר לנסות שוב.',
  actionShared: 'המשתמש משויך גם לסוכנים אחרים, ולכן אפשר לשנות אותו רק ב־Admin.',

  // The user window
  userNo: (id: number) => `משתמש ⁨#${id}⁩`,
  fPhone: 'טלפון',
  fEmail: 'אימייל',
  fCreated: 'נוצר',
  fConversations: 'שיחות',
  userConversations: 'שיחות עם הסוכן',
  noUserConversations: 'עדיין אין שיחות.',
  userLoading: 'טוענים את המשתמש…',
  userFailed: 'לא הצלחנו לטעון את פרטי המשתמש.',
  colConversation: 'שיחה',
  colStarted: 'התחילה',
  colMessages: 'הודעות',
  colPhase: 'שלב',
  newestConversations: (n: number) => `מוצגות ${n} השיחות האחרונות`,

  // Time
  justNow: 'ממש עכשיו',
  minutesAgo: (m: number) => (m === 1 ? 'לפני דקה' : `לפני ${m} דקות`),
  yesterdayAt: (t: string) => `אתמול, ${t}`,

  // States
  loading: 'בודקים…',
  loadFailed: 'לא הצלחנו לטעון את הנתונים. אפשר לנסות שוב בעוד רגע.',
  tryAgain: 'לנסות שוב',
};
