import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './ChainArchitecturePage.module.css';

export function ChainArchitecturePage() {
  useEffect(() => {
    document.title = 'Chain Architecture | Lybi';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; };
  }, []);

  return (
    <div className={styles.container}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLeft}>
            <Link to="/lybi" className={styles.navLogo}>
              <img src="/img/lybi-logo-transparent.png" alt="Lybi" />
            </Link>
            <span className={styles.navBadge}>Architecture</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <p className={styles.eyebrow}>The Chain</p>
        <h1 className={styles.h1}>How we process every message</h1>
        <p className={styles.subtitle}>
          Every user message passes through a chain of steps. Each step is a separate LLM call
          (or code) with its own prompt, model, and purpose. Here's the full pipeline.
        </p>
      </header>

      {/* ===== THE CHAIN VISUAL ===== */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>The pipeline</p>

        <div className={styles.chainFlow}>
          <div className={`${styles.chainStep} ${styles.stepExtract}`}>
            <div className={styles.chainStepHeader}>
              <span className={styles.chainStepNum}>1</span>
              <span className={styles.chainStepIcon}>📥</span>
              <span className={styles.chainStepName}>User Input Extractor</span>
              <span className={styles.chainStepDesc}>Name, ID, consent...</span>
              <span className={`${styles.chainBadge} ${styles.chainBadgeLlm}`}>LLM</span>
            </div>
          </div>

          <div className={`${styles.chainStep} ${styles.stepVibe}`}>
            <div className={styles.chainStepHeader}>
              <span className={styles.chainStepNum}>2</span>
              <span className={styles.chainStepIcon}>🧐</span>
              <span className={styles.chainStepName}>User Vibe Extractor</span>
              <span className={styles.chainStepDesc}>Mood, personality, type...</span>
              <span className={`${styles.chainBadge} ${styles.chainBadgeLlm}`}>LLM</span>
            </div>
          </div>

          <div className={`${styles.chainStep} ${styles.stepDynamic}`}>
            <div className={styles.chainStepHeader}>
              <span className={styles.chainStepNum}>3</span>
              <span className={styles.chainStepIcon}>⚡</span>
              <span className={styles.chainStepName}>Dynamic Prompt</span>
              <span className={styles.chainStepDesc}>Assemble the right context</span>
              <span className={`${styles.chainBadge} ${styles.chainBadgeCode}`}>Code</span>
            </div>
          </div>

          <div className={`${styles.chainStep} ${styles.stepStrategic}`}>
            <div className={styles.chainStepHeader}>
              <span className={styles.chainStepNum}>4</span>
              <span className={styles.chainStepIcon}>🧠</span>
              <span className={styles.chainStepName}>Strategic</span>
              <span className={styles.chainStepDesc}>What should we do?</span>
              <span className={`${styles.chainBadge} ${styles.chainBadgeLlm}`}>LLM</span>
            </div>
          </div>

          <div className={`${styles.chainStep} ${styles.stepTalker}`}>
            <div className={styles.chainStepHeader}>
              <span className={styles.chainStepNum}>5</span>
              <span className={styles.chainStepIcon}>💬</span>
              <span className={styles.chainStepName}>Talker</span>
              <span className={styles.chainStepDesc}>Say it naturally</span>
              <span className={`${styles.chainBadge} ${styles.chainBadgeLlm}`}>LLM</span>
            </div>
          </div>

          <div className={`${styles.chainStep} ${styles.stepFormatter}`}>
            <div className={styles.chainStepHeader}>
              <span className={styles.chainStepNum}>6</span>
              <span className={styles.chainStepIcon}>✨</span>
              <span className={styles.chainStepName}>Formatter</span>
              <span className={styles.chainStepDesc}>Structure for display</span>
              <span className={`${styles.chainBadge} ${styles.chainBadgeLlm}`}>LLM</span>
            </div>
          </div>
        </div>

        <div className={styles.legendRow}>
          <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendLlm}`} /> LLM-based — statistical, probabilistic</span>
          <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendCode}`} /> Code-based — deterministic, 100% accurate</span>
        </div>

        <div className={styles.accuracyScale}>
          <div className={styles.accuracyHeader}>Where issues can happen</div>
          <div className={styles.accuracyRow}>
            <span className={styles.accuracyLabel}>Input Extractor</span>
            <div className={styles.accuracyBar}>
              <div className={styles.accuracyFill} style={{ width: '15%', background: '#22c55e' }} />
            </div>
            <span className={styles.accuracyNote}>Simple fields — low risk</span>
          </div>
          <div className={styles.accuracyRow}>
            <span className={styles.accuracyLabel}>Vibe Extractor</span>
            <div className={styles.accuracyBar}>
              <div className={styles.accuracyFill} style={{ width: '45%', background: '#f59e0b' }} />
            </div>
            <span className={styles.accuracyNote}>Subjective — can misread tone</span>
          </div>
          <div className={styles.accuracyRow}>
            <span className={styles.accuracyLabel}>Dynamic Prompt</span>
            <div className={styles.accuracyBar}>
              <div className={styles.accuracyFill} style={{ width: '0%' }} />
            </div>
            <span className={styles.accuracyNote}>Code — 0% risk, always accurate</span>
          </div>
          <div className={styles.accuracyRow}>
            <span className={styles.accuracyLabel}>Strategic</span>
            <div className={styles.accuracyBar}>
              <div className={styles.accuracyFill} style={{ width: '55%', background: '#f97316' }} />
            </div>
            <span className={styles.accuracyNote}>Complex reasoning — can hallucinate</span>
          </div>
          <div className={styles.accuracyRow}>
            <span className={styles.accuracyLabel}>Talker</span>
            <div className={styles.accuracyBar}>
              <div className={styles.accuracyFill} style={{ width: '35%', background: '#eab308' }} />
            </div>
            <span className={styles.accuracyNote}>Creative output — can drift from strategy</span>
          </div>
          <div className={styles.accuracyRow}>
            <span className={styles.accuracyLabel}>Formatter</span>
            <div className={styles.accuracyBar}>
              <div className={styles.accuracyFill} style={{ width: '10%', background: '#22c55e' }} />
            </div>
            <span className={styles.accuracyNote}>Simple transform — low risk</span>
          </div>
        </div>
      </section>

      <div className={styles.divider}><hr className={styles.dividerLine} /></div>

      {/* ===== TIMING FLOW ===== */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>Timing</p>
        <h2 className={styles.sectionTitle}>What runs when</h2>

        <div className={styles.timeline}>
          {/* Main chain — horizontal */}
          <div className={styles.timelineLabel}>Main chain <span className={styles.timelineLabelSub}>— user waits for this</span></div>
          <div className={styles.timelineTrack}>
            <div className={`${styles.timelineNode} ${styles.flowBoxUser}`}>
              💬
              <span className={styles.timelineNodeName}>Message</span>
            </div>
            <div className={styles.timelineConnector} />
            <div className={`${styles.timelineNode} ${styles.flowBoxExtract}`}>
              📥
              <span className={styles.timelineNodeName}>Input<br />Extractor</span>
              <span className={`${styles.badge} ${styles.badgeLlm}`}>LLM</span>
            </div>
            <div className={styles.timelineConnector} />
            <div className={`${styles.timelineNode} ${styles.flowBoxDynamic}`}>
              ⚡
              <span className={styles.timelineNodeName}>Dynamic<br />Prompt</span>
              <span className={`${styles.badge} ${styles.badgeCode}`}>code</span>
            </div>
            <div className={styles.timelineConnector} />
            <div className={`${styles.timelineNode} ${styles.flowBoxStrategic}`}>
              🧠
              <span className={styles.timelineNodeName}>Strategic</span>
              <span className={`${styles.badge} ${styles.badgeLlm}`}>LLM</span>
            </div>
            <div className={styles.timelineConnector} />
            <div className={`${styles.timelineNode} ${styles.flowBoxTalker}`}>
              💬
              <span className={styles.timelineNodeName}>Talker</span>
              <span className={`${styles.badge} ${styles.badgeLlm}`}>LLM</span>
            </div>
            <div className={styles.timelineConnector} />
            <div className={`${styles.timelineNode} ${styles.flowBoxFormatter}`}>
              ✨
              <span className={styles.timelineNodeName}>Formatter</span>
              <span className={`${styles.badge} ${styles.badgeLlm}`}>LLM</span>
            </div>
            <div className={styles.timelineConnector} />
            <div className={`${styles.timelineNode} ${styles.flowBoxResponse}`}>
              ✅
              <span className={styles.timelineNodeName}>Response</span>
            </div>
          </div>

          {/* Background row */}
          <div className={styles.timelineBgRow}>
            <div className={styles.timelineBgLabel}>Background <span className={styles.timelineLabelSub}>— runs alongside, doesn't block</span></div>
            <div className={styles.timelineBgTrack}>
              <div className={`${styles.timelineNode} ${styles.flowBoxVibe}`}>
                🧐
                <span className={styles.timelineNodeName}>Vibe<br />Extractor</span>
                <span className={`${styles.badge} ${styles.badgeLlm}`}>LLM</span>
              </div>
              <span className={styles.timelineBgNote}>2–5 sec · writes fields to DB · available from next message</span>
            </div>
          </div>
        </div>

      </section>

      <div className={styles.divider}><hr className={styles.dividerLine} /></div>

      {/* ===== STEP DETAIL CARDS ===== */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>Each step in detail</p>
        <h2 className={styles.sectionTitle}>Every step has the same 8 settings</h2>
        <p className={styles.bodyText}>
          Every step in the chain — whether it's an extractor, a thinker, or the talker — is configured
          with the same 8 properties. That's the whole design: a generic building block, different settings.
        </p>

        <div className={styles.stepCards}>
          {/* 1. User Input Extractor */}
          <div className={styles.stepCard}>
            <div className={styles.stepCardHeader}>
              <span className={styles.stepCardNum} style={{ background: '#f59e0b' }}>1</span>
              <span className={styles.stepCardIcon}>📥</span>
              <span className={styles.stepCardTitle}>User Input Extractor</span>
              <span className={`${styles.badge} ${styles.badgeLlm}`}>LLM</span>
            </div>
            <div className={styles.stepCardBody}>
              <p className={styles.stepCardIntro}>
                Extracts <strong>concrete facts</strong> directly from what the user said — name, ID number,
                address, consent, intent. Things the user explicitly stated or clearly implied.
              </p>
              <div className={styles.stepProps}>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📋 Prompt</span>
                  <span className={styles.stepPropValue}>"Extract these fields from the user message..."</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>🧠 Model</span>
                  <span className={styles.stepPropValue}>Fast — Gemini Flash / GPT-4o Mini</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📖 History</span>
                  <span className={styles.stepPropValue}>Last 2–3 messages</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📁 KB</span>
                  <span className={styles.stepPropValueMuted}>No</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📥 Input</span>
                  <span className={styles.stepPropValue}>User message + recent history</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📤 Output</span>
                  <span className={styles.stepPropValue}>Fields → DB (name, ID, address, consent...)</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>💬 Speaks?</span>
                  <span className={styles.stepPropValueMuted}>No — silent</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>⏱️ Timing</span>
                  <span className={`${styles.badge} ${styles.badgeSync}`}>Sync — must finish</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. User Profiler */}
          <div className={styles.stepCard}>
            <div className={styles.stepCardHeader}>
              <span className={styles.stepCardNum} style={{ background: '#ec4899' }}>2</span>
              <span className={styles.stepCardIcon}>🧐</span>
              <span className={styles.stepCardTitle}>User Vibe Extractor</span>
              <span className={`${styles.badge} ${styles.badgeLlm}`}>LLM</span>
            </div>
            <div className={styles.stepCardBody}>
              <p className={styles.stepCardIntro}>
                Reads <strong>between the lines</strong> — not what they said, but <em>how</em> they said it.
                Mood, personality type, patience level, communication style. These are still fields — just
                extracted from the metadata of the conversation, not directly from the user's answer.
                Takes 2–5 sec, doesn't block — results available from next message onward.
              </p>
              <div className={styles.stepProps}>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📋 Prompt</span>
                  <span className={styles.stepPropValue}>"Assess the user's personality and type..."</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>🧠 Model</span>
                  <span className={styles.stepPropValue}>Medium — GPT-4o / Claude</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📖 History</span>
                  <span className={styles.stepPropValue}>Last 5–8 messages</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📁 KB</span>
                  <span className={styles.stepPropValueMuted}>No</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📥 Input</span>
                  <span className={styles.stepPropValue}>Conversation flow, tone, patterns</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📤 Output</span>
                  <span className={styles.stepPropValue}>Fields → DB (user_type, mood, patience...)</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>💬 Speaks?</span>
                  <span className={styles.stepPropValueMuted}>No — silent</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>⏱️ Timing</span>
                  <span className={`${styles.badge} ${styles.badgeAsync}`}>Background — 2–5 sec, doesn't block</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Dynamic Prompt */}
          <div className={styles.stepCard}>
            <div className={styles.stepCardHeader}>
              <span className={styles.stepCardNum} style={{ background: '#10b981' }}>3</span>
              <span className={styles.stepCardIcon}>⚡</span>
              <span className={styles.stepCardTitle}>Dynamic Prompt</span>
              <span className={styles.stepCardDesc}>Not an LLM — code that assembles the right context</span>
            </div>
            <div className={styles.stepCardBody}>
              <div className={styles.stepProps}>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📋 Prompt</span>
                  <span className={styles.stepPropValueMuted}>N/A — this is code, not LLM</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>🧠 Model</span>
                  <span className={styles.stepPropValueMuted}>N/A — deterministic lookup</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📖 History</span>
                  <span className={styles.stepPropValueMuted}>N/A</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📁 KB</span>
                  <span className={styles.stepPropValueMuted}>N/A</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📥 Input</span>
                  <span className={styles.stepPropValue}>ALL collected fields from all extractors</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📤 Output</span>
                  <span className={styles.stepPropValue}>Injected context blocks → Strategic prompt</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>💬 Speaks?</span>
                  <span className={styles.stepPropValueMuted}>No</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>⏱️ Timing</span>
                  <span className={`${styles.badge} ${styles.badgeCode}`}>Instant — code lookup</span>
                </div>
              </div>

              <div className={styles.callout} style={{ marginTop: 16, marginBottom: 0 }}>
                <p className={styles.calloutTitle}>This is the Triggered Context feature</p>
                <p className={styles.calloutText}>
                  Field has value "stubborn" → inject the full stubborn-customer handling guide.
                  Field has value "open_account" → inject the account opening playbook.
                  No guessing, no probability. Exact code-level map lookup.
                </p>
              </div>
            </div>
          </div>

          {/* 4. Strategic */}
          <div className={styles.stepCard}>
            <div className={styles.stepCardHeader}>
              <span className={styles.stepCardNum} style={{ background: '#6366f1' }}>4</span>
              <span className={styles.stepCardIcon}>🧠</span>
              <span className={styles.stepCardTitle}>Strategic</span>
              <span className={`${styles.badge} ${styles.badgeLlm}`}>LLM</span>
            </div>
            <div className={styles.stepCardBody}>
              <p className={styles.stepCardIntro}>
                The brain. Gets <strong>everything</strong> — all fields, dynamic context, history, KB documents — and decides
                what to do next. Outputs a strategy, not words. The Talker will handle the talking.
              </p>
              <div className={styles.stepProps}>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📋 Prompt</span>
                  <span className={styles.stepPropValue}>"Analyze the conversation and recommend strategy..."</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>🧠 Model</span>
                  <span className={styles.stepPropValue}>Strong — Claude / GPT-4o</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📖 History</span>
                  <span className={styles.stepPropValue}>Full conversation</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📁 KB</span>
                  <span className={styles.stepPropValue}>Yes — products, policies, handling guides</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📥 Input</span>
                  <span className={styles.stepPropValue}>Dynamic prompt + all fields + history + KB</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📤 Output</span>
                  <span className={styles.stepPropValue}>Strategy JSON → context for Talker</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>💬 Speaks?</span>
                  <span className={styles.stepPropValueMuted}>No — silent strategist</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>⏱️ Timing</span>
                  <span className={`${styles.badge} ${styles.badgeSync}`}>Sync — Talker waits for this</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Talker */}
          <div className={styles.stepCard}>
            <div className={styles.stepCardHeader}>
              <span className={styles.stepCardNum} style={{ background: '#8b5cf6' }}>5</span>
              <span className={styles.stepCardIcon}>💬</span>
              <span className={styles.stepCardTitle}>Talker</span>
              <span className={`${styles.badge} ${styles.badgeLlm}`}>LLM</span>
            </div>
            <div className={styles.stepCardBody}>
              <p className={styles.stepCardIntro}>
                Doesn't think about <em>what</em> to say — that's the Strategic's job. Only handles <em>how</em> to say it.
                Follows the strategy, applies persona and tone, speaks naturally.
              </p>
              <div className={styles.stepProps}>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📋 Prompt</span>
                  <span className={styles.stepPropValue}>"Speak naturally following the strategy..."</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>🧠 Model</span>
                  <span className={styles.stepPropValue}>Fast — Gemini Flash / GPT-4o Mini</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📖 History</span>
                  <span className={styles.stepPropValue}>Last 3–5 messages</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📁 KB</span>
                  <span className={styles.stepPropValue}>Optional — can connect if needed</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📥 Input</span>
                  <span className={styles.stepPropValue}>Strategy JSON + persona + speaking rules</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📤 Output</span>
                  <span className={styles.stepPropValue}>Chat response text</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>💬 Speaks?</span>
                  <span className={`${styles.badge} ${styles.badgeSpeaks}`}>Yes — returns text to chat</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>⏱️ Timing</span>
                  <span className={`${styles.badge} ${styles.badgeSync}`}>Sync — streams to user</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Formatter */}
          <div className={styles.stepCard}>
            <div className={styles.stepCardHeader}>
              <span className={styles.stepCardNum} style={{ background: '#64748b' }}>6</span>
              <span className={styles.stepCardIcon}>✨</span>
              <span className={styles.stepCardTitle}>Formatter</span>
              <span className={`${styles.badge} ${styles.badgeLlm}`}>LLM</span>
            </div>
            <div className={styles.stepCardBody}>
              <div className={styles.stepProps}>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📋 Prompt</span>
                  <span className={styles.stepPropValue}>"Format this for screen display..."</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>🧠 Model</span>
                  <span className={styles.stepPropValue}>Fast & cheap — GPT-4o Mini</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📖 History</span>
                  <span className={styles.stepPropValueMuted}>None</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📁 KB</span>
                  <span className={styles.stepPropValueMuted}>No</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📥 Input</span>
                  <span className={styles.stepPropValue}>Talker output only</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>📤 Output</span>
                  <span className={styles.stepPropValue}>Formatted response (replaces talker text)</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>💬 Speaks?</span>
                  <span className={`${styles.badge} ${styles.badgeSpeaks}`}>Yes — replaces talker output</span>
                </div>
                <div className={styles.stepProp}>
                  <span className={styles.stepPropLabel}>⏱️ Timing</span>
                  <span className={`${styles.badge} ${styles.badgeSync}`}>Sync — final step</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.divider}><hr className={styles.dividerLine} /></div>

      {/* ===== KEY INSIGHT ===== */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>The key idea</p>
        <h2 className={styles.sectionTitle}>Every step is the same building block</h2>

        <div className={styles.callout}>
          <p className={styles.calloutTitle}>8 settings. That's it.</p>
          <p className={styles.calloutText}>
            Prompt, Model, History, KB, Input context, Output, Speaks to user, Sync/Async.
            Whether it's an extractor, a strategist, or the talker — it's the same block with different settings.
            Want to add a step? Add a block. Want to change what model the strategic uses? Change one setting.
            The chain is flexible because every piece has the same shape.
          </p>
        </div>

        <div className={styles.callout}>
          <p className={styles.calloutTitle}>All steps share the same context</p>
          <p className={styles.calloutText}>
            Every step can read from and write to the shared context (fields in the DB).
            The Input Extractor writes "intent = open_account". The Dynamic Prompt reads it and injects the
            right guide. The Strategic reads everything. The Talker reads the strategy. It's one shared pool
            of knowledge that grows with every step and every message.
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        Lybi — Chain Architecture
      </footer>
    </div>
  );
}
