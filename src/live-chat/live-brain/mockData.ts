/**
 * Sample Live Brain for the mock page — a wellness companion (Lybi).
 *
 * `config` is what a builder would author (agent.liveBrain). `values` is
 * what the brain / addons would have produced for the current conversation.
 * The renderer joins the two. Swapping these for a live config + a real
 * memory blob is the whole integration step.
 */

import type { LiveBrainConfig, BrainValues } from './types';

// Rich-HTML templates (author-approved static HTML + {{slot}}s). The classes
// are defined in liveBrain.css.
const MOOD_TEMPLATE = `
<div class="lb-bars">
  <div class="lb-bar">
    <div class="lb-brow"><span class="lb-lab"><i class="lb-sw" style="background:var(--lb-calm)"></i>{{calm_label}}</span><span class="lb-num">{{calm}}</span></div>
    <div class="lb-track"><div class="lb-fill" style="width:{{calm}}%;background:var(--lb-calm)"></div></div>
  </div>
  <div class="lb-bar">
    <div class="lb-brow"><span class="lb-lab"><i class="lb-sw" style="background:var(--lb-anx)"></i>{{anxious_label}}</span><span class="lb-num">{{anxious}}</span></div>
    <div class="lb-track"><div class="lb-fill" style="width:{{anxious}}%;background:var(--lb-anx)"></div></div>
  </div>
  <div class="lb-bar">
    <div class="lb-brow"><span class="lb-lab"><i class="lb-sw" style="background:var(--lb-hope)"></i>{{hopeful_label}}</span><span class="lb-num">{{hopeful}}</span></div>
    <div class="lb-track"><div class="lb-fill" style="width:{{hopeful}}%;background:var(--lb-hope)"></div></div>
  </div>
  <div class="lb-trend"><b>{{trend}}</b></div>
</div>`.trim();

const NEEDS_TEMPLATE = `
<div class="lb-needs">
  <div class="lb-donut" style="--v:{{reassurance}}"><div class="lb-dc"><b>{{reassurance}}%</b><span>{{top_label}}</span></div></div>
  <div class="lb-nlist">
    <div class="lb-n"><div class="lb-brow"><span class="lb-lab">{{a_label}}</span><span class="lb-num">{{reassurance}}%</span></div><div class="lb-track"><div class="lb-fill lb-brandfill" style="width:{{reassurance}}%"></div></div></div>
    <div class="lb-n"><div class="lb-brow"><span class="lb-lab">{{b_label}}</span><span class="lb-num">{{relief}}%</span></div><div class="lb-track"><div class="lb-fill lb-brandfill" style="width:{{relief}}%"></div></div></div>
    <div class="lb-n"><div class="lb-brow"><span class="lb-lab">{{c_label}}</span><span class="lb-num">{{info}}%</span></div><div class="lb-track"><div class="lb-fill lb-brandfill" style="width:{{info}}%"></div></div></div>
  </div>
</div>`.trim();

const MOOD_SCHEMA = [
  { name: 'calm', type: 'int', description: '0–100 how calm the user reads', fallback: '0' },
  { name: 'anxious', type: 'int', description: '0–100 anxiety in the conversation', fallback: '0' },
  { name: 'hopeful', type: 'int', description: '0–100 sense of hope', fallback: '0' },
  { name: 'trend', type: 'string', description: 'one-line direction of the mood', fallback: '—' },
] as const;

const NEEDS_SCHEMA = [
  { name: 'reassurance', type: 'int', description: 'need for reassurance 0–100', fallback: '0' },
  { name: 'relief', type: 'int', description: 'need for symptom relief 0–100', fallback: '0' },
  { name: 'info', type: 'int', description: 'need for information 0–100', fallback: '0' },
] as const;

type Lang = 'en' | 'he';

