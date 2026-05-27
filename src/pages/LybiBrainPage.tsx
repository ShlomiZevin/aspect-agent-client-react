/**
 * LybiBrainPage — "We build brains, not chatbots."
 *
 * The pitch deck explaining how every part of our agent architecture
 * maps to a real human brain region. Lives in the Lybi knowledge base
 * at `/lybi/brain`. Slide-deck format matching the other lybi/* pages.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './LybiBrainPage.module.css';

const TOTAL_SLIDES = 7;

export function LybiBrainPage() {
  const [current, setCurrent] = useState(0);
  const goTo = useCallback((i: number) => { if (i >= 0 && i < TOTAL_SLIDES) setCurrent(i); }, []);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => { document.title = 'Brain, not Chatbot | Lybi'; }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLeft}>
            <Link to="/lybi" className={styles.navLogo}>
              <img src="/img/lybi-logo-transparent.png" alt="Lybi" />
            </Link>
            <span className={styles.navBadge}>Our edge</span>
          </div>
          <span className={styles.navCounter}>{current + 1} / {TOTAL_SLIDES}</span>
        </div>
      </nav>

      <div className={styles.slideTrack} style={{ transform: `translateX(-${current * 100}vw)` }}>

        {/* === 1. HERO === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>Lybi's edge</p>
            <h1 className={styles.h1}>We don't build chatbots.<br/>We build brains.</h1>
            <p className={styles.heroSubtitle}>
              A regular AI bot is one LLM call with a prompt. We build
              cognitive systems with multiple specialized parts — memory,
              planning, voice — that decide together. Same LLMs underneath.
              Structurally different on top.
            </p>
          </div>
        </div>

        {/* === 2. THE CHATBOT PROBLEM === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>How most agents work today</p>
            <h2 className={styles.h2}>One LLM. One prompt. One shot.</h2>
            <p className={styles.bodyText}>
              The standard chatbot pattern:
            </p>

            <div className={styles.flowSimple}>
              <div className={styles.flowBox}>
                <span className={styles.flowBoxIcon}>💬</span>
                <span className={styles.flowBoxLabel}>User says something</span>
              </div>
              <span className={styles.flowArrow}>→</span>
              <div className={styles.flowBox}>
                <span className={styles.flowBoxIcon}>📦</span>
                <span className={styles.flowBoxLabel}>Stuff it into a prompt with instructions</span>
              </div>
              <span className={styles.flowArrow}>→</span>
              <div className={styles.flowBox}>
                <span className={styles.flowBoxIcon}>🤖</span>
                <span className={styles.flowBoxLabel}>Send to GPT / Claude</span>
              </div>
              <span className={styles.flowArrow}>→</span>
              <div className={styles.flowBox}>
                <span className={styles.flowBoxIcon}>💬</span>
                <span className={styles.flowBoxLabel}>Whatever comes back is the reply</span>
              </div>
            </div>

            <div className={styles.callout}>
              <h3 className={styles.calloutTitle}>The same neuron is doing everything</h3>
              <p className={styles.calloutText}>
                No separation between remembering, reasoning, and speaking.
                No structure. No strategy. Most bots end up feeling like
                dictionaries with manners — factual, but not deliberate.
                Reactive, not strategic.
              </p>
            </div>
          </div>
        </div>

        {/* === 3. HOW A REAL BRAIN DOES IT === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>The human anatomy of conversation</p>
            <h2 className={styles.h2}>A real conversation isn't one act. It's a chain.</h2>
            <p className={styles.bodyText}>
              When YOU have a conversation with someone, your brain runs
              several regions in parallel and sequence:
            </p>

            <div className={styles.brainAnatomyList}>
              <div className={styles.brainItem}>
                <span className={styles.brainItemIcon}>🦻</span>
                <div>
                  <h4 className={styles.brainItemTitle}>Senses</h4>
                  <p className={styles.brainItemText}>take in their words, tone, body language</p>
                </div>
              </div>
              <div className={styles.brainItem}>
                <span className={styles.brainItemIcon}>📥</span>
                <div>
                  <h4 className={styles.brainItemTitle}>Hippocampus</h4>
                  <p className={styles.brainItemText}>encodes new facts into memory</p>
                </div>
              </div>
              <div className={styles.brainItem}>
                <span className={styles.brainItemIcon}>💞</span>
                <div>
                  <h4 className={styles.brainItemTitle}>Limbic system</h4>
                  <p className={styles.brainItemText}>reads their mood — tone, energy, intent behind the words</p>
                </div>
              </div>
              <div className={styles.brainItem}>
                <span className={styles.brainItemIcon}>💭</span>
                <div>
                  <h4 className={styles.brainItemTitle}>Prefrontal cortex</h4>
                  <p className={styles.brainItemText}>decides what to DO about it — strategy, plan, framing</p>
                </div>
              </div>
              <div className={styles.brainItem}>
                <span className={styles.brainItemIcon}>🗣️</span>
                <div>
                  <h4 className={styles.brainItemTitle}>Broca's area</h4>
                  <p className={styles.brainItemText}>turns the plan into actual words</p>
                </div>
              </div>
              <div className={styles.brainItem}>
                <span className={styles.brainItemIcon}>🗄️</span>
                <div>
                  <h4 className={styles.brainItemTitle}>Working memory</h4>
                  <p className={styles.brainItemText}>holds the thread across the conversation</p>
                </div>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`}>
              Different regions doing different jobs. Each specialized. None work alone.
            </p>
          </div>
        </div>

        {/* === 4. THE BRAIN WE BUILT === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>Our architecture</p>
            <h2 className={styles.h2}>We built each of those regions. Separately.</h2>
            <p className={styles.bodyText}>
              Every addon in our builder maps to a real cognitive function.
              Each one is its own LLM call, with its own prompt, model, and
              access to the right slice of context.
            </p>

            <div className={styles.mappingTable}>
              <div className={styles.mappingRow}>
                <div className={styles.mappingBrain}>
                  <span className={styles.mappingIcon}>🦻</span>
                  <span className={styles.mappingLabel}>Senses</span>
                </div>
                <span className={styles.mappingArrow}>→</span>
                <div className={styles.mappingAddon}>
                  <span className={styles.mappingAddonName}>User message + history</span>
                  <span className={styles.mappingAddonNote}>what the brain perceives this turn</span>
                </div>
              </div>

              <div className={styles.mappingRow}>
                <div className={styles.mappingBrain}>
                  <span className={styles.mappingIcon}>📥</span>
                  <span className={styles.mappingLabel}>Hippocampus</span>
                </div>
                <span className={styles.mappingArrow}>→</span>
                <div className={styles.mappingAddon}>
                  <span className={styles.mappingAddonName}>Field Extractor</span>
                  <span className={styles.mappingAddonNote}>encodes facts into memory</span>
                </div>
              </div>

              <div className={styles.mappingRow}>
                <div className={styles.mappingBrain}>
                  <span className={styles.mappingIcon}>💞</span>
                  <span className={styles.mappingLabel}>Limbic system</span>
                </div>
                <span className={styles.mappingArrow}>→</span>
                <div className={styles.mappingAddon}>
                  <span className={styles.mappingAddonName}>Vibe Extractor</span>
                  <span className={styles.mappingAddonNote}>reads mood, tone, soft signals</span>
                </div>
              </div>

              <div className={styles.mappingRow}>
                <div className={styles.mappingBrain}>
                  <span className={styles.mappingIcon}>💭</span>
                  <span className={styles.mappingLabel}>Prefrontal cortex</span>
                </div>
                <span className={styles.mappingArrow}>→</span>
                <div className={styles.mappingAddon}>
                  <span className={styles.mappingAddonName}>Thinker</span>
                  <span className={styles.mappingAddonNote}>plans, strategizes, decides</span>
                </div>
              </div>

              <div className={styles.mappingRow}>
                <div className={styles.mappingBrain}>
                  <span className={styles.mappingIcon}>🗣️</span>
                  <span className={styles.mappingLabel}>Broca's area</span>
                </div>
                <span className={styles.mappingArrow}>→</span>
                <div className={styles.mappingAddon}>
                  <span className={styles.mappingAddonName}>Talker</span>
                  <span className={styles.mappingAddonNote}>turns thought into words</span>
                </div>
              </div>

              <div className={styles.mappingRow}>
                <div className={styles.mappingBrain}>
                  <span className={styles.mappingIcon}>🎯</span>
                  <span className={styles.mappingLabel}>Basal ganglia</span>
                </div>
                <span className={styles.mappingArrow}>→</span>
                <div className={styles.mappingAddon}>
                  <span className={styles.mappingAddonName}>Triggered Context</span>
                  <span className={styles.mappingAddonNote}>fires pre-scripted responses when conditions match</span>
                </div>
              </div>

              <div className={styles.mappingRow}>
                <div className={styles.mappingBrain}>
                  <span className={styles.mappingIcon}>🔀</span>
                  <span className={styles.mappingLabel}>Executive attention</span>
                </div>
                <span className={styles.mappingArrow}>→</span>
                <div className={styles.mappingAddon}>
                  <span className={styles.mappingAddonName}>Transition Router</span>
                  <span className={styles.mappingAddonNote}>shifts focus to a different mode</span>
                </div>
              </div>

              <div className={styles.mappingRow}>
                <div className={styles.mappingBrain}>
                  <span className={styles.mappingIcon}>🗄️</span>
                  <span className={styles.mappingLabel}>Working memory</span>
                </div>
                <span className={styles.mappingArrow}>→</span>
                <div className={styles.mappingAddon}>
                  <span className={styles.mappingAddonName}>Conversation memory</span>
                  <span className={styles.mappingAddonNote}>scratchpad shared across this chat</span>
                </div>
              </div>

              <div className={styles.mappingRow}>
                <div className={styles.mappingBrain}>
                  <span className={styles.mappingIcon}>📚</span>
                  <span className={styles.mappingLabel}>Long-term memory</span>
                </div>
                <span className={styles.mappingArrow}>→</span>
                <div className={styles.mappingAddon}>
                  <span className={styles.mappingAddonName}>User-level memory</span>
                  <span className={styles.mappingAddonNote}>what we remember across conversations</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === 5. WHY SPECIALIZED PARTS MATTER === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>The compounding advantage</p>
            <h2 className={styles.h2}>The brain is smarter than the sum of its parts.</h2>

            <div className={styles.twoColumn}>
              <div className={styles.column}>
                <h3 className={styles.h3}>One prompt can't be everything</h3>
                <p className={styles.bodyText}>
                  Ask a single prompt to be a strategist AND a speaker AND a
                  memory clerk — and it'll do all three badly. The
                  instructions compete; the priorities blur; the response
                  gets smart-sounding but vague.
                </p>
              </div>
              <div className={styles.column}>
                <h3 className={styles.h3}>Specialized parts can</h3>
                <p className={styles.bodyText}>
                  The Thinker uses big-reasoning models (Claude Sonnet 4.6).
                  The Talker uses fast-and-warm ones (Gemini Flash). The
                  Vibe Extractor uses cheap classifiers. Each part picks
                  the tool that fits its job — and only its job.
                </p>
              </div>
            </div>

            <div className={styles.callout}>
              <h3 className={styles.calloutTitle}>Plus: every region is individually inspectable.</h3>
              <p className={styles.calloutText}>
                We can debug the brain's reasoning without retraining its
                voice. Upgrade the planner without rewriting the speaker.
                Swap a model in one region without touching the others.
                That's not possible when everything lives in one prompt.
              </p>
            </div>
          </div>
        </div>

        {/* === 6. A TURN THROUGH THE BRAIN === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>One message, traced end-to-end</p>
            <h2 className={styles.h2}>
              The user says: <em>"I'm not sure this fits my budget."</em>
            </h2>
            <p className={styles.bodyText}>
              Here's what happens inside the brain, region by region:
            </p>

            <div className={styles.turnFlow}>
              <div className={styles.turnStep}>
                <span className={styles.turnStepNum}>1</span>
                <span className={styles.turnStepIcon}>🦻</span>
                <div className={styles.turnStepBody}>
                  <span className={styles.turnStepRegion}>Senses</span>
                  <span className={styles.turnStepWhat}>Message comes in. Appended to working memory.</span>
                </div>
              </div>
              <div className={styles.turnStep}>
                <span className={styles.turnStepNum}>2</span>
                <span className={styles.turnStepIcon}>📥</span>
                <div className={styles.turnStepBody}>
                  <span className={styles.turnStepRegion}>Hippocampus · Field Extractor</span>
                  <span className={styles.turnStepWhat}>Captures <code>intent: price_objection</code></span>
                </div>
              </div>
              <div className={styles.turnStep}>
                <span className={styles.turnStepNum}>3</span>
                <span className={styles.turnStepIcon}>💞</span>
                <div className={styles.turnStepBody}>
                  <span className={styles.turnStepRegion}>Limbic · Vibe Extractor</span>
                  <span className={styles.turnStepWhat}>Reads <code>mood: hesitant</code>, <code>tone: defensive</code></span>
                </div>
              </div>
              <div className={styles.turnStep}>
                <span className={styles.turnStepNum}>4</span>
                <span className={styles.turnStepIcon}>💭</span>
                <div className={styles.turnStepBody}>
                  <span className={styles.turnStepRegion}>Prefrontal cortex · Thinker</span>
                  <span className={styles.turnStepWhat}>"Lead with empathy, acknowledge the price concern, then reframe around value." Writes the plan.</span>
                </div>
              </div>
              <div className={styles.turnStep}>
                <span className={styles.turnStepNum}>5</span>
                <span className={styles.turnStepIcon}>🗣️</span>
                <div className={styles.turnStepBody}>
                  <span className={styles.turnStepRegion}>Broca's · Talker</span>
                  <span className={styles.turnStepWhat}>Reads memory + plan + persona. Produces: <em>"Totally fair — let's look at what would actually fit. What's the most painful part of the current setup for you?"</em></span>
                </div>
              </div>
              <div className={styles.turnStep}>
                <span className={styles.turnStepNum}>6</span>
                <span className={styles.turnStepIcon}>🗄️</span>
                <div className={styles.turnStepBody}>
                  <span className={styles.turnStepRegion}>Working memory</span>
                  <span className={styles.turnStepWhat}>Updated with everything captured. Next turn starts here.</span>
                </div>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`}>
              The user thinks they're talking to one person. They're actually
              talking to a small team inside one head.
            </p>
          </div>
        </div>

        {/* === 7. THE EDGE === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>Why this is our moat</p>
            <h2 className={styles.h2}>
              We're not making LLMs smarter.<br/>
              We're making them think in steps.
            </h2>
            <p className={styles.bodyText}>
              Other companies are racing to fine-tune bigger models. We're
              building cognitive architecture — the structure that turns
              ANY LLM into a deliberate agent.
            </p>

            <div className={styles.benefitGrid}>
              <div className={styles.benefit}>
                <span className={styles.benefitIcon}>🎯</span>
                <h3 className={styles.benefitTitle}>Decisions, not reactions</h3>
                <p className={styles.benefitText}>
                  Every turn has an explicit strategy. The Thinker writes
                  the plan; the Talker follows it. Not a plausible reply —
                  a deliberate one.
                </p>
              </div>
              <div className={styles.benefit}>
                <span className={styles.benefitIcon}>⚙️</span>
                <h3 className={styles.benefitTitle}>Right model for the job</h3>
                <p className={styles.benefitText}>
                  Big models where reasoning lives. Fast cheap models for
                  perception. The brain decides per region — not one model
                  paying for everything.
                </p>
              </div>
              <div className={styles.benefit}>
                <span className={styles.benefitIcon}>🔍</span>
                <h3 className={styles.benefitTitle}>Visible reasoning</h3>
                <p className={styles.benefitText}>
                  Every region's output is logged. You can see WHY the
                  agent said what it said — what it captured, what it
                  decided, what it remembered.
                </p>
              </div>
              <div className={styles.benefit}>
                <span className={styles.benefitIcon}>🧩</span>
                <h3 className={styles.benefitTitle}>Swappable parts</h3>
                <p className={styles.benefitText}>
                  Upgrade the planner without touching the speaker. Add a
                  new sense (image, audio) without rewriting cognition.
                  Brain evolves by region, not by rebuild.
                </p>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`} style={{ marginTop: 32 }}>
              Same LLM ingredients as everyone else. A brain instead of a chat loop.
            </p>
          </div>
        </div>

      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button className={styles.controlBtn} onClick={prev} disabled={current === 0}>←</button>
        <div className={styles.progressDots}>
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <button className={styles.controlBtn} onClick={next} disabled={current === TOTAL_SLIDES - 1}>→</button>
      </div>
      <div className={styles.keyHint}>← → arrow keys to navigate</div>
    </div>
  );
}
