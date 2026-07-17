/**
 * promptGuideContent — the bilingual (EN/HE) prompt-token guide data.
 *
 * Written for NON-TECHNICAL builders. One RUNNING EXAMPLE (the
 * "Fashionista" shop agent, described in GUIDE_SCENARIO) carries
 * through the whole guide: every token shows what you WRITE and what
 * the model actually GETS, using that same pretend agent — so the
 * reader never has to imagine abstract placeholders.
 *
 * Tokens use the CURRENT names ({{targetedkb:…}}, not the legacy
 * {{enum:…}} — both work, but the guide teaches one).
 *
 * Derived from `aspect-agent-server/builder/promptPlaceholders.json`
 * (+ the `{{fieldname:…}}` family from the mention picker) — if a
 * token is added there, add a row here.
 */

export type GuideLang = 'en' | 'he';

export interface GuideText {
  en: string;
  he: string;
}

export interface GuideEntry {
  /** The literal token, with UPPERCASE placeholders (NAME, FIELD…). */
  token: string;
  /** Keyboard shortcut that opens this category's picker. */
  sigil?: string;
  what: GuideText;
  /** What you'd write — always from the running example. */
  example?: string;
  /** What the model actually receives for that example (literal). */
  renders?: string;
  /** Extra chip, e.g. "extractors only". */
  badge?: GuideText;
}

export interface GuideGroup {
  icon: string;
  title: GuideText;
  /** Optional one-line intro under the group title. */
  intro?: GuideText;
  /** Optional numbered step-by-step shown before the tokens —
   *  used by the Targeted KB group. */
  walkthrough?: GuideText[];
  entries: GuideEntry[];
}

export const GUIDE_UI: Record<string, GuideText> = {
  title:      { en: 'Prompt guide', he: 'מדריך הפרומפטים' },
  subtitle:   {
    en: 'Everything you can put inside a prompt. Tokens are replaced with real content every turn, right before the model reads it.',
    he: 'כל מה שאפשר לשלב בתוך פרומפט. הטוקנים מוחלפים בתוכן אמיתי בכל תור, רגע לפני שהמודל קורא.',
  },
  golden:     {
    en: 'The one shortcut to remember: type  /  inside any prompt — it opens a search over everything below. You never have to memorize this page.',
    he: 'הקיצור היחיד שחייבים לזכור: מקלידים  /  בתוך כל פרומפט — נפתח חיפוש על כל מה שבעמוד הזה. לא צריך לשנן כלום.',
  },
  search:     { en: 'Search tokens…', he: 'חיפוש טוקן…' },
  shortcuts:  { en: 'Keyboard shortcuts', he: 'קיצורי מקלדת' },
  shortcutsIntro: {
    en: 'Typing one of these characters inside a prompt opens a small picker for that category:',
    he: 'הקלדה של אחד התווים האלה בתוך פרומפט פותחת בורר קטן לקטגוריה שלו:',
  },
  copied:     { en: 'Copied', he: 'הועתק' },
  copyTip:    { en: 'Click to copy', he: 'לחיצה מעתיקה' },
  youWrite:   { en: 'You write', he: 'אתם כותבים' },
  modelGets:  { en: 'The model gets', he: 'המודל מקבל' },
  scenarioTitle: { en: 'Our example agent (used everywhere below)', he: 'סוכן הדוגמה שלנו (משמש בכל הדוגמאות למטה)' },
  noResults:  { en: 'Nothing matches — try a shorter search.', he: 'אין תוצאות — נסו חיפוש קצר יותר.' },
};

/** The running example, spelled out once at the top of the guide. */
export const GUIDE_SCENARIO: GuideText[] = [
  {
    en: 'Maya is a shop assistant agent for the store "Fashionista" (a parameter: storeName = Fashionista).',
    he: 'מאיה היא סוכנת מכירות של החנות "Fashionista" (פרמטר: storeName = Fashionista).',
  },
  {
    en: 'Two fields were collected in the current conversation: customer_name = "Dana", and mood = "angry".',
    he: 'בשיחה הנוכחית נאספו שני שדות: customer_name = "Dana", ו־mood = "angry".',
  },
  {
    en: 'mood is connected to a Targeted KB called "mood" with two values — happy and angry. Under each value the builder wrote a briefing (umbrella) and a section called opening_line.',
    he: 'השדה mood מחובר ל־Targeted KB בשם "mood" עם שני ערכים — happy ו־angry. תחת כל ערך כתבו תדריך כללי (umbrella) וסקשן בשם opening_line.',
  },
  {
    en: 'There\'s also a Choice field gender — its quick list gender_choices holds: male, female.',
    he: 'יש גם שדה Choice בשם gender — הרשימה שלו gender_choices מכילה: male, female.',
  },
];

