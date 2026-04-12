import { useState } from 'react';
import s from './FreedaLegacyFlowPage.module.css';

/* ========== Tiny reusable pieces ========== */

const Badge = ({ type, children }: { type: string; children: React.ReactNode }) => {
  const cls: Record<string, string> = {
    fixed: s.badgeFixed, ai: s.badgeAi, router: s.badgeRouter, custom: s.badgeCustom,
    onit: s.badgeOnit, demo: s.badgeDemo, both: s.badgeBoth, unused: s.badgeUnused,
  };
  return <span className={`${s.badge} ${cls[type] || ''}`}>{children}</span>;
};

const FlowNode = ({ type, children }: { type: string; children: React.ReactNode }) => {
  const cls: Record<string, string> = {
    router: s.flowNodeRouter, fixed: s.flowNodeFixed, ai: s.flowNodeAi, custom: s.flowNodeCustom,
  };
  return <span className={`${s.flowNode} ${cls[type] || ''}`}>{children}</span>;
};

const Arrow = () => <span className={s.flowArrow}>&rarr;</span>;

const He = ({ children }: { children: React.ReactNode }) => (
  <div className={`${s.textPreview} ${s.heText}`}>{children}</div>
);
const En = ({ children }: { children: React.ReactNode }) => (
  <div className={`${s.textPreview} ${s.enText}`}>{children}</div>
);
const HeOld = ({ children }: { children: React.ReactNode }) => (
  <div className={`${s.textPreview} ${s.heText} ${s.textPreviewOld}`}>{children}</div>
);
const HeNew = ({ children }: { children: React.ReactNode }) => (
  <div className={`${s.textPreview} ${s.heText} ${s.textPreviewNew}`}>{children}</div>
);
const EnOld = ({ children }: { children: React.ReactNode }) => (
  <div className={`${s.textPreview} ${s.enText} ${s.textPreviewOld}`}>{children}</div>
);
const EnNew = ({ children }: { children: React.ReactNode }) => (
  <div className={`${s.textPreview} ${s.enText} ${s.textPreviewNew}`}>{children}</div>
);

const Tag = ({ type, children }: { type: string; children: React.ReactNode }) => {
  const cls: Record<string, string> = {
    delete: s.tagDelete, change: s.tagChange, add: s.tagAdd, keep: s.tagKeep, bug: s.tagBug,
  };
  return <span className={`${s.changeTag} ${cls[type] || ''}`}>{children}</span>;
};

const Code = ({ children }: { children: React.ReactNode }) => <code className={s.codeRef}>{children}</code>;
const Key = ({ children }: { children: React.ReactNode }) => <span className={s.keyCode}>{children}</span>;

/* ========== PAGE 1: Current State ========== */

