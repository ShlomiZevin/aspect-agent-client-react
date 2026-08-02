/**
 * Self-contained He/En dictionary for the Live chat — ported from
 * Noa's mockup `I18N` plus a few extra keys for the report modal,
 * delete confirms, toasts and the agent-not-ready states.
 *
 * Deliberately local (not the app-wide i18n) so this surface stays
 * decoupled and shippable on its own.
 */

export type Lang = 'he' | 'en';

export interface Dict {
  brain: string;
  brainTitle: string;
  brainSub: string;
  /** Live Brain header strapline, under the LIVE BRAIN wordmark. */
  brainStrap: string;
  profiler: string;
  profTitle: string;
  profSub: string;
  history: string;
  newChat: string;
  settings: string;
  setLang: string;
  setTheme: string;
  light: string;
  dark: string;
  setClient: string;
  setVersion: string;
  setMode: string;
  normal: string;
  hint: string;
  think: string;
  report: string;
  placeholder: string;
  // extra (not in the mockup)
  thinking: string;
  quickTitle: string;
  /** Welcome/empty-state headline (Noa: "I run a conversation, not a form"). */
  welcomeIntro: string;
  /** Placeholder inside the centered welcome composer card. */
  welcomePlaceholder: string;
  /** Send button label (text pill in the welcome card). */
  send: string;
  refresh: string;
  sendCtrlEnter: string;
  /** Live Brain TEXT panel — expand / collapse a clamped body. */
  showMore: string;
  showLess: string;
  viewOnSite: string;
  openFullChat: string;
  openInBuilder: string;
  rename: string;
  loginTitle: string;
  loginSub: string;
  loginName: string;
  loginPass: string;
  loginBtn: string;
  loginError: string;
  logout: string;
  select: string;
  deleteChat: string;
  deleteChatConfirm: string;
  deleteManyConfirm: string;
  deleteN: string;
  deleteMsg: string;
  deleteFromHere: string;
  deleteMsgConfirm: string;
  deleteFromHereConfirm: string;
  cancel: string;
  delete: string;
  reportBug: string;
  reportTask: string;
  bug: string;
  task: string;
  linkedMsg: string;
  title: string;
  details: string;
  titlePh: string;
  detailsPh: string;
  yourName: string;
  yourNamePh: string;
  attachShot: string;
  attachShotHint: string;
  createBug: string;
  createTask: string;
  bugCreated: string;
  taskCreated: string;
  newChatStarted: string;
  groupToday: string;
  groupWeek: string;
  groupOlder: string;
  notReadyMissingTitle: string;
  notReadyMissingSub: string;
  notReadyMissingCta: string;
  notReadyNoActiveTitle: string;
  notReadyNoActiveSub: string;
  notReadyNoActiveCta: string;
  loadError: string;
}