export const GUIDE_SIGILS: Array<{ sigil: string; what: GuideText }> = [
  { sigil: '/',  what: { en: 'Everything — one searchable list (also {{ )', he: 'הכול — רשימה אחת עם חיפוש (גם {{ )' } },
  { sigil: '@',  what: { en: 'Memory: fields & field names', he: 'זיכרון: שדות ושמות שדות' } },
  { sigil: '#',  what: { en: 'Parameters (fixed values)', he: 'פרמטרים (ערכים קבועים)' } },
  { sigil: '!',  what: { en: 'Thinking (thinker output)', he: 'חשיבה (פלט ה־Thinker)' } },
  { sigil: '^',  what: { en: 'Persona', he: 'פרסונה' } },
  { sigil: '*',  what: { en: 'Targeted KB & Choice lists', he: 'Targeted KB ורשימות Choice' } },
  { sigil: '%',  what: { en: 'Summaries', he: 'תקצירים' } },
  { sigil: '+',  what: { en: 'Snippets (reusable text)', he: 'סניפטים (טקסט לשימוש חוזר)' } },
  { sigil: '&',  what: { en: 'Tags (groups of fields)', he: 'תגיות (קבוצות שדות)' } },
  { sigil: '~',  what: { en: 'Retrieved knowledge (KB Retriever)', he: 'ידע שאוחזר (KB Retriever)' } },
];