function CurrentStatePage() {
  return (
    <>
      <h1 className={s.pageTitle}>Current Active Flows &mdash; Complete Mapping</h1>
      <p className={s.subtitle}>Freeda legacy system (WhatsApp bot). All text from <Code>bot-content.ts</Code>, flow logic from <Code>engine-flows/</Code>.</p>

      {/* Overview Stats */}
      <h2 className={s.sectionTitle}>1. Overview</h2>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--fl-accent)' }}>2</div><div className={s.statLabel}>Active Flows (ONIT + DEMO)</div></div>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--fl-green)' }}>2</div><div className={s.statLabel}>Languages (HE + EN)</div></div>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--fl-orange)' }}>~23</div><div className={s.statLabel}>Active Flow Steps</div></div>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--fl-blue)' }}>100</div><div className={s.statLabel}>BotContentKey Entries</div></div>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--fl-red)' }}>12+</div><div className={s.statLabel}>Unused / Legacy Keys</div></div>
      </div>

      {/* Key files */}
      <div className={s.card}>
        <div className={s.cardTitle}>Key Source Files</div>
        <ul>
          <li><Code>bot-content.ts</Code> &mdash; All fixed text (EN + HE), ~600 lines</li>
          <li><Code>flow-content.ts</Code> &mdash; Maps keys to &#123;en, he&#125; for runtime language selection</li>
          <li><Code>onboarding-flow.ts</Code> &mdash; Main onboarding routing (ONIT vs DEMO)</li>
          <li><Code>name-age-flow.ts</Code> &mdash; Name &amp; age collection steps (AI-powered)</li>
          <li><Code>status-flows.ts</Code> &mdash; Menstrual status collection &amp; stopped-reason</li>
          <li><Code>calculateStage.ts</Code> &mdash; Menopause stage calculation logic</li>
          <li><Code>assessment.ts</Code> &mdash; 4-group symptom intake (vasomotor, emotional, cognitive, physical)</li>
          <li><Code>top-symptoms-steps.ts</Code> &mdash; Top-3 selection + impact rating</li>
          <li><Code>general-flow.ts</Code> &mdash; Post-assessment open AI conversation</li>
          <li><Code>tenant-config.ts</Code> &mdash; Tenant-specific AI instructions (ONIT doctor scheduling)</li>
          <li><Code>nudges.ts</Code> &mdash; Timed nudge / reminder definitions</li>
        </ul>
      </div>

      {/* Tenant routing */}
      <div className={s.card}>
        <div className={s.cardTitle}>Tenant Routing Logic</div>
        <p>Entry point: <Code>obStart</Code> &rarr; checks <Code>state.context.tenant</Code></p>
        <ul>
          <li><strong>"onit"</strong> &rarr; ONIT flow (name pre-assigned from Firestore)</li>
          <li><strong>"demo"</strong> (default) &rarr; DEMO flow (collects name, shows 48h demo notice)</li>
        </ul>
        <p style={{ marginTop: 8 }}><strong>Language detection:</strong> First user message scanned for Hebrew Unicode chars. Hebrew &rarr; "he", else &rarr; "en".</p>
      </div>

      {/* Flow Diagrams */}
      <h2 className={s.sectionTitle}>2. Visual Flow Diagram</h2>
      <div className={s.card}>
        <div className={s.cardTitle}>ONIT Flow Path</div>
        <div className={s.flowDiagram}>
          <FlowNode type="router">obStart</FlowNode><Arrow />
          <FlowNode type="fixed">obStartOnit<br /><small>INTRO (4 msgs)</small></FlowNode><Arrow />
          <FlowNode type="ai">collectAge<br /><small>ASK_AGE + AI</small></FlowNode><Arrow />
          <FlowNode type="ai">menstrualStatus<br /><small>+ AI</small></FlowNode><Arrow />
          <FlowNode type="custom">calculateStage()</FlowNode><Arrow />
          <span className={s.flowLabel}>[Assessment]</span>
        </div>

        <div className={s.cardTitle} style={{ marginTop: 16 }}>DEMO Flow Path</div>
        <div className={s.flowDiagram}>
          <FlowNode type="router">obStart</FlowNode><Arrow />
          <FlowNode type="fixed">obStartDemo<br /><small>INTRO (4 msgs)</small></FlowNode><Arrow />
          <FlowNode type="ai">collectName<br /><small>ASK_NAME + AI</small></FlowNode><Arrow />
          <FlowNode type="fixed">afterName<br /><small>(2-3 msgs)</small></FlowNode><Arrow />
          <FlowNode type="ai">collectAge<br /><small>ASK_AGE + AI</small></FlowNode><Arrow />
          <FlowNode type="fixed">postNameIntro<br /><small>(4 msgs)</small></FlowNode><Arrow />
          <FlowNode type="ai">menstrualStatus</FlowNode><Arrow />
          <FlowNode type="custom">calculateStage()</FlowNode><Arrow />
          <span className={s.flowLabel}>[Assessment]</span>
        </div>

        <div className={s.cardTitle} style={{ marginTop: 16 }}>Assessment Path (Both Flows Converge)</div>
        <div className={s.flowDiagram}>
          <FlowNode type="custom">intakeStart</FlowNode><Arrow />
          <FlowNode type="ai">Vasomotor</FlowNode><Arrow />
          <FlowNode type="ai">Emotional</FlowNode><Arrow />
          <FlowNode type="ai">Cognitive</FlowNode><Arrow />
          <FlowNode type="ai">Physical</FlowNode><Arrow />
          <FlowNode type="router">Gateway</FlowNode><Arrow />
          <FlowNode type="ai">Top 3 (if &gt;3)</FlowNode><Arrow />
          <FlowNode type="ai">Impact (1-5)</FlowNode><Arrow />
          <FlowNode type="fixed">Summary Intro</FlowNode><Arrow />
          <FlowNode type="custom">Generate Report</FlowNode><Arrow />
          <FlowNode type="fixed">Report Link</FlowNode><Arrow />
          <FlowNode type="ai">General AMA</FlowNode>
        </div>

        <div className={s.cardTitle} style={{ marginTop: 16 }}>Branching Points</div>
        <div className={s.flowDiagram}>
          <FlowNode type="ai">menstrualStatus</FlowNode><Arrow />
          <span className={s.flowLabel}>age&lt;40 &amp; regular &rarr;</span>
          <FlowNode type="fixed"><span style={{ color: 'var(--fl-red)' }}>intakeTooYoung (EXIT)</span></FlowNode>
        </div>
        <div className={s.flowDiagram}>
          <FlowNode type="ai">menstrualStatus</FlowNode><Arrow />
          <span className={s.flowLabel}>stopped &rarr;</span>
          <FlowNode type="ai">stoppedReason</FlowNode><Arrow />
          <FlowNode type="custom">calculateStage()</FlowNode>
        </div>
        <div className={s.flowDiagram}>
          <FlowNode type="router">TopSymptomsGateway</FlowNode><Arrow />
          <span className={s.flowLabel}>&gt;3 symptoms &rarr; Top3 &rarr; Impact | 1-3 &rarr; Impact | 0 &rarr; Summary</span>
        </div>

        <div className={s.legend}>
          <div className={s.legendItem}><FlowNode type="router">router</FlowNode> Branching logic</div>
          <div className={s.legendItem}><FlowNode type="fixed">fixed</FlowNode> Fixed text (send-message)</div>
          <div className={s.legendItem}><FlowNode type="ai">ai</FlowNode> Fixed intro + AI prompt</div>
          <div className={s.legendItem}><FlowNode type="custom">custom</FlowNode> Custom function</div>
        </div>
      </div>

      {/* Stage Calculation */}
      <h2 className={s.sectionTitle}>3. Menopause Stage Calculation</h2>
      <div className={s.card}>
        <div className={s.cardTitle}>calculateStage() logic</div>
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr><th>Menstrual Status</th><th>Stopped Reason</th><th>Months Stopped</th><th>Calculated Stage</th><th>Assessment Message</th></tr>
            </thead>
            <tbody>
              <tr><td>regular</td><td>&mdash;</td><td>&mdash;</td><td>PREMENOPAUSE</td><td rowSpan={2}>MIGHT_WITH_TRANSITION</td></tr>
              <tr><td>regular + age&lt;40</td><td>&mdash;</td><td>&mdash;</td><td>&#x26A0; intakeTooYoung EXIT</td></tr>
              <tr><td>irregular</td><td>&mdash;</td><td>&mdash;</td><td>PERIMENOPAUSE</td><td>PROBABLY_WITH_TRANSITION</td></tr>
              <tr><td>stopped</td><td>a/&#x05D0; (natural)</td><td>&lt;12</td><td>PERIMENOPAUSE</td><td>PROBABLY_WITH_TRANSITION</td></tr>
              <tr><td>stopped</td><td>a/&#x05D0; (natural)</td><td>&ge;12</td><td>POSTMENOPAUSE</td><td>PROBABLY_WITH_TRANSITION</td></tr>
              <tr><td>stopped</td><td>b/&#x05D1; (bilateral oophorectomy)</td><td>&mdash;</td><td>SURGICAL_MENOPAUSE</td><td>PROBABLY_WITH_TRANSITION</td></tr>
              <tr><td>stopped</td><td>c/&#x05D2; (hysterectomy only)</td><td>&mdash;</td><td>UNKNOWN</td><td>MIGHT_WITH_TRANSITION</td></tr>
              <tr><td>stopped</td><td>d/&#x05D3; (hormone therapy)</td><td>&mdash;</td><td>POSTMENOPAUSE</td><td>PROBABLY_WITH_TRANSITION</td></tr>
              <tr><td>stopped</td><td>e/&#x05D4; (contraception)</td><td>&mdash;</td><td>UNKNOWN</td><td>MIGHT_WITH_TRANSITION</td></tr>
              <tr><td>stopped</td><td>f/&#x05D5; (chemo/radiation)</td><td>&mdash;</td><td>UNKNOWN</td><td>MIGHT_WITH_TRANSITION</td></tr>
              <tr><td>stopped</td><td>g/&#x05D6; (other)</td><td>&mdash;</td><td>UNKNOWN</td><td>MIGHT_WITH_TRANSITION</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete Step-by-Step Table */}
      <h2 className={s.sectionTitle}>4. Complete Step-by-Step Flow Table</h2>

      <div className={s.legend}>
        <div className={s.legendItem}><Badge type="fixed">Fixed Text</Badge> Hardcoded bot message</div>
        <div className={s.legendItem}><Badge type="ai">AI Prompt</Badge> AI generates response</div>
        <div className={s.legendItem}><Badge type="router">Router</Badge> Branching logic</div>
        <div className={s.legendItem}><Badge type="custom">Custom</Badge> Custom function</div>
        <div className={s.legendItem}><Badge type="onit">ONIT</Badge> ONIT only</div>
        <div className={s.legendItem}><Badge type="demo">DEMO</Badge> DEMO only</div>
        <div className={s.legendItem}><Badge type="both">BOTH</Badge> Both flows</div>
      </div>

      <div className={s.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Category</th>
              <th>Step ID</th>
              <th>Content Key</th>
              <th>Type</th>
              <th>Flow</th>
              <th>Current Hebrew Text</th>
              <th>Current English Text</th>
              <th>Notes / Prompt Details</th>
            </tr>
          </thead>
          <tbody>
            {/* ENTRY POINT */}
            <tr className={s.sectionHeader}><td colSpan={9}>ENTRY POINT &amp; ROUTING</td></tr>
            <tr>
              <td>1</td>
              <td>Router</td>
              <td><Code>obStart</Code></td>
              <td>&mdash;</td>
              <td><Badge type="router">Router</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
              <td>Routes based on <Code>state.context.tenant</Code>: "onit" &rarr; obStartOnit, else &rarr; obStartDemo</td>
            </tr>

            {/* ONIT ONBOARDING */}
            <tr className={s.sectionHeader}><td colSpan={9}>ONIT ONBOARDING PATH</td></tr>
            <tr>
              <td>2</td>
              <td>Onboarding (ONIT)</td>
              <td><Code>obStartOnit</Code></td>
              <td><Key>ONBOARDING_INTRO_ONIT</Key></td>
              <td><Badge type="fixed">Fixed Text</Badge><br />(4 messages)</td>
              <td><Badge type="onit">ONIT</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> שלום &#123;&#123;name&#125;&#125;, אני פרידה, הוכשרתי כמומחית מבוססת בינה מלאכותית (AI) בנושא מנפאוזה, ואני פה לסייע לך לנווט בביטחון את המסע שלך בגיל הַמֵעֵבֶר. תחשבי עליי כעל השותפה שלך למסע הזה...</He>
                <He><strong>Msg2:</strong> אני יכולה לסייע לך בהבנת התסמינים, לשאול את השאלות הנכונות מול הרופא/ה, להמליץ על טיפולים אפשריים ולכוון אותך למידע שמתאים בדיוק לך. אני כאן גם כדי להקשיב...</He>
                <He><strong>Msg3:</strong> חשוב שתדעי – פרידה היא עוזרת דיגיטלית מבוססת בינה מלאכותית, והיא לא מחליפה ייעוץ רפואי אישי... 💬 בכך שאת ממשיכה את השיחה, את מאשרת שקראת...</He>
                <He><strong>Msg4:</strong> בואי נתחיל בכמה שאלות, שיעזרו לי להכיר אותך טוב יותר... השלב הזה לוקח בערך 7-10 דקות... מוכנה להתחיל?</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> Hello &#123;&#123;name&#125;&#125;, I'm Freeda, an AI-powered menopause specialist. I'm here to help you navigate your menopause journey with confidence. Think of me as your partner in this journey...</En>
                <En><strong>Msg2:</strong> I can help you understand your symptoms, ask the right questions to your doctor, recommend possible treatments... I'm also here to listen...</En>
                <En><strong>Msg3:</strong> Important to know – Freeda is an AI-powered digital assistant and does not replace personal medical advice... 💬 By continuing this conversation, you confirm...</En>
                <En><strong>Msg4:</strong> Let's start with a few questions... This step takes about 7-10 minutes... Ready to start?</En>
              </td>
              <td>Name pre-assigned from future-tenants Firestore. Includes disclaimer + consent + questions intro all in one step.</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Onboarding (ONIT)</td>
              <td><Code>obOnitCollectAge</Code></td>
              <td><Key>ONBOARDING_ASK_AGE</Key></td>
              <td><Badge type="fixed">Fixed</Badge> + <Badge type="ai">AI</Badge></td>
              <td><Badge type="onit">ONIT</Badge></td>
              <td className={s.textCell}><He>בת כמה את?</He></td>
              <td className={s.textCell}><En>Could you please tell me your age?</En></td>
              <td><strong>Prompt-dependent:</strong> AI collects age via function calling. Prompt: "Ask 'What is your age?' never 'How old are you'"</td>
            </tr>

            {/* DEMO ONBOARDING */}
            <tr className={s.sectionHeader}><td colSpan={9}>DEMO ONBOARDING PATH</td></tr>
            <tr>
              <td>4</td>
              <td>Onboarding (Demo)</td>
              <td><Code>obStartDemo</Code></td>
              <td><Key>ONBOARDING_INTRO_DEMO</Key></td>
              <td><Badge type="fixed">Fixed Text</Badge><br />(4 messages)</td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> היי, אני פרידה – בת הברית שלך במסע גיל הַמֵעֵבֶר 🌼 אני כאן כדי ללוות אותך בכל שלב, עם הבנה, כלים, ותמיכה – כדי שיהיה לך יותר ברור, יותר בטוח, והרבה פחות לבד.</He>
                <He><strong>Msg2:</strong> אני יכולה לסייע לך בהבנת התסמינים, לשאול את השאלות הנכונות מול הרופא/ה, להמליץ על טיפולים אפשריים ולכוון אותך למידע שמתאים בדיוק לך. אני כאן גם כדי להקשיב...</He>
                <He><strong>Msg3:</strong> חשוב שתדעי – פרידה היא עוזרת דיגיטלית... 💬 בכך שאת ממשיכה את השיחה... לפרטים המלאים: [link]</He>
                <He><strong>Msg4:</strong> שימי לב – את כרגע משוחחת עם גרסת הדמו של פרידה הזמינה לך ל-48 שעות הקרובות...</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> Hi, I'm Freeda – your ally in the menopause journey 🌼 I'm here to accompany you every step of the way...</En>
                <En><strong>Msg2:</strong> I can help you understand your symptoms... I'm also here to listen...</En>
                <En><strong>Msg3:</strong> Important to know – Freeda is an AI-powered digital assistant... 💬 By continuing... For full details: [link]</En>
                <En><strong>Msg4:</strong> Please note – you're currently chatting with the demo version of Freeda, available for the next 48 hours...</En>
              </td>
              <td>Msg4 is the 48h demo notice. ONIT doesn't have this.</td>
            </tr>
            <tr>
              <td>5</td>
              <td>Onboarding (Demo)</td>
              <td><Code>obDemoCollectName</Code></td>
              <td><Key>ONBOARDING_ASK_NAME</Key></td>
              <td><Badge type="fixed">Fixed</Badge> + <Badge type="ai">AI</Badge></td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td className={s.textCell}><He>נתחיל בדבר הכי חשוב – איך לקרוא לך?</He></td>
              <td className={s.textCell}><En>First things first, what's your name, or how would you like me to address you?</En></td>
              <td><strong>Prompt-dependent:</strong> AI collects name via function calling</td>
            </tr>
            <tr>
              <td>6</td>
              <td>Onboarding (Demo)</td>
              <td><Code>obDemoAfterName</Code></td>
              <td><Key>AFTER_NAME_DEMO</Key></td>
              <td><Badge type="fixed">Fixed Text</Badge><br />(HE: 2 msgs, EN: 3 msgs)</td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> נעים להכיר, &#123;&#123;name&#125;&#125; 🌼</He>
                <He><strong>Msg2:</strong> בואי נתחיל בכמה שאלות, שיעזרו לי להכיר אותך טוב יותר, ולהכין לך מפת דרכים ראשונית... השלב הזה לוקח בערך 7-10 דקות... מוכנה להתחיל?</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> Hello &#123;&#123;name&#125;&#125;, it's lovely to meet you 🌼. As we delve deeper into understanding your menopause journey, please know that your privacy is paramount to us...</En>
                <En><strong>Msg2:</strong> Let's begin with a few questions. I'll explain things as we go. This part takes around 7–10 minutes...</En>
                <En><strong>Msg3:</strong> At the end of this step, you'll receive your personalised roadmap... It's not a diagnosis, it's a strong starting point...</En>
              </td>
              <td>&#x26A0; HE has 2 messages, EN has 3. EN Msg3 about roadmap has no HE equivalent.</td>
            </tr>
            <tr>
              <td>7</td>
              <td>Onboarding (Demo)</td>
              <td><Code>obDemoCollectAge</Code></td>
              <td><Key>ONBOARDING_ASK_AGE</Key></td>
              <td><Badge type="fixed">Fixed</Badge> + <Badge type="ai">AI</Badge></td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td className={s.textCell}><He>בת כמה את?</He></td>
              <td className={s.textCell}><En>Could you please tell me your age?</En></td>
              <td><strong>Prompt-dependent:</strong> AI collects age. Same key as ONIT row #3</td>
            </tr>
            <tr>
              <td>8</td>
              <td>Onboarding (Demo)</td>
              <td><Code>postNameIntro</Code></td>
              <td><Key>POST_NAME_AGE_INTRO</Key></td>
              <td><Badge type="fixed">Fixed Text</Badge><br />(4 messages)</td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> שלום &#123;&#123;name&#125;&#125;, נעים מאוד להכיר אותך 🌼</He>
                <He><strong>Msg2:</strong> בואי נתחיל עם כמה שאלות. אני אסביר דברים תוך כדי.</He>
                <He><strong>Msg3:</strong> החלק הזה לוקח בערך 7-10 דקות, ואנחנו יכולות לעשות הפסקה בכל זמן. אני זוכרת כל מה שאנחנו מדברות עליו...</He>
                <He><strong>Msg4:</strong> בסוף השלב הזה, תקבלי את מפת הדרכים האישית שלך... זה לא אבחנה, זה נקודת התחלה חזקה...</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> Hello &#123;&#123;name&#125;&#125;, it's lovely to meet you 🌼</En>
                <En><strong>Msg2:</strong> Let's begin with a few questions. I'll explain things as we go.</En>
                <En><strong>Msg3:</strong> This part takes around 7–10 minutes, and we can pause anytime. I remember everything we talk about...</En>
                <En><strong>Msg4:</strong> At the end of this step, you'll receive your personalised roadmap... It's not a diagnosis, it's a strong starting point...</En>
              </td>
              <td>&#x26A0; <strong>Content duplication:</strong> This step overlaps heavily with row #6 (obDemoAfterName). User sees both sequentially in DEMO flow.</td>
            </tr>

            {/* CONVERGED: MENSTRUAL STATUS */}
            <tr className={s.sectionHeader}><td colSpan={9}>CONVERGED PATH: MENSTRUAL STATUS (BOTH FLOWS)</td></tr>
            <tr>
              <td>9</td>
              <td>Assessment (Menstrual)</td>
              <td><Code>menstrualStatus</Code></td>
              <td><Key>MENSTRUAL_STATUS_INQUIRY</Key></td>
              <td><Badge type="fixed">Fixed</Badge> + <Badge type="ai">AI</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}><He>עכשיו, הייתי רוצה להבין יותר על המחזור החודשי שלך. את יכולה להגיד לי אם הווסת שלך סדירה, האם היא הפכה לא סדירה, או שהיא נפסקה? זכרי, לא סדיר יכול גם להיות שינויים בכמות, לא רק בתדירות.</He></td>
              <td className={s.textCell}><En>Now, I would like to understand more about your menstrual cycle. Could you tell me if your periods are regular, have they become irregular, or have they stopped? Remember, irregular can also mean changes in volume, not just frequency.</En></td>
              <td><strong>Prompt-dependent:</strong> AI collects menstrualStatus enum (regular/irregular/stopped). <strong>Branches:</strong> age&lt;40+regular &rarr; intakeTooYoung; stopped &rarr; stoppedReason; else &rarr; preAssessment</td>
            </tr>
            <tr>
              <td>10</td>
              <td>Branch: Too Young</td>
              <td><Code>intakeTooYoung</Code></td>
              <td><Key>INTAKE_TOO_YOUNG</Key></td>
              <td><Badge type="fixed">Fixed Text</Badge><br />(4 messages)</td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> בהתחשב בכך שאת מתחת לגיל 40 והמחזור שלך סדיר, לא סביר שאת עוברת לגיל המעבר כל כך מוקדם...</He>
                <He><strong>Msg2:</strong> אבל לפני שנפרדות, &#123;&#123;name&#125;&#125;, אם השיחה שלנו עזרה לך, זה יהיה חשוב לי מאוד אם תוכלי לשתף את Freeda.ai...</He>
                <He><strong>Msg3:</strong> https://app.freeda.ai/share/&#123;&#123;userCode&#125;&#125;</He>
                <He><strong>Msg4:</strong> תודה שבטחת בפרידה, ותמיד זכרי, אנחנו כאן מתי שתצטרכי תמיכה. 🙏🏼💜</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> Considering you're under 40 and your period is regular, it's unlikely you're transitioning into menopause this early...</En>
                <En><strong>Msg2:</strong> But before we part ways, &#123;&#123;name&#125;&#125;... share Freeda.ai...</En>
                <En><strong>Msg3:</strong> https://app.freeda.ai/share/&#123;&#123;userCode&#125;&#125;</En>
                <En><strong>Msg4:</strong> Thank you for trusting Freeda... 🙏🏼💜</En>
              </td>
              <td><strong>Condition:</strong> age&lt;40 AND regular. Effectively an exit with re-entry.</td>
            </tr>
            <tr>
              <td>11</td>
              <td>Branch: Stopped</td>
              <td><Code>stoppedReason</Code></td>
              <td><Key>MENSTRUAL_STATUS_STOPPED_OPTIONS</Key></td>
              <td><Badge type="fixed">Fixed</Badge> + <Badge type="ai">AI</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}><He>אנא הסבירי למה הפסקת לוסת.{'\n'}א) הווסת שלי נפסקה באופן טבעי.{'\n'}ב) ניתוח - כריתת שחלות דו-צדדית...{'\n'}ג) ניתוח - כריתת רחם{'\n'}ד) אני בטיפול הורמונלי{'\n'}ה) גלולות מניעה רציפות...{'\n'}ו) עקב כימותרפיה או הקרנות{'\n'}ז) אחר</He></td>
              <td className={s.textCell}><En>Please explain why you stopped menstruating.{'\n'}a) My periods stopped naturally.{'\n'}b) Surgical - Bilateral Oophorectomy...{'\n'}c) Surgical - Hysterectomy{'\n'}d) I am on hormone therapy{'\n'}e) Continuous birth control pills...{'\n'}f) Due to chemotherapy or radiation therapy{'\n'}g) Other</En></td>
              <td><strong>Prompt-dependent:</strong> AI collects stoppedReason (a-g / &#x05D0;-&#x05D6;) + monthsSinceStopped + optional stoppedReasonOther. <strong>Condition:</strong> menstrualStatus === "stopped"</td>
            </tr>
            <tr>
              <td>12</td>
              <td>Pre-Assessment</td>
              <td><Code>preAssessmentStep</Code></td>
              <td><Key>PROBABLY / MIGHT_WITH_TRANSITION</Key></td>
              <td><Badge type="custom">Custom</Badge> + <Badge type="fixed">Fixed</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}>
                <He><strong>If probably:</strong> את כנראה במסע גיל המעבר שלך. כדי לעזור לזהות את השלב הנוכחי שלך ואת התסמינים שאת חווה, אני אצטרך לשאול כמה שאלות נוספות.</He>
                <He><strong>If might:</strong> את עשויה להיות במסע גיל המעבר שלך...</He>
              </td>
              <td className={s.textCell}>
                <En><strong>If probably:</strong> You're probably in your menopause journey. To help pinpoint your current stage and the symptoms you're experiencing, I'll need to ask a few additional questions.</En>
                <En><strong>If might:</strong> You might be in your menopause journey...</En>
              </td>
              <td>Runs <Code>calculateStage()</Code>, sets stage in context, sends one of two messages based on calculated stage.</td>
            </tr>

            {/* SYMPTOM INTAKE */}
            <tr className={s.sectionHeader}><td colSpan={9}>SYMPTOM INTAKE (4 GROUPS, CONVERGED PATH)</td></tr>
            <tr>
              <td>13</td>
              <td>Intake Start</td>
              <td><Code>intakeStart</Code></td>
              <td>&mdash;</td>
              <td><Badge type="custom">Custom</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
              <td>Empty routing step &rarr; intakeSymptomsVasomotor</td>
            </tr>
            <tr>
              <td>14</td>
              <td>Vasomotor Symptoms</td>
              <td><Code>intakeSymptomsVasomotor</Code></td>
              <td><Key>INTAKE_VASOMOTOR_SYMPTOMS</Key></td>
              <td><Badge type="fixed">Fixed</Badge> (HE:6, EN:5 msgs) + <Badge type="ai">AI</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> &#123;&#123;name&#125;&#125;, הייתי רוצה שעכשיו נעבור על התסמינים השונים של גיל הַמֵעֵבֶר, כדי שנוכל להבין לעומק אילו תסמינים את חווה.</He>
                <He><strong>Msg2:</strong> מהניסיון שלי, הרבה נשים חוות תסמינים שהן אינן מקשרות לגיל הַמֵעֵבֶר... אין שום סיבה לסבול מתסמינים שיש להם פתרון.</He>
                <He><strong>Msg3:</strong> אז אני צריכה אותך קצת סבלנית, וקשובה לעצמך... רוצה שתיהיה לנו את התמונה המלאה...</He>
                <He><strong>Msg4:</strong> בואי נתחיל עם הקבוצה הראשונה... תסמיני הסלב... 70%-80%... גלי החום, גלי קור, הזעות לילה וקשיי שינה</He>
                <He><strong>Msg5:</strong> [image: vasomotor-illustration-he.png]</He>
                <He><strong>Msg6:</strong> האם את חווה חלק מתמינים אלה?</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> &#123;&#123;name&#125;&#125;, let's explore menopause symptoms to see if you might be experiencing any of them.</En>
                <En><strong>Msg2:</strong> A lot of us go through things we can't quite explain, changes we chalk up to stress, age, or "just life."...</En>
                <En><strong>Msg3:</strong> Hot flushes, night sweats, and disrupted sleep are the most common symptoms, with 70%-80%...</En>
                <En><strong>Msg4:</strong> [image: vasomotor-illustration.png]</En>
                <En><strong>Msg5:</strong> Have you noticed any of these symptoms?</En>
              </td>
              <td><strong>Prompt-dependent:</strong> AI collects symptoms[] + acknowledgementReply via collectSymptoms function. YES/NO/AWK keys exist but are <strong>commented out</strong> &mdash; AI generates response. Nudges: 30min AI + 3day template.</td>
            </tr>
            <tr>
              <td>15</td>
              <td>Emotional Symptoms</td>
              <td><Code>intakeSymptomsEmotional</Code></td>
              <td><Key>INTAKE_EMOTIONAL_SYMPTOMS</Key></td>
              <td><Badge type="fixed">Fixed</Badge> (5 msgs) + <Badge type="ai">AI</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> בואי נעבור לקבוצה הבאה של התסמינים, התסמינים הריגשים</He>
                <He><strong>Msg2:</strong> [image: emotional-illustration-he.png]</He>
                <He><strong>Msg3:</strong> כל אישה חווה את השינויים הרגשיים האלה בצורה קצת שונה... הנה כמה תיאורים שנשים משתמשות בהם...</He>
                <He><strong>Msg4:</strong> [image: emotional-descriptors-he.png]</He>
                <He><strong>Msg5:</strong> האם שמת לב לשינויים רגשיים אצלך בתקופה האחרונה?</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> Let us examine other groups of symptoms. Emotional Symptoms 💕</En>
                <En><strong>Msg2:</strong> [image: emotional-illustration.png]</En>
                <En><strong>Msg3:</strong> Every woman experiences these emotional shifts uniquely. Here are some descriptors women often use...</En>
                <En><strong>Msg4:</strong> [image: emotional-descriptors.png]</En>
                <En><strong>Msg5:</strong> Have you noticed any emotional changes in yourself?</En>
              </td>
              <td><strong>Prompt-dependent:</strong> Same AI pattern as vasomotor. YES/NO/AWK keys not used in flow.</td>
            </tr>
            <tr>
              <td>16</td>
              <td>Cognitive Symptoms</td>
              <td><Code>intakeSymptomsCognitive</Code></td>
              <td><Key>INTAKE_COGNITIVE_SYMPTOMS</Key></td>
              <td><Badge type="fixed">Fixed</Badge> (3 msgs) + <Badge type="ai">AI</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> בואי נעבור על תסמינים קוגניטיביים 🧠</He>
                <He><strong>Msg2:</strong> [image: cognitive-illustration-he.png]</He>
                <He><strong>Msg3:</strong> האם שמת לב לשינויים בתפקודים הקוגנטיבים לאחרונה?</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> I would like us to chat about Cognitive Symptoms 🧠.</En>
                <En><strong>Msg2:</strong> [image: cognitive-illustration.png]</En>
                <En><strong>Msg3:</strong> Have you noticed any changes in your cognitive abilities recently?</En>
              </td>
              <td><strong>Prompt-dependent:</strong> Same AI pattern.</td>
            </tr>
            <tr>
              <td>17</td>
              <td>Physical Symptoms</td>
              <td><Code>intakeSymptomsPhysical</Code></td>
              <td><Key>INTAKE_PHYSICAL_SYMPTOMS</Key></td>
              <td><Badge type="fixed">Fixed</Badge> (HE:3, EN:4 msgs) + <Badge type="ai">AI</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> עכשיו הייתי רוצה לשאול אותך על תסמינים גופניים. בגוף שלנו יש קולטנים לאסטרוגן כמעט בכל איבר... חילוף חומרים, חוזק העצמות, בריאות הלב, עור ועוד... אל תדאגי אם הרשימה הבאה נראית קצת ארוכה...</He>
                <He><strong>Msg2:</strong> [image: physical-descriptors-he.png]</He>
                <He><strong>Msg3:</strong> האם חווית שינויים פיזיים כאלה או אחרים לאחרונה?</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> I would like to ask you now about Physical Symptoms. Oestrogen receptors are found throughout our bodies... metabolism, skin, bone strength, heart health...</En>
                <En><strong>Msg2:</strong> Don't worry if the next list seems daunting - many women only experience a few...</En>
                <En><strong>Msg3:</strong> [image: physical-descriptors.png]</En>
                <En><strong>Msg4:</strong> Have you experienced any physical changes?</En>
              </td>
              <td><strong>Prompt-dependent:</strong> Same AI pattern. Note HE combines intro+disclaimer in 1 msg, EN splits into 2.</td>
            </tr>

            {/* TOP SYMPTOMS */}
            <tr className={s.sectionHeader}><td colSpan={9}>TOP SYMPTOMS &amp; IMPACT</td></tr>
            <tr>
              <td>18</td>
              <td>Gateway</td>
              <td><Code>intakeTopSymptomsGateway</Code></td>
              <td>&mdash;</td>
              <td><Badge type="router">Router</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
              <td>Counts total unique symptoms across all 4 groups. &gt;3 &rarr; Top3. 1-3 &rarr; Impact (auto-sets all as top). 0 &rarr; SummaryIntro (skips impact, sets impact=1).</td>
            </tr>
            <tr>
              <td>19</td>
              <td>Top 3 Selection</td>
              <td><Code>intakeTop3Symptoms</Code></td>
              <td><Key>INTAKE_TOP_SYMPTOMS</Key></td>
              <td><Badge type="fixed">Fixed</Badge> (2 msgs) + <Badge type="ai">AI</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> אנחנו כמעט סיימנו 💬.</He>
                <He><strong>Msg2:</strong> עכשיו שעברנו על כל התסמינים השונים, את יכולה לזהות את התסמינים שמטרידים אותך הכי הרבה?</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> We are almost done 💬.</En>
                <En><strong>Msg2:</strong> Now that we've covered all the various symptoms, could you pinpoint the symptoms that bother you the most?</En>
              </td>
              <td><strong>Prompt-dependent:</strong> AI collects top symptoms. Only shown if &gt;3 total symptoms.</td>
            </tr>
            <tr>
              <td>20</td>
              <td>Impact Rating</td>
              <td><Code>intakeTop3SymptomsImpact</Code></td>
              <td><Key>INTAKE_TOP_SYMPTOMS_IMPACT</Key></td>
              <td><Badge type="fixed">Fixed</Badge> + <Badge type="ai">AI</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}><He>בסקאלה של 1-5, כמה משמעותית התסמינים האלה משפיעים על איכות החיים שלך? כאשר 1 זה 'כמעט לא מורגש' ו-5 זה 'מאוד מפריע, הופך את החיים למאתגרים מאוד.'</He></td>
              <td className={s.textCell}><En>On a scale of 1-5, how significantly do these symptoms impact the quality of your life? With 1 being 'barely noticeable' and 5 being 'extremely disruptive, making life very challenging.'</En></td>
              <td><strong>Prompt-dependent:</strong> AI collects symptomsImpact (1-5) + acknowledgementReply. Skipped if 0 symptoms.</td>
            </tr>

            {/* SUMMARY & REPORT */}
            <tr className={s.sectionHeader}><td colSpan={9}>SUMMARY, REPORT &amp; POST-ASSESSMENT</td></tr>
            <tr>
              <td>21</td>
              <td>Summary Intro</td>
              <td><Code>intakeSummaryIntro</Code></td>
              <td><Key>INTAKE_SUMMARY_INTRO</Key></td>
              <td><Badge type="fixed">Fixed Text</Badge><br />(2 msgs)</td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}>
                <He><strong>Msg1:</strong> זהו סיימנו את השלב של השאלות, תודה על הסבלנות והפתיחות. אני אנתח את המידע ואכין לך מפת דרכים אישית... בזמן שאני מעבדת את הנתונים, חשוב לי שתדעי – המסע שלך לניהול איכות החיים שלך מתחיל עכשיו. נעבור את זה יחד...</He>
                <He><strong>Msg2:</strong> אני רוצה שתחשבי על המפה שתקבלי כנקודת המוצא של המסע שלך... כל אחת חווה את השינויים בגיל הַמֵעֵבֶר אחרת... את הנהגת, אני כאן כדי לסייע לך בניווט. 🧭</He>
              </td>
              <td className={s.textCell}>
                <En><strong>Msg1:</strong> Okay, I've got everything I need. Based on what you've shared so far, I'm now preparing your personalised roadmap. This will take just a few moments.</En>
                <En><strong>Msg2:</strong> Think of it as your starting point... Every woman's experience is different. There's no one way to do this. You're in the driver's seat. I'm here to help you steer. 🧭</En>
              </td>
              <td></td>
            </tr>
            <tr>
              <td>22</td>
              <td>Report Generate</td>
              <td><Code>intakeSummaryGenerate</Code></td>
              <td>&mdash;</td>
              <td><Badge type="custom">Custom</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
              <td>Calls <Code>reportingService.generateReportData()</Code>, saves to Firestore, generates shareable link. Fires assessmentCompleted analytics event. 3.5s delay.</td>
            </tr>
            <tr>
              <td>23</td>
              <td>Report Link</td>
              <td><Code>intakeSummaryReport</Code></td>
              <td><Key>INTAKE_SUMMARY_REPORT</Key></td>
              <td><Badge type="fixed">Fixed Text</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}><He>הנה הקישור לתוצאות ההערכה שלך. תסתכלי! אני בטוחה שיהיו לך הרבה שאלות בהמשך. תרגישי חופשיה להגיע - אני כאן כדי לעזור בכל דרך שאני יכולה.🙏{'\n'}&#123;&#123;reportLink&#125;&#125;</He></td>
              <td className={s.textCell}><En>Here's the link to your assessment results. Take a look! I'm sure you'll have many questions moving forward. Feel free to reach out - I'm here to help in any way that I can.🙏{'\n'}&#123;&#123;reportLink&#125;&#125;</En></td>
              <td>Next step: generalAma</td>
            </tr>
            <tr>
              <td>24</td>
              <td>General AMA</td>
              <td><Code>generalAma</Code></td>
              <td>&mdash;</td>
              <td><Badge type="ai">AI QA</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td colSpan={2}><em>Fully AI-generated. No fixed text. System prompt covers treatment discussion (HRT, lifestyle, nutrition), symptom management. Uses vector DB for article retrieval.</em></td>
              <td>Open-ended conversation. Multiple nudges. First exit &rarr; feedback step, then loops.</td>
            </tr>
            <tr>
              <td>25</td>
              <td>Feedback</td>
              <td><Code>feedback</Code></td>
              <td><Key>FEEDBACK_CONVERSATION_PREFERENCE</Key></td>
              <td><Badge type="fixed">Fixed Text</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}><He>הערה קצרה: אני כאן כדי להתאים את השיחה שלנו לטעם שלך. אל תהססי להגיד לי אם את רוצה תגובות מפורטות יותר, תגובות קצרות יותר, או גישה שונה בדיונים שלנו.</He></td>
              <td className={s.textCell}><En>A quick note: I'm here to tailor our conversation to your liking. Don't hesitate to tell me if you'd like more detailed responses, shorter responses, or a different approach in our discussions.</En></td>
              <td>One-time, triggered on first exit from generalAma. Sets feedbackSent=true. Returns to generalAma.</td>
            </tr>
            <tr>
              <td>26</td>
              <td>Post-Report Nudge</td>
              <td>(nudge)</td>
              <td><Key>NUDGE_POST_REPORT_FEEDBACK</Key></td>
              <td><Badge type="fixed">Fixed (nudge)</Badge></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td className={s.textCell}><He>היי &#123;&#123;name&#125;&#125; 🌼 האם הספקת להסתכל על הסיכום שלך? כמה נשים מוצאות את זה מרגיע. אחרות חושבות, "מאיפה אני בכלל מתחילה?" בכל מקרה, זה בסדר גמור! אני כאן כדי לעזור לך להמשיך... פשוט תגידי לי על מה את רוצה להתמקד הבא...</He></td>
              <td className={s.textCell}><En>Hi &#123;&#123;name&#125;&#125; 🌼 Did you get a chance to take a look at your summary? Some women find it reassuring. Others think, "Where do I even start?" Either way, it's completely okay! I'm here to help you keep going... Just tell me what you'd like to focus on next...</En></td>
              <td>Sent 30 min after generalAma starts, only if user hasn't started chatting yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Unused Keys */}
      <h2 className={s.sectionTitle}>5. Unused / Legacy Keys</h2>
      <div className={s.warning}>These keys are defined in <Code>bot-content.ts</Code> (both EN and HE) but are NOT wired into any active flow step. They were previously used for YES/NO/AWK branching before AI-generated acknowledgements.</div>
      <div className={s.tableWrap}>
        <table>
          <thead><tr><th>Key</th><th>EN Text</th><th>HE Text</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td><Code>INTAKE_VASOMOTOR_SYMPTOMS_YES</Code></td><td>I'm sorry to hear that, can you please specify which ones?</td><td>אני מצטערת לשמוע את זה, את יכולה בבקשה לפרט אילו?</td><td><Badge type="unused">Commented out</Badge></td></tr>
            <tr><td><Code>INTAKE_VASOMOTOR_SYMPTOMS_NO</Code></td><td>I'm happy to hear that.</td><td>אני שמחה לשמוע את זה.</td><td><Badge type="unused">Commented out</Badge></td></tr>
            <tr><td><Code>INTAKE_VASOMOTOR_SYMPTOMS_AWK</Code></td><td>Thank you for sharing 💕</td><td>תודה שחלקת איתי 💕</td><td><Badge type="unused">Commented out</Badge></td></tr>
            <tr><td><Code>INTAKE_EMOTIONAL_*</Code></td><td>YES/NO/AWK responses</td><td>YES/NO/AWK responses</td><td><Badge type="unused">Not used in flow</Badge></td></tr>
            <tr><td><Code>INTAKE_COGNITIVE_*</Code></td><td>YES/NO/AWK responses</td><td>YES/NO/AWK responses</td><td><Badge type="unused">Not used in flow</Badge></td></tr>
            <tr><td><Code>INTAKE_PHYSICAL_*</Code></td><td>YES/NO/AWK responses</td><td>YES/NO/AWK responses</td><td><Badge type="unused">Not used in flow</Badge></td></tr>
            <tr><td><Code>ONBOARDING_WELCOME</Code></td><td>Hi &#123;&#123;name&#125;&#125;, I'm Freeda...</td><td>שלום, אני פרידה...</td><td><Badge type="unused">Legacy</Badge></td></tr>
            <tr><td><Code>ONBOARDING_WELCOME_ONIT</Code></td><td>Hello &#123;&#123;name&#125;&#125;, I'm Freeda...</td><td>שלום &#123;&#123;name&#125;&#125;, אני פרידה...</td><td><Badge type="unused">Legacy (replaced by INTRO_ONIT)</Badge></td></tr>
            <tr><td><Code>ONBOARDING_WELCOME_DEMO</Code></td><td>Hi, I'm Freeda – your ally...</td><td>היי, אני פרידה – בת הברית שלך...</td><td><Badge type="unused">Legacy (replaced by INTRO_DEMO)</Badge></td></tr>
            <tr><td><Code>ONBOARDING_CAPABILITIES</Code></td><td>I can help you understand your symptoms...</td><td>אני יכולה לסייע לך בהבנת התסמינים...</td><td><Badge type="unused">Legacy (folded into INTRO)</Badge></td></tr>
            <tr><td><Code>ONBOARDING_DISCLAIMER</Code></td><td>Important to know – Freeda is an AI...</td><td>חשוב שתדעי – פרידה היא עוזרת דיגיטלית...</td><td><Badge type="unused">Legacy (folded into INTRO)</Badge></td></tr>
            <tr><td><Code>ONBOARDING_DEMO_NOTICE</Code></td><td>Please note – demo version, 48 hours...</td><td>שימי לב – גרסת הדמו...</td><td><Badge type="unused">Legacy (folded into INTRO_DEMO)</Badge></td></tr>
          </tbody>
        </table>
      </div>

      {/* ONIT Tenant Config */}
      <h2 className={s.sectionTitle}>6. ONIT Tenant-Specific AI Instructions</h2>
      <div className={s.card}>
        <div className={s.cardTitle}>tenant-config.ts &mdash; ONIT special guidelines</div>
        <p>These instructions are injected into ALL AI prompts when tenant is "onit":</p>
        <ul>
          <li><strong>Primary Goal:</strong> Doctor appointment scheduling via onitfast.com</li>
          <li><strong>When:</strong> After assessment completion, proactively offer. During assessment only if user struggles.</li>
          <li><strong>Secondary:</strong> Bone density test (DEXA) &mdash; separate from doctor appointment, no-cost add-on.</li>
          <li><strong>Hebrew examples included</strong> for doctor appointment messaging.</li>
          <li><strong>DEMO tenant:</strong> No special instructions.</li>
        </ul>
      </div>

      {/* Nudges */}
      <h2 className={s.sectionTitle}>7. Nudge / Reminder Schedule</h2>
      <div className={s.tableWrap}>
        <table>
          <thead><tr><th>Nudge</th><th>Type</th><th>Delay</th><th>Condition</th><th>Content</th></tr></thead>
          <tbody>
            <tr><td><Code>intakeNudge</Code></td><td>AI-generated</td><td>30 min</td><td>No reply during intake</td><td>AI generates follow-up based on conversation history</td></tr>
            <tr><td><Code>intakeNudge3Days</Code></td><td>WhatsApp template</td><td>3 days</td><td>No reply during intake</td><td>Pre-approved template with user name</td></tr>
            <tr><td><Code>feedbackNudge</Code></td><td>Fixed text</td><td>30 min</td><td>User hasn't started AMA</td><td>Report follow-up nudge (see row #26)</td></tr>
            <tr><td><Code>amaNudge</Code></td><td>AI-generated</td><td>Next good time (6AM-10:30AM)</td><td>No reply in AMA</td><td>AI picks topic: symptom check-in, tip feedback, question invitation</td></tr>
            <tr><td><Code>amaNudge7Days</Code></td><td>WhatsApp template</td><td>7 days</td><td>No symptom tracking</td><td>Re-engagement template</td></tr>
            <tr><td><Code>amaNudge14Days</Code></td><td>WhatsApp template</td><td>14 days</td><td>No symptom tracking</td><td>Re-engagement template</td></tr>
            <tr><td><Code>symptomTracker</Code></td><td>Step trigger</td><td>Configurable (1 week)</td><td>Symptom tracking enabled</td><td>Triggers symptom tracking flow</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ========== PAGE 2: Changes & Gaps ========== */

