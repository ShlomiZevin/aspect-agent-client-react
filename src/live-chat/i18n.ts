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
  refresh: string;
  sendCtrlEnter: string;
  viewOnSite: string;
  openInBuilder: string;
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
    placeholder: 'כתוב/כתבי הודעה…',
    thinking: 'חושב…',
    quickTitle: 'איך אפשר לעזור?',
    refresh: 'רענון',
    sendCtrlEnter: 'שליחה עם Ctrl+Enter',
    viewOnSite: 'תצוגה באתר (הטמעה)',
    openInBuilder: 'פתח ב-Builder',
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
    placeholder: 'Type a message…',
    thinking: 'Thinking…',
    quickTitle: 'How can I help?',
    refresh: 'Refresh',
    sendCtrlEnter: 'Send with Ctrl+Enter',
    viewOnSite: 'View on site (embed)',
    openInBuilder: 'Open in builder',
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
