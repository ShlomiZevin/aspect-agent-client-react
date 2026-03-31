import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './LLMGuidePage.module.css';

/* ===== Mini Neural Network SVG ===== */

function NeuralNetworkDiagram() {
  const layerY = [[30, 90, 150], [15, 65, 115, 165], [15, 65, 115, 165], [55, 125]];
  const layerX = [40, 160, 280, 400];
  const active: [number, number, number, number][] = [
    [0, 0, 1, 1], [0, 2, 1, 2], [1, 1, 2, 0], [1, 2, 2, 2], [2, 0, 3, 0], [2, 2, 3, 1],
  ];
  const isAct = (li: number, ni: number) =>
    active.some(([l1, n1, l2, n2]) => (li === l1 && ni === n1) || (li === l2 && ni === n2));

  return (
    <div className={styles.nnContainer}>
      <svg viewBox="0 0 440 200" width="100%" style={{ maxWidth: 420, display: 'block', margin: '0 auto' }}>
        {layerY.map((ys, li) => li < layerY.length - 1 && ys.map((y1, ni) =>
          layerY[li + 1].map((y2, nj) => {
            const a = active.some(([l1, n1, l2, n2]) => l1 === li && n1 === ni && l2 === li + 1 && n2 === nj);
            return <line key={`${li}-${ni}-${nj}`} x1={layerX[li]} y1={y1} x2={layerX[li + 1]} y2={y2}
              className={a ? styles.nnLineActive : styles.nnLine} />;
          })
        ))}
        {layerY.map((ys, li) => ys.map((y, ni) =>
          <circle key={`n-${li}-${ni}`} cx={layerX[li]} cy={y} r={isAct(li, ni) ? 14 : 12}
            fill={isAct(li, ni) ? '#680662' : '#FAF7F7'} stroke={isAct(li, ni) ? '#680662' : '#D6D3D1'}
            strokeWidth={isAct(li, ni) ? 2 : 1.5} opacity={isAct(li, ni) ? 1 : 0.55} />
        ))}
        <text x={layerX[0]} y={192} textAnchor="middle" fontSize="10" fill="#78716C" fontFamily="DM Sans">Your words</text>
        <text x={(layerX[1] + layerX[2]) / 2} y={192} textAnchor="middle" fontSize="10" fill="#78716C" fontFamily="DM Sans">Pattern matching</text>
        <text x={layerX[3]} y={192} textAnchor="middle" fontSize="10" fill="#78716C" fontFamily="DM Sans">Best guess</text>
      </svg>
    </div>
  );
}

/* ===== Main ===== */

const TOTAL_SLIDES = 12;