export function getMock(lang: Lang): { config: LiveBrainConfig; values: BrainValues } {
  const he = lang === 'he';

  const config: LiveBrainConfig = {
    panels: [
      {
        id: 'strategy',
        emoji: '🎯',
        title: he ? 'על מה אני מתמקדת' : "What I'm focused on",
        render: 'text',
        source: { kind: 'bind', token: '{{field:strategy}}' },
      },
      {
        id: 'feeling',
        emoji: '💗',
        title: he ? 'איך את מרגישה' : "How you're feeling",
        render: 'html',
        source: {
          kind: 'addon', output: 'html', trigger: 'message_done',
          model: 'gpt-4o-mini', historyLabel: he ? 'אחרונות 8' : 'last 8', reads: ['profile'],
        },
        description: he
          ? 'שלושה פסים — רגועה / חרדה / מלאת תקווה — עם ערך לכל אחד ושורת מגמה.'
          : 'Three mood bars — calm / anxious / hopeful — each with a value, plus a one-line trend.',
        template: MOOD_TEMPLATE,
        schema: MOOD_SCHEMA.slice(),
        fillPrompt: he
          ? 'קראי את הטון הרגשי של השיחה. החזירי אך ורק JSON: { calm, anxious, hopeful, trend }.'
          : 'Read the emotional tone of the conversation. Return ONLY this JSON: { calm, anxious, hopeful, trend }.',
      },
      {
        id: 'matters',
        emoji: '🧭',
        title: he ? 'מה חשוב לך' : 'What matters to you',
        render: 'goals',
        source: { kind: 'addon', output: 'text', trigger: 'every_n_messages:4' },
      },
      {
        id: 'profile',
        emoji: '👤',
        title: he ? 'מה אני יודעת עלייך' : 'What I know about you',
        render: 'keyvalue',
        source: { kind: 'bind', token: '{{memory:profile}}' },
      },
      {
        id: 'reading',
        emoji: '📊',
        title: he ? 'קריאת השיחה' : 'Reading the conversation',
        render: 'html',
        source: {
          kind: 'addon', output: 'html', trigger: 'field_set:intent',
          model: 'gemini-2.5-flash', historyLabel: he ? 'מאז הצ׳קפוינט' : 'since checkpoint',
        },
        description: he
          ? 'טבעת עם הצורך המרכזי + שלושה פסים של צרכים.'
          : 'A donut of the top need + three need bars.',
        template: NEEDS_TEMPLATE,
        schema: NEEDS_SCHEMA.slice(),
        fillPrompt: he
          ? 'העריכי מה המשתמשת צריכה עכשיו. החזירי אך ורק JSON: { reassurance, relief, info }.'
          : "Estimate what the user needs right now. Return ONLY this JSON: { reassurance, relief, info }.",
      },
    ],
  };

  const values: BrainValues = {
    strategy: {
      text: he
        ? 'בונה אמון לפני כלים. סיפרת שקשה לך לישון, אז אני מחכה עם מעקב הסימפטומים עד שתרגישי שהקשיבו לך — ואז אציע בעדינות לתעד יחד.'
        : "Building trust before tools. You mentioned trouble sleeping, so I'm holding off on symptom tracking until you feel heard — then I'll gently offer to log it with you.",
    },
    feeling: {
      values: {
        calm: 62, anxious: 34, hopeful: 71,
        calm_label: he ? 'רגועה' : 'Calm',
        anxious_label: he ? 'חרדה' : 'Anxious',
        hopeful_label: he ? 'מלאת תקווה' : 'Hopeful',
        trend: he ? '↑ עולה מאז שהתחלנו לדבר' : '↑ lifting since we started talking',
      },
    },
    matters: {
      goals: [
        { label: he ? 'לישון עד הבוקר' : 'Sleep through the night', state: he ? 'פעיל' : 'active', done: true },
        { label: he ? 'להבין מה נורמלי' : "Understand what's normal", state: he ? 'פעיל' : 'active', done: true },
        { label: he ? 'להימנע מתרופות אם אפשר' : 'Avoid medication if possible', state: he ? 'נרשם' : 'noted', done: false },
      ],
    },
    profile: {
      pairs: [
        { k: he ? 'שלב' : 'Stage', v: he ? 'פרי-מנופאוזה' : 'perimenopause', tag: true },
        { k: he ? 'סימפטום מרכזי' : 'Top symptom', v: he ? 'נדודי שינה' : 'Insomnia' },
        { k: he ? 'מעדיפה' : 'Prefers', v: he ? 'גישות טבעיות' : 'Natural approaches' },
        { k: he ? 'רוצה שאהיה' : 'Wants me to be', v: he ? 'מרגיעה' : 'Reassuring' },
      ],
    },
    reading: {
      values: {
        reassurance: 68, relief: 52, info: 30,
        top_label: he ? 'הרגעה' : 'reassurance',
        a_label: he ? 'הרגעה' : 'Reassurance',
        b_label: he ? 'הקלה בסימפטומים' : 'Symptom relief',
        c_label: he ? 'מידע' : 'Information',
      },
    },
  };

  return { config, values };
}

// Chat backdrop for the mock (not part of the Live Brain itself).
export function mockChat(lang: Lang): { role: 'bot' | 'user'; text: string }[] {
  if (lang === 'he') {
    return [
      { role: 'bot', text: 'היי — אני ממש שמחה שאת כאן. מה מעסיק אותך לאחרונה?' },
      { role: 'user', text: 'בכנות, לא ישנתי כמו שצריך כבר שבועות ומתחילה לדאוג שמשהו לא בסדר איתי.' },
      { role: 'bot', text: 'זה נשמע מתיש, והדאגה על זה עושה את זה כבד יותר. שבועות של שינה קטועה זה מהדברים הכי שכיחים שנשים מספרות לי עליהם — את לא שבורה. תספרי לי איך הלילות נראים?' },
      { role: 'user', text: 'אני מתעוררת בערך ב-3 בלילה עם דופק מהיר ולא מצליחה לחזור לישון.' },
    ];
  }
  return [
    { role: 'bot', text: "Hey — I'm really glad you're here. What's been on your mind lately?" },
    { role: 'user', text: "Honestly I haven't slept properly in weeks and I'm starting to worry something's wrong with me." },
    { role: 'bot', text: "That sounds exhausting, and worrying on top of it makes it heavier. Weeks of broken sleep is one of the most common things women tell me about — you're not broken. Can I ask what the nights actually look like?" },
    { role: 'user', text: 'I wake around 3am, heart racing, and can’t get back down.' },
  ];
}