export const I18N: Record<Lang, Dict> = {
  he: {
    brain: 'המוח החי',
    brainTitle: 'המוח החי של השיחה',
    brainSub: 'כאן יוצג תהליך הקבלת-החלטות החי: מודלים פעילים, מטרות, ניהול הקשר ומצב רגשי. יאופיין בהמשך.',
    brainStrap: 'למה ליבי אומרת מה שהיא אומרת',
    profiler: 'פרופיל השיחה',
    profTitle: 'פרופיל הלקוח המתפתח',
    profSub: 'כאן יוצג הפרופיל שנבנה תוך כדי השיחה: צרכים, העדפות, הקשר ומסע מתפתח. יאופיין בהמשך.',
    history: 'היסטוריית שיחות',
    newChat: 'שיחה חדשה',
    settings: 'הגדרות הדגמה',
    setLang: 'שפה / כיוון',
    setTheme: 'מצב תצוגה',
    light: 'בהיר',
    dark: 'כהה',
    setClient: 'לקוח (לוגו ומיתוג)',
    setVersion: 'גרסת הדגמה',
    setMode: 'מצב הרצה',
    normal: 'רגיל',
    hint: 'מסך הדגמה · Lybi — The Intelligent Relationship Platform',
    think: 'תהליך חשיבה',
    report: 'דווח',
    placeholder: 'כתוב/כתבי לליבי…',
    thinking: 'חושב…',
    quickTitle: 'איך אפשר לעזור?',
    welcomeIntro: 'אני ליבי. אני מנהלת שיחה, לא טופס.',
    welcomePlaceholder: 'ספרו לי במילים שלכם מה מביא אתכם…',
    send: 'שליחה',
    refresh: 'רענון',
    sendCtrlEnter: 'שליחה עם Ctrl+Enter',
    showMore: 'הצג עוד',
    showLess: 'הצג פחות',
    viewOnSite: 'תצוגה באתר (הטמעה)',
    openFullChat: 'פתיחת הצ׳אט במסך מלא',
    openInBuilder: 'פתח ב-Builder',
    rename: 'שינוי שם',
    loginTitle: 'כניסה ל-{agent}',
    loginSub: 'הסיסמה היא מספר הטלפון איתו נרשמתם',
    loginName: 'שם',
    loginPass: 'סיסמה',
    loginBtn: 'כניסה',
    loginError: 'שם או סיסמה שגויים',
    logout: 'התנתקות',
    select: 'בחירה',
    deleteChat: 'מחיקת שיחה',
    deleteChatConfirm: 'למחוק את השיחה?',
    deleteManyConfirm: 'למחוק {n} שיחות?',
    deleteN: 'מחיקה ({n})',
    deleteMsg: 'מחק הודעה',
    deleteFromHere: 'מחק מכאן ומטה',
    deleteMsgConfirm: 'למחוק את ההודעה הזו?',
    deleteFromHereConfirm: 'למחוק את ההודעה הזו ואת כל מה שאחריה?',
    cancel: 'ביטול',
    delete: 'מחק',
    reportBug: 'דיווח באג',
    reportTask: 'יצירת טאסק',
    bug: 'באג',
    task: 'טאסק',
    linkedMsg: 'הודעה מקושרת',
    title: 'כותרת',
    details: 'פירוט',
    titlePh: 'תיאור קצר…',
    detailsPh: 'מה קרה / מה צריך לקרות…',
    yourName: 'השם שלך',
    yourNamePh: 'מי פותח את הדיווח?',
    attachShot: '📎 צירוף צילום מסך',
    attachShotHint: 'אפשר גם להדביק (Ctrl+V) צילום מסך ישירות',
    createBug: 'צור באג',
    createTask: 'צור טאסק',
    bugCreated: 'הבאג נוצר',
    taskCreated: 'הטאסק נוצר',
    newChatStarted: 'שיחה חדשה נפתחה',
    groupToday: 'היום',
    groupWeek: '7 ימים אחרונים',
    groupOlder: 'ישן יותר',
    notReadyMissingTitle: 'אין כאן סוכן עדיין',
    notReadyMissingSub: 'הסוכן הזה לא קיים ב-Builder. צרו אותו כדי לעלות ל-Live.',
    notReadyMissingCta: 'צור ב-Builder',
    notReadyNoActiveTitle: 'אין גרסה פעילה',
    notReadyNoActiveSub: 'כדי לעלות ל-Live צריך לשמור גרסה פעילה (Active) לסוכן.',
    notReadyNoActiveCta: 'פתח ב-Builder',
    loadError: 'טעינת הסוכן נכשלה',
  },
  en: {
    brain: 'Live Brain',
    brainTitle: "The conversation's live brain",
    brainSub: 'Live decisioning will show here: active models, goals, context management and emotional state. To be specified.',
    brainStrap: 'why I’m saying what I’m saying',
    profiler: 'Conversation Profile',
    profTitle: 'The evolving customer profile',
    profSub: 'The profile built mid-conversation will show here: needs, preferences, context and evolving journey. To be specified.',
    history: 'Chat history',
    newChat: 'New chat',
    settings: 'Demo settings',
    setLang: 'Language / Direction',
    setTheme: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    setClient: 'Client (logo & branding)',
    setVersion: 'Demo version',
    setMode: 'Run mode',
    normal: 'Normal',
    hint: 'Demo screen · Lybi — The Intelligent Relationship Platform',
    think: 'Reasoning',
    report: 'Report',
    placeholder: 'Write to Lybi…',
    thinking: 'Thinking…',
    quickTitle: 'How can I help?',
    welcomeIntro: "I'm Lybi. I run a conversation, not a form.",
    welcomePlaceholder: 'Tell me in your own words what brings you here…',
    send: 'Send',
    refresh: 'Refresh',
    sendCtrlEnter: 'Send with Ctrl+Enter',
    showMore: 'Show more',
    showLess: 'Show less',
    viewOnSite: 'View on site (embed)',
    openFullChat: 'Open full chat',
    openInBuilder: 'Open in builder',
    rename: 'Rename',
    loginTitle: 'Sign in to {agent}',
    loginSub: 'Your password is the phone number you registered with',
    loginName: 'Name',
    loginPass: 'Password',
    loginBtn: 'Sign in',
    loginError: 'Wrong name or password',
    logout: 'Log out',
    select: 'Select',
    deleteChat: 'Delete chat',
    deleteChatConfirm: 'Delete this chat?',
    deleteManyConfirm: 'Delete {n} chats?',
    deleteN: 'Delete ({n})',
    deleteMsg: 'Delete message',
    deleteFromHere: 'Delete from here down',
    deleteMsgConfirm: 'Delete this message?',
    deleteFromHereConfirm: 'Delete this message and everything after it?',
    cancel: 'Cancel',
    delete: 'Delete',
    reportBug: 'Report bug',
    reportTask: 'Create task',
    bug: 'Bug',
    task: 'Task',
    linkedMsg: 'Linked message',
    title: 'Title',
    details: 'Details',
    titlePh: 'Short description…',
    detailsPh: 'What happened / what should happen…',
    yourName: 'Your name',
    yourNamePh: 'Who is opening this report?',
    attachShot: '📎 Attach screenshot',
    attachShotHint: 'You can also paste (Ctrl+V) a screenshot directly',
    createBug: 'Create bug',
    createTask: 'Create task',
    bugCreated: 'Bug created',
    taskCreated: 'Task created',
    newChatStarted: 'New chat started',
    groupToday: 'Today',
    groupWeek: 'Last 7 days',
    groupOlder: 'Older',
    notReadyMissingTitle: 'No agent here yet',
    notReadyMissingSub: "This agent doesn't exist in the builder. Create it to go live.",
    notReadyMissingCta: 'Create in builder',
    notReadyNoActiveTitle: 'No active version',
    notReadyNoActiveSub: 'Publish an active version of this agent to go live.',
    notReadyNoActiveCta: 'Open in builder',
    loadError: 'Failed to load agent',
  },
};

export function dirOf(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'he' ? 'rtl' : 'ltr';
}