export function LLMGuidePage() {
  const [current, setCurrent] = useState(0);
  const goTo = useCallback((i: number) => { if (i >= 0 && i < TOTAL_SLIDES) setCurrent(i); }, []);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => { document.title = 'How AI Works | Lybi'; }, []);

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
            <span className={styles.navBadge}>Knowledge</span>
          </div>
          <span className={styles.navCounter}>{current + 1} / {TOTAL_SLIDES}</span>
        </div>
      </nav>

      <div className={styles.slideTrack} style={{ transform: `translateX(-${current * 100}vw)` }}>

        {/* === 1. INTRO === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>Lybi Knowledge</p>
            <h1 className={styles.h1}>How AI actually works</h1>
            <p className={styles.heroSubtitle}>
              A visual walkthrough of what AI models are, how they think,
              and what to expect when building an agent.
            </p>
          </div>
        </div>

        {/* === 2. THE NETWORK === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>The product</p>
            <h2 className={styles.h2}>An AI model is a network</h2>
            <p className={styles.bodyText}>
              A network of connected nodes. Words go in one side, the "best guess" comes out the other.
            </p>
            <NeuralNetworkDiagram />
            <p className={`${styles.bodySmall} ${styles.centered}`}>
              Simplified. Real models have billions of these nodes — but the idea is the same.
            </p>
          </div>
        </div>

        {/* === 3. HOW IT'S BUILT === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>How it's made</p>
            <h2 className={styles.h2}>Building a model = training the network</h2>
            <p className={styles.bodyText}>
              Someone feeds billions of texts into the network. The network adjusts itself until it
              gets good at guessing the next word. The finished, trained network <em>is</em> the model.
            </p>

            <div className={styles.pipeline}>
              <div className={styles.pipeStep}>
                <span className={styles.pipeIcon}>📚</span>
                <span className={styles.pipeLabel}>Training data</span>
                <span className={styles.pipeSub}>Books, websites, conversations</span>
              </div>
              <span className={styles.pipeArrow}>→</span>
              <div className={styles.pipeStep}>
                <span className={styles.pipeIcon}>🏗️</span>
                <span className={styles.pipeLabel}>Network structure</span>
                <span className={styles.pipeSub}>How many nodes, how connected</span>
              </div>
              <span className={styles.pipeArrow}>→</span>
              <div className={styles.pipeStep}>
                <span className={styles.pipeIcon}>⚙️</span>
                <span className={styles.pipeLabel}>Configuration</span>
                <span className={styles.pipeSub}>Speed, safety, creativity settings</span>
              </div>
              <span className={styles.pipeArrow}>→</span>
              <div className={`${styles.pipeStep} ${styles.pipeStepHighlight}`}>
                <span className={styles.pipeIcon}>🧠</span>
                <span className={styles.pipeLabel}>The model</span>
                <span className={styles.pipeSub}>The finished product</span>
              </div>
            </div>

            <div className={styles.callout}>
              <p className={styles.calloutTitle}>Why this matters</p>
              <p className={styles.calloutText}>
                Change any of these ingredients — different data, different structure, different settings —
                and you get a <strong>completely different model</strong> with different probabilities for every word.
              </p>
            </div>
          </div>
        </div>

        {/* === 4. AUTOCOMPLETE === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>How it works</p>
            <h2 className={styles.h2}>It's autocomplete</h2>

            <div className={styles.autocompleteSim}>
              <div className={styles.autocompleteHeader}>📱 Like your phone keyboard</div>
              <div className={styles.autocompleteBody}>
                <p className={styles.autocompleteText}>"I'm going to the <strong>___</strong>"</p>
                <div className={styles.autocompleteOptions}>
                  <span className={`${styles.autocompleteChip} ${styles.chipLikely}`}>store</span>
                  <span className={`${styles.autocompleteChip} ${styles.chipMaybe}`}>gym</span>
                  <span className={`${styles.autocompleteChip} ${styles.chipMaybe}`}>park</span>
                  <span className={`${styles.autocompleteChip} ${styles.chipUnlikely}`}>moon</span>
                </div>
              </div>
            </div>

            <p className={styles.bodyText}>
              AI does this for every word — picks the one with the <strong>highest probability</strong>:
            </p>

            <div className={styles.probBars}>
              <div className={styles.probRow}>
                <span className={styles.probWord}>"Hello"</span>
                <div className={styles.probTrack}><div className={styles.probFill} style={{ width: '72%' }} /></div>
                <span className={styles.probPercent}>72%</span>
              </div>
              <div className={styles.probRow}>
                <span className={styles.probWord}>"Hi"</span>
                <div className={styles.probTrack}><div className={styles.probFillMedium} style={{ width: '18%' }} /></div>
                <span className={styles.probPercent}>18%</span>
              </div>
              <div className={styles.probRow}>
                <span className={styles.probWord}>"Welcome"</span>
                <div className={styles.probTrack}><div className={styles.probFillLow} style={{ width: '7%' }} /></div>
                <span className={styles.probPercent}>7%</span>
              </div>
            </div>
            <p className={`${styles.bodySmall} ${styles.centered}`}>
              Prompt says "greet warmly" → network calculates → "Hello" wins.
            </p>
          </div>
        </div>

        {/* === 5. IT'S RANDOM === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>The core idea</p>
            <h2 className={styles.h2}>Every response involves randomness</h2>
            <p className={styles.bodyText}>
              It doesn't always pick the #1 word — sometimes #2 or #3 wins. By design.
            </p>

            <div className={styles.diceRow}>
              <div className={styles.diceCard}>
                <span className={styles.diceEmoji}>🎲</span>
                <div className={styles.diceLabel}>Same prompt</div>
                <div className={styles.diceDesc}>Two different answers. Normal.</div>
              </div>
              <div className={styles.diceCard}>
                <span className={styles.diceEmoji}>🎯</span>
                <div className={styles.diceLabel}>Usually right</div>
                <div className={styles.diceDesc}>"Usually" is not "always."</div>
              </div>
              <div className={styles.diceCard}>
                <span className={styles.diceEmoji}>🌊</span>
                <div className={styles.diceLabel}>Drift happens</div>
                <div className={styles.diceDesc}>Long responses lose track.</div>
              </div>
            </div>

            <div className={styles.callout}>
              <p className={styles.calloutTitle}>So when it skips an instruction...</p>
              <p className={styles.calloutText}>
                ...a different word "won" the probability race that time. Your prompt makes it <em>more likely</em>,
                but <strong>never 100% guaranteed</strong>. That's the nature of the product.
              </p>
            </div>
          </div>
        </div>

        {/* === 6. DIFFERENT MODELS === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>Different products</p>
            <h2 className={styles.h2}>Different models = different networks</h2>
            <p className={styles.bodyText}>
              Each company trained their own network with their own ingredients. Different result.
            </p>

            <div className={styles.vsContainer}>
              <div className={styles.vsCard}>
                <h3 className={styles.vsCardTitle}>🏎️ GPT-4o (OpenAI)</h3>
                <div className={styles.vsPipe}>
                  <span className={styles.vsPipeItem}>OpenAI's data</span>
                  <span className={styles.vsArrowDown}>↓</span>
                  <span className={styles.vsPipeItem}>OpenAI's structure</span>
                  <span className={styles.vsArrowDown}>↓</span>
                  <span className={styles.vsPipeItem}>OpenAI's settings</span>
                </div>
                <div className={styles.vsResult}>
                  "greet warmly" → <strong>"Hello" 72%</strong>
                </div>
              </div>

              <div className={styles.vsDivider}>≠</div>

              <div className={styles.vsCard}>
                <h3 className={styles.vsCardTitle}>🚀 Claude (Anthropic)</h3>
                <div className={styles.vsPipe}>
                  <span className={styles.vsPipeItem}>Anthropic's data</span>
                  <span className={styles.vsArrowDown}>↓</span>
                  <span className={styles.vsPipeItem}>Anthropic's structure</span>
                  <span className={styles.vsArrowDown}>↓</span>
                  <span className={styles.vsPipeItem}>Anthropic's settings</span>
                </div>
                <div className={styles.vsResult}>
                  "greet warmly" → <strong>"Hi there" 68%</strong>
                </div>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`}>
              Same prompt → different probabilities → different output. Not a bug — different products.
            </p>
          </div>
        </div>

        {/* === 7. "I WROTE IT" === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>The prompt</p>
            <h2 className={styles.h2}>"I wrote it — why doesn't it follow?"</h2>

            <div className={styles.chatSim}>
              <div className={styles.chatHeader}>Same prompt → 3 models</div>
              <div className={styles.chatBody}>
                <div className={`${styles.chatBubble} ${styles.chatUser}`}>
                  "Greet by name, ask about their day, then ask for ID."
                </div>
                <div className={styles.chatAnnotation}>Same instructions ↓</div>
                <div className={`${styles.chatBubble} ${styles.chatBot}`}>
                  <strong>A:</strong> "Hi Sarah! How's your day? Could I get your ID?"
                  <div className={`${styles.chatResult} ${styles.resultGood}`}>✓ All 3 steps</div>
                </div>
                <div className={`${styles.chatBubble} ${styles.chatBot}`}>
                  <strong>B:</strong> "Hello! What is your ID number please?"
                  <div className={`${styles.chatResult} ${styles.resultWarn}`}>⚠ Skipped name & day</div>
                </div>
                <div className={`${styles.chatBubble} ${styles.chatBot}`}>
                  <strong>C:</strong> "Hey! Hope you're doing great! What a lovely day..."
                  <div className={`${styles.chatResult} ${styles.resultBad}`}>✗ Forgot the ID entirely</div>
                </div>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`}>
              Different networks, different probabilities, different guesses. None are "broken."
            </p>
          </div>
        </div>

        {/* === 8. PROMPT LENGTH === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>Prompt length</p>
            <h2 className={styles.h2}>Longer ≠ better</h2>

            <div className={styles.promptVisual}>
              <div className={styles.promptCol}>
                <div className={`${styles.promptBar} ${styles.barShort}`} />
                <span className={styles.barLabel}>Too short</span>
                <span className={styles.barResult}>Missing info</span>
              </div>
              <div className={styles.promptCol}>
                <div className={`${styles.promptBar} ${styles.barMedium}`} />
                <span className={styles.barLabel}>Right size</span>
                <span className={styles.barResult}>Best results ✨</span>
              </div>
              <div className={styles.promptCol}>
                <div className={`${styles.promptBar} ${styles.barLong}`} />
                <span className={styles.barLabel}>Long</span>
                <span className={styles.barResult}>Slower, ok</span>
              </div>
              <div className={styles.promptCol}>
                <div className={`${styles.promptBar} ${styles.barHuge}`} />
                <span className={styles.barLabel}>Huge</span>
                <span className={styles.barResult}>Confused</span>
              </div>
            </div>

            <div className={styles.callout}>
              <p className={styles.calloutTitle}>"With a shorter prompt it won't work"</p>
              <p className={styles.calloutText}>
                Did you try? A focused half-page can beat a 3-page prompt.
                More rules = more for the model to juggle = more misses.
              </p>
            </div>
          </div>
        </div>

        {/* === 9. TRADEOFFS === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>Tradeoffs</p>
            <h2 className={styles.h2}>Fast, smart, cheap — pick two</h2>

            <div className={styles.meterContainer}>
              <div className={styles.meterGroup}>
                <div className={styles.meterGroupLabel}>Fast & cheap model</div>
                <div className={styles.meterRow}>
                  <span className={styles.meterLabel}>Speed</span>
                  <div className={styles.meterTrack}><div className={`${styles.meterFill} ${styles.meterGreen}`} style={{ width: '90%' }} /></div>
                </div>
                <div className={styles.meterRow}>
                  <span className={styles.meterLabel}>Accuracy</span>
                  <div className={styles.meterTrack}><div className={`${styles.meterFill} ${styles.meterRed}`} style={{ width: '40%' }} /></div>
                </div>
              </div>
              <div className={styles.meterGroup}>
                <div className={styles.meterGroupLabel}>Smart & accurate model</div>
                <div className={styles.meterRow}>
                  <span className={styles.meterLabel}>Speed</span>
                  <div className={styles.meterTrack}><div className={`${styles.meterFill} ${styles.meterOrange}`} style={{ width: '30%' }} /></div>
                </div>
                <div className={styles.meterRow}>
                  <span className={styles.meterLabel}>Accuracy</span>
                  <div className={styles.meterTrack}><div className={`${styles.meterFill} ${styles.meterPurple}`} style={{ width: '95%' }} /></div>
                </div>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`}>
              No magic button. Faster = less accurate. More accurate = slower + more expensive.
            </p>
          </div>
        </div>

        {/* === 10. KB === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>Knowledge Base</p>
            <h2 className={styles.h2}>"I wrote to use the KB — why doesn't it?"</h2>
            <p className={styles.bodyText}>
              Using the KB is not a switch. It's another prediction — the same autocomplete mechanism.
              The model has to <em>decide</em> to search, and that decision is a probability guess too.
            </p>

            <div className={styles.kbFlow}>
              <div className={styles.kbFlowStep}>
                <span className={styles.kbFlowIcon}>💬</span>
                <div className={styles.kbFlowText}><strong>User asks a question</strong></div>
              </div>
              <div className={styles.kbFlowArrow}>↓</div>
              <div className={styles.kbFlowStep}>
                <span className={styles.kbFlowIcon}>🧠</span>
                <div className={styles.kbFlowText}>
                  Network calculates: <strong>"Should I search the KB or just answer?"</strong>
                  <br />This is a probability guess — same as picking any other word.
                </div>
              </div>
              <div className={styles.kbFlowArrow}>↓</div>
              <div className={styles.kbFlowBranch}>
                <div>
                  <div className={styles.kbFlowBranchLabel}>Search wins ✓</div>
                  <div className={`${styles.kbFlowStep} ${styles.kbFlowStepGood}`}>
                    <span className={styles.kbFlowIcon}>🔍</span>
                    <div className={styles.kbFlowText}>Searches the KB (but keywords are also a guess → might find the wrong doc)</div>
                  </div>
                </div>
                <div>
                  <div className={styles.kbFlowBranchLabel}>"Just answer" wins ✗</div>
                  <div className={`${styles.kbFlowStep} ${styles.kbFlowStepBad}`}>
                    <span className={styles.kbFlowIcon}>🧠</span>
                    <div className={styles.kbFlowText}>Answers from "memory" — skips the KB completely, even though you said to use it</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.callout}>
              <p className={styles.calloutTitle}>"But I specifically wrote to go to the KB!"</p>
              <p className={styles.calloutText}>
                Writing it in the prompt pushes the "search" probability higher. But it's still a probability — not a rule.
                The network doesn't read your prompt and follow orders. It reads your prompt and calculates
                what the most likely next action is. Sometimes "just answer" still wins.
                Same reason it skips any other instruction — it's all the same mechanism.
              </p>
            </div>
          </div>
        </div>

        {/* === 11. ERROR TYPES === */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>Not everything is the same problem</p>
            <h2 className={styles.h2}>Different problems, different causes</h2>
            <p className={styles.bodyText}>
              When something goes wrong, it's important to know <em>what kind</em> of problem it is.
              They look similar but have completely different causes and fixes.
            </p>

            <div className={styles.errorGrid}>
              <div className={styles.errorRow}>
                <div className={`${styles.errorTag} ${styles.tagCode}`}>Code<br/>Bug</div>
                <div className={styles.errorBody}>
                  <span className={styles.errorIcon}>🔴</span>
                  <div className={styles.errorContent}>
                    <p className={styles.errorTitle}>API error / 500 / timeout</p>
                    <p className={styles.errorDesc}>Something broke in the code. The request didn't even reach the model.</p>
                  </div>
                  <div className={styles.errorFix}>Fix: debug the code</div>
                </div>
              </div>

              <div className={styles.errorRow}>
                <div className={`${styles.errorTag} ${styles.tagProvider}`}>Provider<br/>Issue</div>
                <div className={styles.errorBody}>
                  <span className={styles.errorIcon}>🟠</span>
                  <div className={styles.errorContent}>
                    <p className={styles.errorTitle}>Rate limit / overloaded / unavailable</p>
                    <p className={styles.errorDesc}>The model provider is busy or down. High demand, server issues, quota limits.</p>
                  </div>
                  <div className={styles.errorFix}>Fix: wait, or switch provider</div>
                </div>
              </div>

              <div className={styles.errorRow}>
                <div className={`${styles.errorTag} ${styles.tagPrompt}`}>Prompt<br/>Issue</div>
                <div className={styles.errorBody}>
                  <span className={styles.errorIcon}>🟣</span>
                  <div className={styles.errorContent}>
                    <p className={styles.errorTitle}>Answer is wrong / doesn't follow instructions</p>
                    <p className={styles.errorDesc}>The model responded — but not the way you wanted. Skipped steps, wrong tone, missed the KB.</p>
                  </div>
                  <div className={styles.errorFix}>Fix: adjust the prompt or model</div>
                </div>
              </div>

              <div className={styles.errorRow}>
                <div className={`${styles.errorTag} ${styles.tagPrompt}`}>Prompt<br/>Issue</div>
                <div className={styles.errorBody}>
                  <span className={styles.errorIcon}>🎯</span>
                  <div className={styles.errorContent}>
                    <p className={styles.errorTitle}>Answer is not accurate enough</p>
                    <p className={styles.errorDesc}>It responded, followed the structure, but the content is loose or inaccurate.</p>
                  </div>
                  <div className={styles.errorFix}>Fix: better prompt, stronger model, or better KB</div>
                </div>
              </div>

              <div className={styles.errorRow}>
                <div className={`${styles.errorTag} ${styles.tagNormal}`}>Normal<br/>Behavior</div>
                <div className={styles.errorBody}>
                  <span className={styles.errorIcon}>🎲</span>
                  <div className={styles.errorContent}>
                    <p className={styles.errorTitle}>Sometimes right, sometimes wrong — varies</p>
                    <p className={styles.errorDesc}>Same prompt gives good answers 70% of the time, bad answers 30%. Inconsistent.</p>
                  </div>
                  <div className={styles.errorFix}>This is how AI works. Not a bug.</div>
                </div>
              </div>
            </div>

            <p className={`${styles.bodySmall} ${styles.centered}`}>
              Only the first two (red/orange) are actual errors. The rest are the nature of the product.
            </p>
          </div>
        </div>

        {/* === 12. SUMMARY === */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInner}>
            <div className={styles.dividerCenter} />
            <h2 className={styles.h2centered}>5 things to remember</h2>

            <div className={styles.rulesList}>
              <div className={styles.ruleCard}>
                <div className={styles.ruleNum}>1</div>
                <div className={styles.ruleContent}>
                  <h3 className={styles.ruleTitle}>AI predicts — it doesn't obey</h3>
                  <p className={styles.ruleText}>Your prompt steers probabilities. Nothing is guaranteed.</p>
                </div>
              </div>
              <div className={styles.ruleCard}>
                <div className={styles.ruleNum}>2</div>
                <div className={styles.ruleContent}>
                  <h3 className={styles.ruleTitle}>Different model = different product</h3>
                  <p className={styles.ruleText}>Different data, structure, config → different probabilities → different results.</p>
                </div>
              </div>
              <div className={styles.ruleCard}>
                <div className={styles.ruleNum}>3</div>
                <div className={styles.ruleContent}>
                  <h3 className={styles.ruleTitle}>More words ≠ better</h3>
                  <p className={styles.ruleText}>Focused beats long. Always try the shorter version.</p>
                </div>
              </div>
              <div className={styles.ruleCard}>
                <div className={styles.ruleNum}>4</div>
                <div className={styles.ruleContent}>
                  <h3 className={styles.ruleTitle}>Speed, quality, cost — pick two</h3>
                  <p className={styles.ruleText}>Fast = less accurate. Accurate = slower. Long prompt = both worse.</p>
                </div>
              </div>
              <div className={styles.ruleCard}>
                <div className={styles.ruleNum}>5</div>
                <div className={styles.ruleContent}>
                  <h3 className={styles.ruleTitle}>Testing is the work</h3>
                  <p className={styles.ruleText}>Different wording, shorter prompts, different models. That's how you build a good agent.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* === CONTROLS === */}
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