export const GUIDE_GROUPS: GuideGroup[] = [
  {
    icon: '💬',
    title: { en: 'Use a value inside your text', he: 'שילוב ערך בתוך הטקסט' },
    intro: {
      en: 'Drop a live value straight into a sentence.',
      he: 'משבצים ערך חי ישירות בתוך משפט.',
    },
    entries: [
      {
        token: '{{field:NAME}}',
        sigil: '@',
        what: {
          en: 'The field\'s CURRENT value in this conversation. Empty until something fills it.',
          he: 'הערך הנוכחי של השדה בשיחה הזו. ריק עד שמשהו ממלא אותו.',
        },
        example: 'Greet {{field:customer_name}} warmly.',
        renders: 'Greet Dana warmly.',
      },
      {
        token: '{{param:NAME}}',
        sigil: '#',
        what: {
          en: 'A fixed value you configured once (store name, phone number). Never changes during a conversation.',
          he: 'ערך קבוע שהגדרתם פעם אחת (שם החנות, מספר טלפון). לא משתנה במהלך שיחה.',
        },
        example: 'You work at {{param:storeName}}.',
        renders: 'You work at Fashionista.',
      },
    ],
  },
  {
    icon: '🎯',
    title: { en: 'Ask the model to FILL a field', he: 'לבקש מהמודל למלא שדה' },
    intro: {
      en: 'Any addon that returns JSON fills a field automatically when the attribute name matches the field name. When writing that instruction, insert the field\'s NAME — not its value:',
      he: 'כל תוסף שמחזיר JSON ממלא שדה אוטומטית כשהשם של המאפיין זהה לשם השדה. כשכותבים הוראה כזו משבצים את שם השדה — לא את הערך שלו:',
    },
    entries: [
      {
        token: '{{fieldname:NAME}}',
        sigil: '@',
        what: {
          en: 'Inserts the field\'s NAME as text. If the field is ever renamed, your prompt updates itself. This is how you tell a Thinker "return an attribute called X" — and the builder can then show that this Thinker fills the field.',
          he: 'משבץ את השם של השדה כטקסט. אם ישנו לשדה את השם — הפרומפט מתעדכן לבד. ככה אומרים ל־Thinker "החזר מאפיין בשם X" — והבילדר גם ידע להראות שה־Thinker הזה ממלא את השדה.',
        },
        example: 'Return a JSON attribute called {{fieldname:gender}} with the customer\'s gender.',
        renders: 'Return a JSON attribute called gender with the customer\'s gender.',
      },
      {
        token: '{{this_field}}',
        badge: { en: 'extractors only', he: 'רק בתוספי חילוץ' },
        what: {
          en: 'The name of the ONE field this addon is bound to (Field Reasoner / Interviewer). Same idea as fieldname, but automatic.',
          he: 'השם של השדה היחיד שהתוסף קשור אליו (Field Reasoner / Interviewer). כמו fieldname, רק אוטומטי.',
        },
        example: 'You are inferring the value of {{this_field}}.',
        renders: 'You are inferring the value of gender.',
      },
      {
        token: '{{enum_values}}',
        badge: { en: 'extractors only', he: 'רק בתוספי חילוץ' },
        what: {
          en: 'The allowed values of the bound field\'s list, comma-separated.',
          he: 'הערכים המותרים של הרשימה של השדה הקשור, מופרדים בפסיקים.',
        },
        example: 'Answer with one of: {{enum_values}}',
        renders: 'Answer with one of: male, female',
      },
      {
        token: '{{fields_schema}}',
        badge: { en: 'extractors only', he: 'רק בתוספי חילוץ' },
        what: {
          en: 'A ready-made list of every field this extractor collects — names, types, allowed values, instructions.',
          he: 'רשימה מוכנה של כל השדות שהתוסף אוסף — שמות, סוגים, ערכים מותרים והנחיות.',
        },
        example: '{{fields_schema}}',
        renders: '- customer_name (string): the customer\'s first name\n- mood (enum — one of: happy, angry): the customer\'s mood',
      },
      {
        token: '{{fields_current}}',
        badge: { en: 'extractors only', he: 'רק בתוספי חילוץ' },
        what: {
          en: 'What\'s already been collected (JSON of the extractor\'s fields that have values).',
          he: 'מה שכבר נאסף (JSON של השדות של התוסף שכבר יש להם ערך).',
        },
        example: '{{fields_current}}',
        renders: '{ "customer_name": "Dana", "mood": "angry" }',
      },
    ],
  },
  {
    icon: '🧠',
    title: { en: 'Bring in what the agent knows', he: 'להביא את מה שהסוכן יודע' },
    entries: [
      {
        token: '{{memory}}',
        sigil: '@',
        what: {
          en: 'Everything collected so far, all domains, as one block.',
          he: 'כל מה שנאסף עד עכשיו, מכל הדומיינים, כבלוק אחד.',
        },
        example: '## What you know\n{{memory}}',
        renders: '## What you know\n### customer\n{ "customer_name": "Dana", "mood": "angry" }',
      },
      {
        token: '{{memory:DOMAIN}}',
        sigil: '@',
        what: {
          en: 'Only one memory domain (one bucket of fields).',
          he: 'דומיין זיכרון אחד בלבד (סל אחד של שדות).',
        },
        example: '{{memory:customer}}',
        renders: '### customer\n{ "customer_name": "Dana", "mood": "angry" }',
      },
      {
        token: '{{thinking}}',
        sigil: '!',
        what: {
          en: 'Everything the Thinker(s) wrote — the agent\'s internal plan. (Also {{thinking:DOMAIN}} for one domain only.)',
          he: 'כל מה שה־Thinker כתב — התוכנית הפנימית של הסוכן. (יש גם {{thinking:DOMAIN}} לדומיין אחד בלבד.)',
        },
        example: '## Your plan\n{{thinking}}',
        renders: '## Your plan\n### strategy\n{ "pitch": "offer the sale rack first" }',
      },
      {
        token: '{{summary:NAME}}',
        sigil: '%',
        what: {
          en: 'One named conversation summary, as plain text. (Also {{summary}} for all of them.)',
          he: 'תקציר שיחה אחד לפי שם, כטקסט רגיל. (יש גם {{summary}} לכולם.)',
        },
        example: '## Where things stand\n{{summary:main}}',
        renders: '## Where things stand\nDana is looking for a red dress for a wedding, budget ~400₪.',
      },
    ],
  },
  {
    icon: '📚',
    title: { en: 'Targeted KB & Choice lists — step by step', he: 'Targeted KB ורשימות Choice — צעד אחרי צעד' },
    intro: {
      en: 'This is the most powerful (and most confusing) part, so here\'s the whole story with our example:',
      he: 'זה החלק החזק ביותר (וגם המבלבל ביותר), אז הנה כל הסיפור עם הדוגמה שלנו:',
    },
    walkthrough: [
      {
        en: 'A Targeted KB is knowledge organized BY VALUE. Our KB "mood" has two values: happy, angry.',
        he: 'Targeted KB הוא ידע שמאורגן לפי ערך. ל־KB שלנו "mood" יש שני ערכים: happy, angry.',
      },
      {
        en: 'Under EACH value you write a briefing (umbrella), and optionally sections — ours have a section called opening_line.',
        he: 'תחת כל ערך כותבים תדריך כללי (umbrella), ואפשר גם סקשנים — אצלנו יש סקשן בשם opening_line.',
      },
      {
        en: 'The FIELD "mood" is bound to this KB. Right now its value in the conversation is "angry".',
        he: 'השדה "mood" מחובר ל־KB הזה. כרגע הערך שלו בשיחה הוא "angry".',
      },
      {
        en: 'Now the choice: dc = give me what matches the CURRENT value only (it follows the conversation). targetedkb = give me EVERYTHING, for all values (good for teaching the model to choose).',
        he: 'ועכשיו הבחירה: dc = תן לי רק מה שמתאים לערך הנוכחי (עוקב אחרי השיחה). targetedkb = תן לי הכול, לכל הערכים (טוב כשרוצים ללמד את המודל לבחור).',
      },
      {
        en: 'A Choice field is the mini version: just a list of allowed values, no briefings. Its list is named after the field: gender → gender_choices. Same tokens work on it.',
        he: 'שדה Choice הוא הגרסה המיני: רק רשימת ערכים מותרים, בלי תדריכים. הרשימה נקראת על שם השדה: gender ← gender_choices. אותם טוקנים עובדים עליה.',
      },
    ],
    entries: [
      {
        token: '{{dc:FIELD}}',
        sigil: '*',
        what: {
          en: 'The briefing of the CURRENT value only. mood is "angry" right now → you get angry\'s briefing. If mood changes to "happy", the same prompt automatically gets happy\'s briefing instead.',
          he: 'התדריך של הערך הנוכחי בלבד. mood הוא "angry" עכשיו ← מקבלים את התדריך של angry. אם mood ישתנה ל־"happy", אותו פרומפט בדיוק יקבל אוטומטית את התדריך של happy.',
        },
        example: 'Guidance for the current situation:\n{{dc:mood}}',
        renders: 'Guidance for the current situation:\nThe customer is frustrated. Slow down, acknowledge the problem before offering anything.',
      },
      {
        token: '{{dc:FIELD:SECTION}}',
        sigil: '*',
        what: {
          en: 'One specific section of the current value\'s knowledge. Current mood is "angry" → you get angry\'s opening_line only.',
          he: 'סקשן אחד ספציפי מתוך הידע של הערך הנוכחי. mood הוא "angry" ← מקבלים רק את ה־opening_line של angry.',
        },
        example: 'Open with:\n{{dc:mood:opening_line}}',
        renders: 'Open with:\n"I\'m really sorry about the trouble — let\'s fix this together."',
      },
      {
        token: '{{dc:FIELD:*}}',
        sigil: '*',
        what: {
          en: 'ALL sections written under the current value, one after another with small headers.',
          he: 'כל הסקשנים שנכתבו תחת הערך הנוכחי, אחד אחרי השני עם כותרות קטנות.',
        },
        example: '{{dc:mood:*}}',
        renders: '### opening_line\n"I\'m really sorry about the trouble — let\'s fix this together."',
      },
      {
        token: '{{targetedkb:NAME}}',
        sigil: '*',
        what: {
          en: 'The briefings of EVERY value — happy AND angry — so the model can compare and choose. Typically used in an extractor that has to decide which value fits. (Older prompts may say {{enum:…}} — same thing, old name.)',
          he: 'התדריכים של כל הערכים — גם happy וגם angry — כדי שהמודל יוכל להשוות ולבחור. בדרך כלל בתוסף חילוץ שצריך להחליט איזה ערך מתאים. (בפרומפטים ישנים ייתכן {{enum:…}} — אותו דבר, השם הישן.)',
        },
        example: 'The possible moods:\n{{targetedkb:mood}}',
        renders: 'The possible moods:\n## mood\n### happy\nThe customer is upbeat — match the energy…\n### angry\nThe customer is frustrated — slow down…',
      },
      {
        token: '{{targetedkb:NAME:SECTION}}',
        sigil: '*',
        what: {
          en: 'One section across EVERY value — e.g. every value\'s opening_line side by side.',
          he: 'סקשן אחד לכל הערכים — למשל ה־opening_line של כל ערך, זה לצד זה.',
        },
        example: '{{targetedkb:mood:opening_line}}',
        renders: '## mood — opening_line\n### happy\n"Great to see you! …"\n### angry\n"I\'m really sorry about the trouble …"',
      },
      {
        token: '{{targetedkb:NAME:values}}',
        sigil: '*',
        what: {
          en: 'Just the value names, comma-separated. For Choice fields this is the everyday form — remember the list is called <field>_choices.',
          he: 'רק שמות הערכים, מופרדים בפסיקים. עבור שדות Choice זו הצורה היומיומית — זכרו שהרשימה נקראת <field>_choices.',
        },
        example: 'Return one of: {{targetedkb:gender_choices:values}}',
        renders: 'Return one of: male, female',
      },
    ],
  },
  {
    icon: '🎭',
    title: { en: 'Personality', he: 'אישיות' },
    entries: [
      {
        token: '{{persona}}',
        sigil: '^',
        what: {
          en: 'The agent\'s persona text (every persona that applies to this addon).',
          he: 'טקסט הפרסונה של הסוכן (כל פרסונה שחלה על התוסף הזה).',
        },
        example: '{{persona}}',
        renders: '## Persona\nYou are Maya — warm, direct, never pushy…',
      },
      {
        token: '{{persona:NAME}}',
        sigil: '^',
        what: {
          en: 'One specific persona by name, even if it isn\'t assigned to this addon.',
          he: 'פרסונה ספציפית לפי שם, גם אם היא לא משויכת לתוסף הזה.',
        },
        example: '{{persona:sales}}',
        renders: 'When selling, lead with benefits, never list more than two options…',
      },
    ],
  },
  {
    icon: '➕',
    title: { en: 'Reusable text blocks', he: 'בלוקים של טקסט לשימוש חוזר' },
    entries: [
      {
        token: '{{snippet:NAME}}',
        sigil: '+',
        what: {
          en: 'A block of text you wrote once and reuse in many prompts. Can be conditional (renders only when its filter matches — otherwise disappears). Snippets can contain other tokens.',
          he: 'בלוק טקסט שכתבתם פעם אחת ומשתמשים בו בהרבה פרומפטים. יכול להיות מותנה (מופיע רק כשהפילטר שלו מתקיים — אחרת נעלם). סניפט יכול להכיל טוקנים אחרים.',
        },
        example: '{{snippet:legal_disclaimer}}',
        renders: 'All prices include VAT. Returns within 30 days with a receipt.',
      },
    ],
  },
  {
    icon: '🏷️',
    title: { en: 'Groups of fields (tags)', he: 'קבוצות שדות (תגיות)' },
    intro: {
      en: 'A tag groups fields from different domains under one name — say mood and urgency are both tagged "signals":',
      he: 'תגית מקבצת שדות מדומיינים שונים תחת שם אחד — נגיד ש־mood ו־urgency מתויגים "signals":',
    },
    entries: [
      {
        token: '{{tag:NAME}}',
        sigil: '&',
        what: {
          en: 'A ready-made block describing every field carrying this tag (name + instructions).',
          he: 'בלוק מוכן שמתאר את כל השדות עם התגית הזו (שם + הנחיות).',
        },
        example: '{{tag:signals}}',
        renders: '### tag — signals\n- mood — the customer\'s mood\n- urgency — how urgent the purchase is',
      },
      {
        token: '{{tag:NAME:values}}',
        sigil: '&',
        what: {
          en: 'The current values of those fields, as name: value pairs. Skips empty ones.',
          he: 'הערכים הנוכחיים של השדות האלה, כזוגות שם: ערך. מדלג על ריקים.',
        },
        example: 'Current signals — {{tag:signals:values}}',
        renders: 'Current signals — mood: angry',
      },
      {
        token: '{{tag:NAME:names}}',
        sigil: '&',
        what: {
          en: 'Just the field names, comma-separated.',
          he: 'רק שמות השדות, מופרדים בפסיקים.',
        },
        example: 'Watch: {{tag:signals:names}}',
        renders: 'Watch: mood, urgency',
      },
    ],
  },
  {
    icon: '🔎',
    title: { en: 'Retrieved knowledge', he: 'ידע שאוחזר' },
    entries: [
      {
        token: '{{kb:NAME}}',
        sigil: '~',
        what: {
          en: 'The documents a KB Retriever addon fetched this turn into its named slot. Never blank — shows a "nothing found" line when empty.',
          he: 'המסמכים שתוסף KB Retriever שלף בתור הזה לתוך המשבצת שלו. אף פעם לא ריק — מציג "לא נמצא מידע" כשאין תוצאות.',
        },
        example: 'Answer using only this knowledge:\n{{kb:docs}}',
        renders: 'Answer using only this knowledge:\n[Returns policy.pdf] Items may be returned within 30 days…',
      },
    ],
  },
];
