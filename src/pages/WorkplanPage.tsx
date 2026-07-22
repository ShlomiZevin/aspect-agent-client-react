import { useEffect } from 'react';
import s from './WorkplanPage.module.css';

const STEPS = [
  {
    month: 'By end of August',
    title: 'We get set up',
    text: 'Real data flows into our engine and the groundwork is done — ready to build on.',
    final: false,
  },
  {
    month: 'By end of September',
    title: 'It comes together',
    text: 'The product works end-to-end, and our first AI model is in training on the data.',
    final: false,
  },
  {
    month: 'By end of October',
    title: 'We’re there',
    text: 'A working product, plus the first results from our AI model.',
    final: true,
  },
];

export function WorkplanPage() {
  useEffect(() => {
    document.title = 'Aspect — Where we’ll be in 3 months';
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  }, []);

  return (
    <div className={s.page}>
      <div className={s.wrap}>

        {/* Hero */}
        <div className={s.hero}>
          <span className={s.eyebrow}>The plan · August–October 2026</span>
          <h1 className={s.h1}>Where we’ll be in 3 months</h1>
          <p className={s.lead}>
            With a team of three, in one quarter we go from today’s prototype to
            <strong> a working product</strong> and <strong>our first AI model results</strong>.
          </p>
        </div>

        {/* Destination */}
        <p className={s.blockLabel}>By the end of October, we’ll have</p>
        <div className={s.destGrid}>
          <div className={`${s.destCard} ${s.blue}`}>
            <span className={s.destIcon}>📊</span>
            <h2 className={s.destTitle}>A working product</h2>
            <p className={s.destText}>
              The next-gen BI tool — ready for real customers to use, ask questions, and get answers from their data.
            </p>
            <span className={s.destTag}>✓ Ready to use</span>
          </div>
          <div className={`${s.destCard} ${s.purple}`}>
            <span className={s.destIcon}>🧠</span>
            <h2 className={s.destTitle}>First AI model results</h2>
            <p className={s.destText}>
              Our first machine-learning model, live and producing real predictions on the data — the start of the intelligence layer.
            </p>
            <span className={s.destTag}>✓ First results in</span>
          </div>
        </div>

        {/* How we get there */}
        <p className={s.blockLabel}>How we get there</p>
        <div className={s.steps}>
          {STEPS.map(st => (
            <div key={st.month} className={`${s.step} ${st.final ? s.stepFinal : ''}`}>
              <span className={s.stepMonth}>{st.month}</span>
              <h3 className={s.stepTitle}>{st.title}</h3>
              <p className={s.stepText}>{st.text}</p>
            </div>
          ))}
        </div>

        {/* Team */}
        <div className={s.teamBar}>
          <div className={s.teamLeft}>
            <span className={s.teamTitle}>The team that gets us there</span>
            <span className={s.teamPeople}>3 people, working with Claude — 2 developers + 1 data scientist</span>
          </div>
          <div className={s.teamCost}>
            <div className={s.teamCostNum}>₪60,000</div>
            <div className={s.teamCostSub}>per month · ₪20,000 each</div>
          </div>
        </div>

      </div>
    </div>
  );
}