function ChangesPage() {
  return (
    <>
      <h1 className={s.pageTitle}>Cross-Reference &mdash; Current State vs. Requested Changes</h1>
      <p className={s.subtitle}>
        Mapping the change request against each active flow step.{' '}
        <Tag type="delete">DELETE</Tag> <Tag type="change">CHANGE TEXT</Tag> <Tag type="add">ADD NEW</Tag> <Tag type="keep">NO CHANGE</Tag> <Tag type="bug">BUG FIX</Tag>
      </p>

      <h2 className={s.sectionTitle}>Change Summary</h2>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--fl-red)' }}>~12</div><div className={s.statLabel}>Steps to DELETE / Skip</div></div>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--fl-orange)' }}>~18</div><div className={s.statLabel}>Text Changes (HE + EN)</div></div>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--fl-green)' }}>~6</div><div className={s.statLabel}>New Text to ADD</div></div>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--fl-pink)' }}>~5</div><div className={s.statLabel}>Bug Fixes</div></div>
      </div>

      <div className={s.warning}><strong>Important:</strong> This page maps requested changes against the <em>actual active code paths</em>. Some rows reference keys/steps that are already unused in the active flow (commented out). These are flagged below.</div>

      <div className={s.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Category</th>
              <th>Step ID / Key</th>
              <th>Flow</th>
              <th>Change</th>
              <th>Current HEB</th>
              <th>Requested New HEB</th>
              <th>Current EN</th>
              <th>Requested New EN</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {/* ONBOARDING INTRO */}
            <tr className={s.sectionHeader}><td colSpan={10}>ONBOARDING INTRO (DEMO &amp; ONIT)</td></tr>

            <tr className={s.changeModify}>
              <td>1</td>
              <td>Onboarding</td>
              <td><Code>obStartDemo</Code><br /><Key>INTRO_DEMO</Key> Msg1</td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td><Tag type="change">CHANGE</Tag></td>
              <td className={s.textCell}><HeOld>היי, אני פרידה – בת הברית שלך במסע גיל הַמֵעֵבֶר 🌼 אני כאן כדי ללוות אותך בכל שלב...</HeOld></td>
              <td className={s.textCell}><HeNew>היי, אני פרידה 🌼, הוכשרתי כמומחית מבוססת בינה מלאכותית (AI) לגיל המעבר, אני משלבת ידע מחקרי וקליני עם הבנה אנושית-חברתית עמוקה...</HeNew></td>
              <td className={s.textCell}><EnOld>Hi, I'm Freeda – your ally in the menopause journey 🌼...</EnOld></td>
              <td className={s.textCell}><EnNew>Hello &#123;&#123;name&#125;&#125;, I'm Freeda🌼, an AI-powered menopause specialist. I'm here to help you navigate your menopause journey with confidence.</EnNew></td>
              <td>&#x26A0; EN uses &#123;&#123;name&#125;&#125; but DEMO flow hasn't collected name yet at this step!</td>
            </tr>

            <tr className={s.changeModify}>
              <td>2</td>
              <td>Onboarding</td>
              <td><Code>obStartDemo</Code><br /><Key>INTRO_DEMO</Key> Msg2</td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td><Tag type="change">CHANGE</Tag></td>
              <td className={s.textCell}><HeOld>אני יכולה לסייע לך בהבנת התסמינים, לשאול את השאלות הנכונות מול הרופא/ה...</HeOld></td>
              <td className={s.textCell}><HeNew>תחשבי עליי כעל השותפה שלך למסע הזה 🤝 אני כאן כדי להנגיש לך מידע אמין, בגובה העיניים...</HeNew></td>
              <td className={s.textCell}><EnOld>I can help you understand your symptoms, ask the right questions...</EnOld></td>
              <td className={s.textCell}><EnNew>Think of me as your partner in this journey 🤝. I'm here to provide reliable, accessible information...</EnNew></td>
              <td></td>
            </tr>

            <tr className={s.changeModify}>
              <td>4</td>
              <td>Onboarding</td>
              <td><Code>obStartDemo</Code><br /><Key>INTRO_DEMO</Key> Msg3 (disclaimer)</td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td><Tag type="change">CHANGE</Tag></td>
              <td className={s.textCell}><HeOld>חשוב שתדעי – פרידה היא עוזרת דיגיטלית... 💬 בכך שאת ממשיכה את השיחה, את מאשרת שקראת...</HeOld></td>
              <td className={s.textCell}><HeNew>לפני שמתחילות, משהו קטן וחשוב 🌿 אני עוזרת דיגיטלית מבוססת בינה מלאכותית, לא רופאה... אני צריכה את הסכמתך כדי להמשיך. 💜</HeNew></td>
              <td className={s.textCell}><EnOld>Important to know – Freeda is an AI-powered digital assistant... 💬 By continuing...</EnOld></td>
              <td className={s.textCell}><EnNew>Before we begin, just one small thing 🌿 I'm an AI-powered digital assistant, not a doctor... I need your consent to continue. 💜</EnNew></td>
              <td>&#x26A0; Also requests adding a consent button "אני מסכימה - בואי נתחיל". Requires new step type.</td>
            </tr>

            <tr className={s.changeDelete}>
              <td>7</td>
              <td>Onboarding</td>
              <td><Key>INTRO_DEMO</Key> Msg4 (demo notice)</td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td><Tag type="delete">DELETE</Tag></td>
              <td className={s.textCell}><HeOld>שימי לב – את כרגע משוחחת עם גרסת הדמו של פרידה הזמינה לך ל-48 שעות הקרובות...</HeOld></td>
              <td>&mdash;</td>
              <td className={s.textCell}><EnOld>Please note – you're currently chatting with the demo version of Freeda, available for the next 48 hours...</EnOld></td>
              <td>&mdash;</td>
              <td>Remove 48h demo notice entirely.</td>
            </tr>

            <tr className={s.changeModify}>
              <td>8</td>
              <td>Onboarding</td>
              <td><Code>obDemoCollectName</Code><br /><Key>ASK_NAME</Key></td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td><Tag type="change">CHANGE HEB</Tag></td>
              <td className={s.textCell}><HeOld>נתחיל בדבר הכי חשוב – איך לקרוא לך?</HeOld></td>
              <td className={s.textCell}><HeNew>נתחיל בדבר הכי חשוב, איך תרצי שאקרא לך?</HeNew></td>
              <td className={s.textCell}><En>First things first, what's your name?</En></td>
              <td><Tag type="keep">NO CHANGE</Tag></td>
              <td>HEB only. Small wording tweak.</td>
            </tr>

            <tr className={s.changeModify}>
              <td>10</td>
              <td>Onboarding</td>
              <td><Code>obDemoAfterName</Code><br /><Key>AFTER_NAME_DEMO</Key></td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td><Tag type="change">CHANGE</Tag></td>
              <td className={s.textCell}>
                <HeOld>Msg1: נעים להכיר, &#123;&#123;name&#125;&#125; 🌼</HeOld>
                <HeOld>Msg2: בואי נתחיל בכמה שאלות... 7-10 דקות... מוכנה להתחיל?</HeOld>
              </td>
              <td className={s.textCell}>
                <HeNew>Msg1: (keep) Nice to meet</HeNew>
                <HeNew>Msg2: אני רוצה שנתחיל בכמה שאלות שיעזרו לי להכיר אותך יותר טוב 🤍, ולכוון אותך למידע ולפתרונות שמתאימים בדיוק לך 🎯 השלב הזה לוקח בערך 5-7 דקות...</HeNew>
              </td>
              <td className={s.textCell}>
                <EnOld>Msg1: Hello &#123;&#123;name&#125;&#125;, lovely to meet you 🌼...</EnOld>
                <EnOld>Msg3: At the end... personalised roadmap...</EnOld>
              </td>
              <td className={s.textCell}>
                <EnNew>Msg1: Nice to meet you, &#123;&#123;name&#125;&#125; 🌼</EnNew>
                <EnNew>Msg2: I'd love to start by getting to know you a little better 🤍 — so I can point you toward the information and solutions that actually fit your life 🎯 5-7 minutes...</EnNew>
                <div><Tag type="delete">DELETE Msg3</Tag> (roadmap preview)</div>
              </td>
              <td>Time changed from 7-10 to 5-7 minutes. EN Msg3 about roadmap deleted.</td>
            </tr>

            <tr className={s.changeModify}>
              <td>12</td>
              <td>Onboarding</td>
              <td><Key>ASK_AGE</Key></td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td><Tag type="change">CHANGE HEB</Tag></td>
              <td className={s.textCell}><HeOld>בת כמה את?</HeOld></td>
              <td className={s.textCell}><HeNew>תוכלי לומר לי בבקשה בת כמה את?</HeNew></td>
              <td className={s.textCell}><En>Could you please tell me your age?</En></td>
              <td><Tag type="keep">NO CHANGE</Tag></td>
              <td>HEB-only polite rewording.</td>
            </tr>

            {/* POST NAME INTRO - DELETE */}
            <tr className={s.sectionHeader}><td colSpan={10}>POST NAME INTRO (DEMO ONLY) &mdash; DELETE ENTIRELY</td></tr>
            <tr className={s.changeDelete}>
              <td>14-15</td>
              <td>Onboarding</td>
              <td><Code>postNameIntro</Code><br /><Key>POST_NAME_AGE_INTRO</Key> (all 4 messages)</td>
              <td><Badge type="demo">DEMO</Badge></td>
              <td><Tag type="delete">DELETE ALL</Tag></td>
              <td className={s.textCell}>
                <HeOld>Msg1: שלום &#123;&#123;name&#125;&#125;, נעים מאוד להכיר אותך 🌼</HeOld>
                <HeOld>Msg2-4: Questions intro, 7-10 minutes, roadmap...</HeOld>
              </td>
              <td>&mdash;</td>
              <td className={s.textCell}>
                <EnOld>Msg1-4: Hello, questions, 7-10 min, roadmap...</EnOld>
              </td>
              <td>&mdash;</td>
              <td><strong>Delete entire step.</strong> Duplicated content from obDemoAfterName. Change next step from "postNameIntro" to "menstrualStatus" directly.</td>
            </tr>

            {/* MENSTRUAL STATUS */}
            <tr className={s.sectionHeader}><td colSpan={10}>MENSTRUAL STATUS ASSESSMENT</td></tr>
            <tr className={s.changeModify}>
              <td>M1</td>
              <td>Menstrual Status</td>
              <td><Code>menstrualStatus</Code><br /><Key>MENSTRUAL_STATUS_INQUIRY</Key></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE</Tag></td>
              <td className={s.textCell}><HeOld>עכשיו, הייתי רוצה להבין יותר על המחזור החודשי שלך. את יכולה להגיד לי אם הווסת שלך סדירה...</HeOld></td>
              <td className={s.textCell}>
                <HeNew>תודה &#123;Name&#125;🌼, שינויים במחזור החודשי שלנו הם אחד המדדים החשובים ביותר...</HeNew>
                <HeNew><Tag type="add">ADD</Tag> תוכלי בבקשה לשתף אותי מה סטטוס המחזור החודשי שלך...</HeNew>
              </td>
              <td className={s.textCell}><EnOld>Now, I would like to understand more about your menstrual cycle...</EnOld></td>
              <td className={s.textCell}>
                <EnNew>Thank you for sharing &#123;name&#125;🌼 Our menstrual cycle is one of the most important signals...</EnNew>
                <EnNew><Tag type="add">ADD</Tag> I'd love to hear a little about where you're at with yours...</EnNew>
              </td>
              <td>Changes from 1 message to 2 messages (context + question).</td>
            </tr>

            <tr className={s.changeModify}>
              <td>M2</td>
              <td>Stopped Reason</td>
              <td><Key>STOPPED_OPTIONS</Key></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE</Tag></td>
              <td className={s.textCell}><HeOld>אנא הסבירי למה הפסקת לוסת. א) הווסת שלי נפסקה באופן טבעי. ב) ניתוח... ג)-ז)</HeOld></td>
              <td className={s.textCell}><HeNew>תוכלי לפרט את הסיבה להפסקת המחזור? 🩸{'\n'}1. המחזור שלי פסק באופן טבעי{'\n'}2-7. (numbered instead of lettered)</HeNew></td>
              <td className={s.textCell}><EnOld>Please explain why. a) stopped naturally... b-g)</EnOld></td>
              <td className={s.textCell}><EnNew>Why did your periods stop? 🩸{'\n'}1. stopped naturally{'\n'}2-7. (numbered)</EnNew></td>
              <td>&#x26A0; Options change from letters (a-g) to numbers (1-7). Requires code change in <Code>calculateStage()</Code> AND AI function param enum.</td>
            </tr>

            {/* TOO YOUNG */}
            <tr className={s.sectionHeader}><td colSpan={10}>TOO YOUNG EXIT</td></tr>
            <tr className={s.changeModify}>
              <td>17</td>
              <td>Too Young</td>
              <td><Key>INTAKE_TOO_YOUNG</Key> Msg1</td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE</Tag></td>
              <td className={s.textCell}><HeOld>בהתחשב בכך שאת מתחת לגיל 40...</HeOld></td>
              <td className={s.textCell}><HeNew>בהתחשב בכך שאת בת &#123;age&#125; והמחזור שלך סדיר... אני ממליצה לדון בהם עם רופא/ה.</HeNew></td>
              <td className={s.textCell}><EnOld>Considering you're under 40...</EnOld></td>
              <td className={s.textCell}><EnNew>Considering you're under &#123;age&#125;... (same but with dynamic age)</EnNew></td>
              <td>Add &#123;&#123;age&#125;&#125; template variable. Currently hardcoded "under 40".</td>
            </tr>
            <tr className={s.changeDelete}>
              <td>17b-c</td>
              <td>Too Young</td>
              <td><Key>INTAKE_TOO_YOUNG</Key> Msg2+3 (share link)</td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="delete">DELETE</Tag></td>
              <td className={s.textCell}><HeOld>אבל לפני שנפרדות... שתף את Freeda.ai... + share URL</HeOld></td>
              <td>&mdash;</td>
              <td className={s.textCell}><EnOld>Before we part ways... share Freeda.ai... + share URL</EnOld></td>
              <td>&mdash;</td>
              <td>Remove share CTA from too-young exit.</td>
            </tr>
            <tr className={s.changeModify}>
              <td>17d</td>
              <td>Too Young</td>
              <td><Key>INTAKE_TOO_YOUNG</Key> Msg4</td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE HEB</Tag></td>
              <td className={s.textCell}><HeOld>תודה שבטחת בפרידה... 🙏🏼💜</HeOld></td>
              <td className={s.textCell}><HeNew>תודה שפנית לפרידה, ונשמח לתת מענה כשזה יהיה רלוונטי🙏🏼💜</HeNew></td>
              <td className={s.textCell}><En>Thank you for trusting Freeda... 🙏🏼💜</En></td>
              <td><Tag type="keep">NO CHANGE</Tag></td>
              <td>HEB-only change.</td>
            </tr>

            {/* PRE-ASSESSMENT */}
            <tr className={s.sectionHeader}><td colSpan={10}>PRE-ASSESSMENT TRANSITION</td></tr>
            <tr className={s.changeDelete}>
              <td>PA1</td>
              <td>Pre-Assessment</td>
              <td><Code>preAssessmentStep</Code><br /><Key>PROBABLY/MIGHT_WITH_TRANSITION</Key></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="delete">DELETE</Tag></td>
              <td className={s.textCell}><HeOld>את כנראה במסע גיל המעבר שלך. כדי לעזור לזהות...</HeOld></td>
              <td>&mdash;</td>
              <td className={s.textCell}><EnOld>You're probably in your menopause journey. To help pinpoint...</EnOld></td>
              <td>&mdash;</td>
              <td>Delete message but keep <Code>calculateStage()</Code> logic running silently.</td>
            </tr>

            {/* VASOMOTOR */}
            <tr className={s.sectionHeader}><td colSpan={10}>VASOMOTOR SYMPTOMS INTAKE</td></tr>
            <tr className={s.changeModify}>
              <td>V1</td>
              <td>Vasomotor</td>
              <td><Key>VASOMOTOR_SYMPTOMS</Key> Msg2 (HE)</td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE HEB</Tag></td>
              <td className={s.textCell}><HeOld>מהניסיון שלי, הרבה נשים חוות תסמינים... אנחנו נוטות לייחס... אבל תאמיני לי...</HeOld></td>
              <td className={s.textCell}><HeNew>מהניסיון שלי, הרבה נשים חוות תסמינים... אבל חשוב להכיר את התסמינים השונים... אין שום סיבה לסבול מתסמינים שפוגעים באיכות החיים שלך,</HeNew></td>
              <td className={s.textCell}><En>A lot of us go through things we can't quite explain...</En></td>
              <td><Tag type="keep">NO CHANGE</Tag></td>
              <td>HEB-only: removes "superpower" line, adds quality-of-life framing.</td>
            </tr>
            <tr className={s.changeModify}>
              <td>V2</td>
              <td>Vasomotor</td>
              <td><Key>VASOMOTOR_SYMPTOMS</Key> Msg3 (HE)</td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE HEB</Tag></td>
              <td className={s.textCell}><HeOld>אז אני צריכה אותך קצת סבלנית... רוצה שתיהיה לנו את התמונה המלאה...</HeOld></td>
              <td className={s.textCell}><HeNew>בשאלות הבאות נתחיל להרכיב את התמונה שלב אחרי שלב... חשוב שיהיה לנו מיפוי מהימן של נקודת המוצא שלך.</HeNew></td>
              <td className={s.textCell}><En>So in the next few questions, we'll gently start putting those pieces together...</En></td>
              <td><Tag type="keep">NO CHANGE</Tag></td>
              <td>HEB-only rewording.</td>
            </tr>

            {/* SYMPTOM YES/NO/AWK BUG FIXES */}
            <tr className={s.sectionHeader}><td colSpan={10}>SYMPTOM YES/NO/AWK RESPONSES &mdash; BUG FIXES</td></tr>
            <tr className={s.changeModify}>
              <td>V-YES</td>
              <td>All symptom groups</td>
              <td><Key>*_YES_SYMPTOMS</Key></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="bug">BUG FIX</Tag></td>
              <td colSpan={4}><em>Keys exist but are NOT USED in active flow (commented out). AI generates acknowledgement instead. The bug: AI sometimes doesn't ask follow-up when user says YES without specifying symptoms.</em></td>
              <td>All 4 symptom groups use same factory function. Fix once. Options: (1) Re-enable fixed YES/NO/AWK keys, or (2) Strengthen AI prompt.</td>
            </tr>
            <tr className={s.changeModify}>
              <td>C-AWK</td>
              <td>Cognitive</td>
              <td><Key>COGNITIVE_SYMPTOMS_AWK</Key></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="bug">BUG</Tag></td>
              <td colSpan={4}><em>HEB cognitive AWK response shows symptom name twice &mdash; first in Hebrew then in English (e.g., "אני מבינה, Memory Lapses יכול להיות מאתגר").</em></td>
              <td>Fix in prompt or contextMapper.</td>
            </tr>

            {/* PHYSICAL */}
            <tr className={s.sectionHeader}><td colSpan={10}>PHYSICAL SYMPTOMS</td></tr>
            <tr className={s.changeModify}>
              <td>P1</td>
              <td>Physical</td>
              <td><Key>PHYSICAL_SYMPTOMS</Key> Msg1</td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE</Tag></td>
              <td className={s.textCell}><HeOld>עכשיו הייתי רוצה לשאול אותך על תסמינים גופניים... חילוף חומרים, חוזק העצמות, בריאות הלב... אל תדאגי...</HeOld></td>
              <td className={s.textCell}><HeNew>בואי נדבר על התסמינים הגופניים... ירידה במסת שריר וצפיפות עצם, שינויים קרדיווסקולארים, שינויים בעור, בציפריניים בשיער... חוסר היכרות עם התסמינים מביא לכך שנשים רבות מתרוצצות בין רופאים מומחים...</HeNew></td>
              <td className={s.textCell}><EnOld>I would like to ask you now about Physical Symptoms. Oestrogen receptors...</EnOld></td>
              <td className={s.textCell}><EnNew>Now let's talk the Physical symptoms. 💫 Oestrogen receptors exist in almost every organ... Metabolism, Muscle mass and bone density, Cardiovascular changes, Skin, hair, and nails... This is exactly why so many women find themselves going from specialist to specialist...</EnNew></td>
              <td>Both languages: expanded symptom categories, added "specialist shopping" framing.</td>
            </tr>
            <tr className={s.changeModify}>
              <td>P1b</td>
              <td>Physical</td>
              <td><Key>PHYSICAL_SYMPTOMS</Key> Msg2 (disclaimer)</td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE</Tag></td>
              <td className={s.textCell}><HeOld>(combined in Msg1)</HeOld></td>
              <td className={s.textCell}><HeNew><Tag type="add">ADD as separate msg:</Tag> קיימים כ- 85 סימפטומים מתועדים אבל אל דאגה רוב הנשים לא חוות יותר מ3-4 סימפטומים במקביל...</HeNew></td>
              <td className={s.textCell}><EnOld>Don't worry if the next list seems daunting - many women only experience a few...</EnOld></td>
              <td className={s.textCell}><EnNew>There are around 85 documented symptoms - but don't let that number scare you. Most women experience only 3-4 at any given time...</EnNew></td>
              <td>HEB needs split into separate message. EN rewrite with "85 symptoms" framing.</td>
            </tr>

            {/* TOP SYMPTOMS */}
            <tr className={s.sectionHeader}><td colSpan={10}>TOP SYMPTOMS &amp; IMPACT</td></tr>
            <tr className={s.changeModify}>
              <td>T1</td>
              <td>Top Symptoms</td>
              <td><Key>INTAKE_TOP_SYMPTOMS</Key></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="bug">BUG FIX HEB</Tag></td>
              <td className={s.textCell}><He>אנחנו כמעט סיימנו 💬. עכשיו שעברנו על כל התסמינים השונים...</He></td>
              <td className={s.textCell}><div className={s.warning} style={{ fontSize: 12, padding: 8 }}>BUG: In HEB flow this step is reportedly skipped entirely. Investigate flow routing for HEB path.</div></td>
              <td className={s.textCell}><En>We are almost done 💬. Now that we've covered all the various symptoms...</En></td>
              <td><Tag type="keep">NO CHANGE</Tag></td>
              <td>Bug: HEB flow skips top symptoms selection. Investigate language detection issue or routing bug.</td>
            </tr>
            <tr className={s.changeModify}>
              <td>T2</td>
              <td>Impact Rating</td>
              <td><Key>TOP_SYMPTOMS_IMPACT</Key></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE HEB</Tag></td>
              <td className={s.textCell}><HeOld>בסקאלה של 1-5... כאשר 1 זה 'כמעט לא מורגש' ו-5 זה 'מאוד מפריע...'</HeOld></td>
              <td className={s.textCell}><HeNew>כיצד היית מדרגת את מידת ההשפעה של התסמינים שמנית על איכות החיים שלך בסולם של 1 עד 5...</HeNew></td>
              <td className={s.textCell}><En>On a scale of 1-5...</En></td>
              <td><Tag type="keep">NO CHANGE</Tag></td>
              <td>HEB-only reword. More formal phrasing.</td>
            </tr>

            {/* SUMMARY */}
            <tr className={s.sectionHeader}><td colSpan={10}>SUMMARY &amp; REPORT</td></tr>
            <tr className={s.changeModify}>
              <td>S1</td>
              <td>Summary Intro</td>
              <td><Code>intakeSummaryIntro</Code><br /><Key>INTAKE_SUMMARY_INTRO</Key></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE HEB</Tag></td>
              <td className={s.textCell}><HeOld>Msg1: זהו סיימנו את השלב של השאלות... אני אנתח את המידע ואכין לך מפת דרכים אישית...</HeOld></td>
              <td className={s.textCell}>
                <HeNew>Msg1: זהו יש לי את כל המידע הנדרש כדי להכין לך מפת דרכים ראשונית שהיא למעשה נקודת המוצא של המסע שלך... אחרי שתקראי, נוכל להעמיק ולהתקדם יחד...</HeNew>
                <HeNew><Tag type="add">ADD Msg2:</Tag> כל אחת חווה את השינויים בגיל הַמֵעֵבֶר אחרת... אין דרך אחת נכונה... ואני כאן עם מידע מבוסס מחקר, וכלים מוכחים... 💕</HeNew>
              </td>
              <td className={s.textCell}><En>Okay, I've got everything I need... preparing your personalised roadmap... Think of it as your starting point...</En></td>
              <td><Tag type="keep">NO CHANGE</Tag></td>
              <td>HEB rewrite. EN stays as is.</td>
            </tr>
            <tr className={s.changeModify}>
              <td>S2</td>
              <td>Report Link</td>
              <td><Key>INTAKE_SUMMARY_REPORT</Key></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE HEB</Tag></td>
              <td className={s.textCell}><HeOld>הנה הקישור לתוצאות ההערכה שלך... אני בטוחה שיהיו לך הרבה שאלות... 🙏</HeOld></td>
              <td className={s.textCell}><HeNew>&#123;name&#125; רצ״ב הלינק למפת הדרכים הראשונית שלך, לאחר שתקראי, אני מחכה לך כאן כדי לסייע לך להתקדם על עבר איכות חיים מיטבית.</HeNew></td>
              <td className={s.textCell}><En>Here's the link to your assessment results... 🙏</En></td>
              <td><Tag type="keep">NO CHANGE</Tag></td>
              <td>HEB-only rewrite.</td>
            </tr>

            {/* NUDGE */}
            <tr className={s.sectionHeader}><td colSpan={10}>POST-ASSESSMENT NUDGE</td></tr>
            <tr className={s.changeModify}>
              <td>N1</td>
              <td>Post-Report</td>
              <td><Key>NUDGE_POST_REPORT_FEEDBACK</Key></td>
              <td><Badge type="both">BOTH</Badge></td>
              <td><Tag type="change">CHANGE HEB</Tag></td>
              <td className={s.textCell}><HeOld>היי &#123;&#123;name&#125;&#125; 🌼 האם הספקת להסתכל על הסיכום שלך? כמה נשים מוצאות את זה מרגיע...</HeOld></td>
              <td className={s.textCell}><HeNew>היי &#123;name&#125; 🌼 האם הספקת להסתכל על מפת הדרכים שלך? אני בטוחה שיש לך הרבה שאלות מאיפה תרצי להתחיל? תרצי שנדייק את הטיפים שקיבלת? שנדבר על אפשרויות טיפול?... אני כאן בשבילך מתי שאת מוכנה.</HeNew></td>
              <td className={s.textCell}><En>Hi &#123;&#123;name&#125;&#125; 🌼 Did you get a chance to take a look at your summary?...</En></td>
              <td><Tag type="keep">NO CHANGE</Tag></td>
              <td>HEB-only rewrite. More action-oriented follow-up questions.</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Implementation Risk Assessment */}
      <h2 className={s.sectionTitle}>Implementation Risk Assessment</h2>

      <div className={s.card}>
        <div className={s.cardTitle} style={{ color: 'var(--fl-red)' }}>High-Impact Changes (Require Code Changes Beyond Text)</div>
        <ul>
          <li><strong>Consent Button:</strong> Adding "אני מסכימה - בואי נתחיל" button requires a new step type in the flow.</li>
          <li><strong>Stopped Reason Numbering:</strong> Changing a-g to 1-7 requires updating <Code>calculateStage()</Code> switch cases AND the AI function parameter enum.</li>
          <li><strong>Delete postNameIntro:</strong> Requires rewiring <Code>obDemoCollectAge</Code> next step from "postNameIntro" to "menstrualStatus".</li>
          <li><strong>&#123;&#123;name&#125;&#125; in DEMO intro:</strong> New EN text uses &#123;&#123;name&#125;&#125; before name is collected. Either reorder flow or remove &#123;&#123;name&#125;&#125; from intro.</li>
          <li><strong>Delete pre-assessment message:</strong> Keep <Code>calculateStage()</Code> logic but remove the message.</li>
        </ul>
      </div>

      <div className={s.card}>
        <div className={s.cardTitle} style={{ color: 'var(--fl-orange)' }}>Medium-Impact Changes (Text + Array Structure)</div>
        <ul>
          <li><strong>ONBOARDING_INTRO_DEMO:</strong> Array goes from 4 items to 3 (remove demo notice). Both languages.</li>
          <li><strong>MENSTRUAL_STATUS_INQUIRY:</strong> Changes from 1-item to 2-item array (context paragraph + question). Both languages.</li>
          <li><strong>INTAKE_PHYSICAL_SYMPTOMS:</strong> HEB needs message split (1 combined msg &rarr; 2 separate msgs).</li>
          <li><strong>INTAKE_TOO_YOUNG:</strong> Array goes from 4 items to 2 (remove share msgs). Add &#123;&#123;age&#125;&#125; variable.</li>
        </ul>
      </div>

      <div className={s.card}>
        <div className={s.cardTitle} style={{ color: 'var(--fl-green)' }}>Low-Impact Changes (Text-Only Swaps)</div>
        <ul>
          <li>ONBOARDING_ASK_NAME HEB wording tweak</li>
          <li>ONBOARDING_ASK_AGE HEB polite rewording</li>
          <li>Vasomotor HEB Msg2 &amp; Msg3 rewording</li>
          <li>Physical HEB/EN Msg1 expanded text</li>
          <li>Impact rating HEB reword</li>
          <li>Summary intro HEB rewrite</li>
          <li>Report link HEB rewrite</li>
          <li>Post-report nudge HEB rewrite</li>
          <li>Too-young Msg4 HEB rewrite</li>
        </ul>
      </div>
    </>
  );
}

/* ========== MAIN COMPONENT ========== */

export function FreedaLegacyFlowPage() {
  const [activePage, setActivePage] = useState<'current' | 'changes'>('current');

  return (
    <div className={s.page}>
      <div className={s.nav}>
        <span className={s.navTitle}>Freeda.ai Flow Mapping</span>
        <button
          className={`${s.navBtn} ${activePage === 'current' ? s.navBtnActive : ''}`}
          onClick={() => setActivePage('current')}
        >
          Current State
        </button>
        <button
          className={`${s.navBtn} ${activePage === 'changes' ? s.navBtnActive : ''}`}
          onClick={() => setActivePage('changes')}
        >
          Changes &amp; Gaps
        </button>
      </div>

      <div className={s.content}>
        {activePage === 'current' ? <CurrentStatePage /> : <ChangesPage />}
      </div>
    </div>
  );
}
