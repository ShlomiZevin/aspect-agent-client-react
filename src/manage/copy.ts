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

  // The world chooser (top of the right panel)
  worldsTitle: 'מה להציג',
  allAgents: 'כל הסוכנים',
  allAgentsSub: 'כל הסוכנים שלך יחד',
  statusOk: 'תקין',
  statusAct: (n: number) => (n === 1 ? 'שיחה אחת לטיפול' : `${n} לטיפול`),
  thisViewTitle: 'בתצוגה הזו',
  teamView: 'תצוגת צוות',
  teamViewExit: 'יציאה מתצוגת צוות',
  switchWorld: 'מעבר בין התצוגות',

  // The customer-problems page
  problemsMenu: 'תקלות בשיחות עם לקוחות',
  kicker: 'מה קורה אצל',
  today: 'היום',
  week: 'השבוע',
  todayWord: 'היום',
  weekWord: 'השבוע',
  agentFilterLabel: 'סוכן:',
  checkedAt: 'נבדק לאחרונה:',
  refresh: 'לבדוק שוב',
  headlineTag: 'מה חשוב עכשיו',

  needOne: 'יש שיחה אחת שדורשת את תשומת הלב',
  needMany: (n: number) => `יש ${n} שיחות שדורשות את תשומת הלב`,
  needSub: (served: number, need: number, when: string) =>
    `מתוך ${served} שיחות עם לקוחות ${when}, ${need === 1 ? 'שיחה אחת צריכה' : `${need} צריכות`} בדיקה שלך. כל השאר עברו כרגיל.`,
  calmTitle: (when: string) => `${when} הכול תקין`,
  calmSmallSub: (n: number) => (n === 1 ? 'הייתה תקלה קטנה אחת, והיא טופלה מעצמה. אין צורך בפעולה מצדך.' : `היו ${n} תקלות קטנות, והן טופלו מעצמן. אין צורך בפעולה מצדך.`),
  calmSub: (scope: string) => `לא זוהו תקלות בשיחות עם לקוחות ${scope}. אין צורך בפעולה מצדך.`,
  scopeAll: 'בכל הסוכנים שלך',
  scopeAgent: 'אצל הסוכן הזה',

  boxNeed: 'דורש את שלך:',
  boxOk: 'הכול תקין:',
  conversations: (n: number) => (n === 1 ? 'שיחה אחת' : `${n} שיחות`),

  listNeedTitle: 'השיחות שדורשות טיפול',
  listNeedEmpty: 'אין שיחות שדורשות טיפול.',
  listOkTitle: 'לידיעה בלבד – לא צריך לעשות כלום',
  earlierTitle: 'מה היה מוקדם יותר השבוע',

  quickTitle: 'במבט מהיר',
  quickSub: (when: string, scope: string) => `${when} · ${scope}`,
  quickConversations: 'שיחות עם לקוחות',
  quickProblems: 'תקלות',
  quickSlow: 'תשובות שלקחו יותר מדקה',
  quickTest: 'תקלות בשיחות בדיקה',

  agentsTitle: (when: string) => `${when} בסוכנים`,
  agentsSub: 'כך נראה כל אחד מהסוכנים שלך.',
  agentLine: (conv: number, problems: number) =>
    `שיחות: ${conv}  |  תקלות: ${problems}`,

  lastMessage: 'ההודעה האחרונה של הלקוח:',
  testTag: 'שיחת בדיקה',
  openConversation: 'לצפייה בשיחה',
  technical: 'פרטים טכניים',
  // FSI/PDI keep "#313" in one piece inside the Hebrew line.
  customerNo: (id: number) => `לקוח ⁨#${id}⁩`,

  // Time
  justNow: 'ממש עכשיו',
  minutesAgo: (m: number) => (m === 1 ? 'לפני דקה' : `לפני ${m} דקות`),
  todayAt: (t: string) => `היום, ${t}`,
  yesterdayAt: (t: string) => `אתמול, ${t}`,

  // States
  loading: 'בודקים…',
  loadFailed: 'לא הצלחנו לטעון את הנתונים. אפשר לנסות שוב בעוד רגע.',
  noAgent: 'לא מצאנו סוכן בכתובת הזו.',

  // The "all" gate
  gateTitle: 'כל הסוכנים — לצוות Lybi בלבד',
  gateText: 'צריך להקליד את קוד הצוות כדי לראות את כל הסוכנים יחד.',
  gatePlaceholder: 'קוד צוות',
  gateButton: 'כניסה',
  gateWrong: 'הקוד לא נכון',
};
