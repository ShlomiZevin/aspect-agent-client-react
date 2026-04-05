import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './HowWeBuildPage.module.css';

const TOTAL_SLIDES = 9;

export function HowWeBuildPage() {
  const [current, setCurrent] = useState(0);
  const goTo = useCallback((i: number) => { if (i >= 0 && i < TOTAL_SLIDES) setCurrent(i); }, []);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => { document.title = 'How We Build Agents | Lybi'; }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLeft}>
            <Link to="/lybi" className={styles.navLogo}><img src="/img/lybi-logo-transparent.png" alt="Lybi" /></Link>
            <span className={styles.navBadge}>Architecture</span>
          </div>
          <span className={styles.navCounter}>{current + 1} / {TOTAL_SLIDES}</span>
        </div>
      </nav>

      <div className={styles.slideTrack} style={{ transform: `translateX(-${current * 100}vw)` }}>

        {/* === 1. INTRO === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>Lybi Architecture</p>
            <h1 className={styles.h1}>How we build AI agents</h1>
            <p className={styles.heroSubtitle}>
              A visual walkthrough of how our platform works — agents, crew members,
              and the system that makes it all come together.
            </p>
          </div>
        </div>

        {/* === 2. AGENT + CREWS OVERVIEW === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>The big picture</p>
            <h2 className={styles.h2}>Every agent is built from crew members</h2>
            <p className={styles.bodyText}>
              An agent is the character your users talk to. Crew members are the phases of
              the conversation — each one handles a different part of the flow.
            </p>

            <div className={styles.archDiagram}>
              <div className={styles.agentBox}>
                <span className={styles.agentBoxLabel}>Agent</span>
                <div className={styles.agentPersonaBar}>
                  🎭 Agent Persona — shared voice & character across all crews
                </div>
                <div className={styles.crewRow}>
                  <div className={`${styles.crewCard} ${styles.crewCardActive}`}>
                    <div className={styles.crewCardLabel}>
                      👋 Welcome
                      <span className={styles.crewCardDefault}>default</span>
                    </div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>💬</span> <strong>Talker:</strong> GPT-4o + prompt</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>📝</span> <strong>Extractor:</strong> GPT-4o Mini + fields</div>
                  </div>
                  <div className={styles.crewArrow}>→</div>
                  <div className={styles.crewCard}>
                    <div className={styles.crewCardLabel}>💬 Advisor</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>🤔</span> <strong>Thinker:</strong> Claude + prompt</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>💬</span> <strong>Talker:</strong> Gemini + prompt</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>📝</span> <strong>Extractor:</strong> GPT-4o Mini + fields</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>📁</span> Knowledge base</div>
                  </div>
                  <div className={styles.crewArrow}>→</div>
                  <div className={styles.crewCard}>
                    <div className={styles.crewCardLabel}>✅ Review</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>💬</span> <strong>Talker:</strong> Claude + prompt</div>
                  </div>
                </div>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`}>
              The domain expert decides how to break the flow into crew members. Each crew handles one important phase.
            </p>
          </div>
        </div>

        {/* === 3. WHAT'S INSIDE A CREW === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>Inside a crew member</p>
            <h2 className={styles.h2}>What happens when a user sends a message</h2>

            <div className={styles.chainFlow}>
              <div className={`${styles.chainNode} ${styles.chainNodeSync}`}>
                <span className={styles.chainNodeIcon}>💬</span>
                <span className={styles.chainNodeName}>User message</span>
                <span className={styles.chainNodeMeta}>+ chat history</span>
              </div>
              <span className={styles.chainArrow}>→</span>
              <div className={`${styles.chainNode} ${styles.chainNodeSync}`}>
                <span className={styles.chainNodeIcon}>📝</span>
                <span className={styles.chainNodeName}>Extractor</span>
                <span className={styles.chainNodeMeta}>GPT-4o Mini</span>
                <span className={`${styles.chainNodeBadge} ${styles.badgeSync}`}>parallel</span>
              </div>
              <span className={styles.chainArrow}>→</span>
              <div className={`${styles.chainNode} ${styles.chainNodeSync}`}>
                <span className={styles.chainNodeIcon}>🤔</span>
                <span className={styles.chainNodeName}>Thinker</span>
                <span className={styles.chainNodeMeta}>Claude</span>
                <span className={`${styles.chainNodeBadge} ${styles.badgeSync}`}>sync — waits</span>
              </div>
              <span className={styles.chainArrow}>→</span>
              <div className={`${styles.chainNode} ${styles.chainNodeSync}`}>
                <span className={styles.chainNodeIcon}>💬</span>
                <span className={styles.chainNodeName}>Talker</span>
                <span className={styles.chainNodeMeta}>Gemini Flash</span>
                <span className={`${styles.chainNodeBadge} ${styles.badgeSync}`}>sync — streams</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 20px' }}>
              <div className={`${styles.chainNode} ${styles.chainNodeAsync}`}>
                <span className={styles.chainNodeIcon}>🔍</span>
                <span className={styles.chainNodeName}>Profiler</span>
                <span className={styles.chainNodeMeta}>GPT-4o</span>
                <span className={`${styles.chainNodeBadge} ${styles.badgeAsync}`}>async — doesn't block</span>
              </div>
            </div>

            <div className={styles.cardsGrid}>
              <div className={styles.card}>
                <span className={styles.cardIcon}>📝</span>
                <h3 className={styles.cardTitle}>Extractor</h3>
                <p className={styles.cardText}>
                  Reads the conversation and pulls out structured fields (name, age, intent...).
                  Runs in parallel with the response.
                </p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>🤔</span>
                <h3 className={styles.cardTitle}>Thinker</h3>
                <p className={styles.cardText}>
                  A stronger model that analyzes the situation and writes a strategy.
                  The talker reads this before responding.
                </p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>💬</span>
                <h3 className={styles.cardTitle}>Talker</h3>
                <p className={styles.cardText}>
                  The model that actually speaks to the user. Gets the thinker's advice +
                  extractor results in its context.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* === 4. SHARED CONTEXT === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>Shared memory</p>
            <h2 className={styles.h2}>Everyone reads and writes to the same context</h2>
            <p className={styles.bodyText}>
              The extractor, thinker, talker, and profiler all share the same memory.
              One writes, another reads. That's how they coordinate.
            </p>

            <div className={styles.contextDb}>
              <div className={styles.contextDbTitle}>🗄️ Shared Context</div>
              <div className={styles.contextDbItems}>
                <span className={`${styles.contextDbItem} ${styles.ctxUser}`}>👤 User profile</span>
                <span className={`${styles.contextDbItem} ${styles.ctxUser}`}>🎯 Journey stage</span>
                <span className={`${styles.contextDbItem} ${styles.ctxConv}`}>📝 Collected fields</span>
                <span className={`${styles.contextDbItem} ${styles.ctxConv}`}>🤔 Thinker advice</span>
                <span className={`${styles.contextDbItem} ${styles.ctxConv}`}>🔍 Profiler insights</span>
                <span className={`${styles.contextDbItem} ${styles.ctxUser}`}>📊 Assessment results</span>
              </div>
            </div>

            <div className={styles.cardsGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className={styles.card}>
                <span className={styles.cardIcon}>👤</span>
                <h3 className={styles.cardTitle}>User-level</h3>
                <p className={styles.cardText}>
                  Persists across conversations. Profile, preferences, journey stage —
                  the user comes back next week and the agent remembers.
                </p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>💬</span>
                <h3 className={styles.cardTitle}>Conversation-level</h3>
                <p className={styles.cardText}>
                  Specific to this conversation. Thinker advice, assessment progress,
                  collected fields — resets when a new conversation starts.
                </p>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`}>
              When crew A finishes and crew B starts — crew B reads everything crew A saved.
            </p>
          </div>
        </div>

        {/* === 5. THE CHAIN IDEA === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>The bigger picture</p>
            <h2 className={styles.h2}>Every message triggers a chain of reactions</h2>
            <p className={styles.bodyText}>
              Today we have fixed roles: extractor, thinker, talker, profiler.
              But the real idea is bigger — a generic chain where each step is a different
              prompt + model, and each can be sync or async.
            </p>

            <div className={styles.chainFlow}>
              <div className={`${styles.chainNode} ${styles.chainNodeSync}`}>
                <span className={styles.chainNodeIcon}>💬</span>
                <span className={styles.chainNodeName}>Message in</span>
              </div>
              <span className={styles.chainArrow}>→</span>
              <div className={`${styles.chainNode} ${styles.chainNodeSync}`}>
                <span className={styles.chainNodeIcon}>🔗</span>
                <span className={styles.chainNodeName}>Step 1</span>
                <span className={styles.chainNodeMeta}>Extract intent</span>
                <span className={`${styles.chainNodeBadge} ${styles.badgeSync}`}>sync</span>
              </div>
              <span className={styles.chainArrow}>→</span>
              <div className={`${styles.chainNode} ${styles.chainNodeSync}`}>
                <span className={styles.chainNodeIcon}>🔗</span>
                <span className={styles.chainNodeName}>Step 2</span>
                <span className={styles.chainNodeMeta}>Think + plan</span>
                <span className={`${styles.chainNodeBadge} ${styles.badgeSync}`}>sync</span>
              </div>
              <span className={styles.chainArrow}>→</span>
              <div className={`${styles.chainNode} ${styles.chainNodeSync}`}>
                <span className={styles.chainNodeIcon}>🔗</span>
                <span className={styles.chainNodeName}>Step 3</span>
                <span className={styles.chainNodeMeta}>Respond</span>
                <span className={`${styles.chainNodeBadge} ${styles.badgeSync}`}>sync</span>
              </div>
              <span className={styles.chainArrow}>→</span>
              <div className={`${styles.chainNode} ${styles.chainNodeAsync}`}>
                <span className={styles.chainNodeIcon}>🔗</span>
                <span className={styles.chainNodeName}>Step 4</span>
                <span className={styles.chainNodeMeta}>Profile</span>
                <span className={`${styles.chainNodeBadge} ${styles.badgeAsync}`}>async</span>
              </div>
            </div>

            <div className={styles.contextDb}>
              <div className={styles.contextDbTitle}>🗄️ Shared context — all steps read & write</div>
              <div className={styles.contextDbItems}>
                <span className={`${styles.contextDbItem} ${styles.ctxConv}`}>Step 1 → writes intent</span>
                <span className={`${styles.contextDbItem} ${styles.ctxConv}`}>Step 2 → writes strategy</span>
                <span className={`${styles.contextDbItem} ${styles.ctxConv}`}>Step 3 → reads all</span>
                <span className={`${styles.contextDbItem} ${styles.ctxConv}`}>Step 4 → writes profile</span>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`}>
              Each step: its own prompt, its own model, its own context, sync or async. All sharing the same memory.
            </p>
          </div>
        </div>

        {/* === 7. WHAT MAKES EACH STEP DIFFERENT === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>Each step is configurable</p>
            <h2 className={styles.h2}>What makes each chain step different</h2>

            <div className={styles.cardsGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div className={styles.card}>
                <span className={styles.cardIcon}>📋</span>
                <h3 className={styles.cardTitle}>Prompt</h3>
                <p className={styles.cardText}>What it's told to do</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>🧠</span>
                <h3 className={styles.cardTitle}>Model</h3>
                <p className={styles.cardText}>Which AI runs it</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>📖</span>
                <h3 className={styles.cardTitle}>History</h3>
                <p className={styles.cardText}>How many messages it sees</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>📁</span>
                <h3 className={styles.cardTitle}>KB</h3>
                <p className={styles.cardText}>Connected to docs or not</p>
              </div>
            </div>

            <div className={styles.cardsGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div className={styles.card}>
                <span className={styles.cardIcon}>📥</span>
                <h3 className={styles.cardTitle}>Input context</h3>
                <p className={styles.cardText}>What data it reads</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>📤</span>
                <h3 className={styles.cardTitle}>Output</h3>
                <p className={styles.cardText}>Where it writes results</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>💬</span>
                <h3 className={styles.cardTitle}>Speaks to user?</h3>
                <p className={styles.cardText}>Returns text to chat or silent</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>⏱️</span>
                <h3 className={styles.cardTitle}>Sync / Async</h3>
                <p className={styles.cardText}>Must wait or runs in background</p>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`} style={{ marginTop: 16 }}>
              Same building blocks, different configuration. That's how you build any agent flow.
            </p>
          </div>
        </div>

        {/* === 8. TRIGGERED CONTEXT INJECTION === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>New feature</p>
            <h2 className={styles.h2}>When a field value triggers extra instructions</h2>
            <p className={styles.bodyText}>
              Sometimes we understand something about the user — like their intent or personality —
              and we want to inject <strong>specific</strong> instructions into the prompt.
              Not through KB search. Precise. Deterministic. In code.
            </p>

            <div className={styles.triggerMap}>
              <div className={styles.triggerRow}>
                <div className={styles.triggerField}>🎯 intent</div>
                <div className={styles.triggerArrow}>→</div>
                <div className={styles.triggerValues}>
                  <span className={`${styles.triggerChip} ${styles.triggerChipActive}`}>open_account</span>
                  <span className={`${styles.triggerChip} ${styles.triggerChipInactive}`}>close_account</span>
                  <span className={`${styles.triggerChip} ${styles.triggerChipInactive}`}>complaint</span>
                  <span className={`${styles.triggerChip} ${styles.triggerChipInactive}`}>info_request</span>
                </div>
              </div>
              <div className={styles.triggerResult}>
                <div className={styles.triggerResultLabel}>→ Injected into prompt</div>
                "The customer wants to open an account. Focus on eligibility questions.
                Ask about employment status and monthly income. Do not discuss fees yet."
              </div>
            </div>

            <div className={styles.triggerMap}>
              <div className={styles.triggerRow}>
                <div className={styles.triggerField}>😤 user_type</div>
                <div className={styles.triggerArrow}>→</div>
                <div className={styles.triggerValues}>
                  <span className={`${styles.triggerChip} ${styles.triggerChipInactive}`}>cooperative</span>
                  <span className={`${styles.triggerChip} ${styles.triggerChipActive}`}>stubborn</span>
                  <span className={`${styles.triggerChip} ${styles.triggerChipInactive}`}>confused</span>
                  <span className={`${styles.triggerChip} ${styles.triggerChipInactive}`}>kid</span>
                </div>
              </div>
              <div className={styles.triggerResult}>
                <div className={styles.triggerResultLabel}>→ Injected into prompt</div>
                "This user is resistant to suggestions. Be extra patient. Use empathy first,
                then facts. Never push. Let them feel in control of the decision."
              </div>
            </div>

            <div className={styles.callout}>
              <p className={styles.calloutTitle}>Why not use KB for this?</p>
              <p className={styles.calloutText}>
                KB uses vector search — it guesses which document is relevant.
                Here we know <em>exactly</em> which instructions to add because the field
                has a specific value from a known list. No guessing. Direct mapping in code.
              </p>
            </div>
          </div>
        </div>

        {/* === 8. HOW IT FITS TOGETHER === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>Full flow</p>
            <h2 className={styles.h2}>Putting it all together</h2>

            <div className={styles.archDiagram}>
              <div className={styles.agentBox}>
                <span className={styles.agentBoxLabel}>Crew: Advisor</span>
                <div className={styles.agentPersonaBar}>
                  🎭 Agent Persona + 🎭 Crew Persona
                </div>
                <div className={styles.crewRow}>
                  <div className={styles.crewCard} style={{ flex: 2 }}>
                    <div className={styles.crewCardLabel}>💬 Talker prompt — what the user sees</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>📋</span> Base guidance</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>🎯</span> <strong>+ triggered context</strong> (from collected field values)</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>🤔</span> + thinker advice (if enabled)</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>📁</span> + KB results (if enabled)</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>🧠</span> Model: Gemini Flash</div>
                  </div>
                  <div className={styles.crewCard}>
                    <div className={styles.crewCardLabel}>🤔 Thinker — silent, analyzes</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>📋</span> Thinking prompt</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>🧠</span> Model: Claude</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>📊</span> Output schema / fields</div>
                    <div className={styles.crewItem}><span className={styles.crewItemIcon}>📝</span> Can also extract fields</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.callout}>
              <p className={styles.calloutTitle}>Fields can come from anywhere</p>
              <p className={styles.calloutText}>
                A field like "intent" can be collected by the extractor, the thinker, or any other
                chain step. It doesn't matter who collects it — once a field has a value, it can trigger
                context injection for any downstream step. The system is agnostic about the source.
              </p>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`}>
              Agent persona + crew persona + guidance + triggered context + thinker advice + KB = the final prompt.
            </p>
          </div>
        </div>

        {/* === 10. SUMMARY === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInner}>
            <div className={styles.dividerCenter} />
            <h2 className={styles.h2} style={{ textAlign: 'center' }}>The building blocks</h2>

            <div className={styles.cardsGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.card}>
                <span className={styles.cardIcon}>🎭</span>
                <h3 className={styles.cardTitle}>Agent Persona</h3>
                <p className={styles.cardText}>Shared character voice. All crews speak with the same personality.</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>🎭</span>
                <h3 className={styles.cardTitle}>Crew Persona</h3>
                <p className={styles.cardText}>Phase-specific voice. Different tone for welcome vs. assessment vs. closing.</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>🔗</span>
                <h3 className={styles.cardTitle}>Chain Steps</h3>
                <p className={styles.cardText}>Each message triggers a chain: extract → think → talk → profile. Each step configurable.</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>🎯</span>
                <h3 className={styles.cardTitle}>Triggered Context</h3>
                <p className={styles.cardText}>Field value → specific instructions. Deterministic. No KB guessing. In code.</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>🗄️</span>
                <h3 className={styles.cardTitle}>Shared Context</h3>
                <p className={styles.cardText}>All steps read and write to the same memory. User-level or conversation-level.</p>
              </div>
              <div className={styles.card}>
                <span className={styles.cardIcon}>🔄</span>
                <h3 className={styles.cardTitle}>Transitions</h3>
                <p className={styles.cardText}>Field-based or thinker-based. Automatic handoff between conversation phases.</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button className={styles.controlBtn} onClick={prev} disabled={current === 0}>←</button>
        <div className={styles.progressDots}>
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button key={i} className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
              onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
        <button className={styles.controlBtn} onClick={next} disabled={current === TOTAL_SLIDES - 1}>→</button>
      </div>
      <div className={styles.keyHint}>← → arrow keys to navigate</div>
    </div>
  );
}
