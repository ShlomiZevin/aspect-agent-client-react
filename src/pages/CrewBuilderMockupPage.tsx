import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './CrewBuilderMockupPage.module.css';

const CREWS = ['Welcome', 'Advisor', 'Review'];

/* ===== Field Definition Component (simple) ===== */
function FieldDef({ name, type, typeClass, description, isOpen, onToggle }: {
  name: string; type: string; typeClass: string;
  description: string; isOpen: boolean; onToggle: () => void;
}) {
  return (
    <div className={styles.fieldDef}>
      <div className={styles.fieldDefHeader} onClick={onToggle}>
        <span className={styles.fieldDefName}>{name}</span>
        <span className={`${styles.fieldDefType} ${typeClass}`}>{type}</span>
        <span className={`${styles.fieldDefChevron} ${isOpen ? styles.fieldDefChevronOpen : ''}`}>▼</span>
      </div>
      {isOpen && (
        <div className={styles.fieldDefBody}>
          <div className={styles.fieldDefRow}>
            <span className={styles.fieldDefLabel}>Description</span>
            <input className={styles.fieldDefValueInput} defaultValue={description} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Field Definition with Triggered Context ===== */
function FieldDefWithTrigger({ name, description, values, onOpenTrigger, isOpen, onToggle }: {
  name: string;
  description: string; values: string[];
  onOpenTrigger: () => void; isOpen: boolean; onToggle: () => void;
}) {
  return (
    <div className={styles.fieldDef}>
      <div className={styles.fieldDefHeader} onClick={onToggle}>
        <span className={styles.fieldDefName}>{name}</span>
        <span className={`${styles.fieldDefType} ${styles.typeEnum}`}>enum</span>
        <span className={styles.fieldDefTriggerBadge}>triggers context</span>
        <span className={`${styles.fieldDefChevron} ${isOpen ? styles.fieldDefChevronOpen : ''}`}>▼</span>
      </div>
      {isOpen && (
        <div className={styles.fieldDefBody}>
          <div className={styles.fieldDefRow}>
            <span className={styles.fieldDefLabel}>Description</span>
            <input className={styles.fieldDefValueInput} defaultValue={description} />
          </div>
          <div className={styles.fieldDefRow}>
            <span className={styles.fieldDefLabel}>Values</span>
            <div className={styles.fieldDefValues}>
              {values.map(v => (
                <span key={v} className={styles.fieldDefValueChip}>{v}</span>
              ))}
            </div>
          </div>
          <button className={styles.addFieldBtn} onClick={onOpenTrigger}>
            🎯 Edit triggered context for {name}
          </button>
        </div>
      )}
    </div>
  );
}

/* ===== Add Chain Step Modal ===== */

function AddChainStepModal({ onClose }: { onClose: () => void }) {
  const [speaksToUser, setSpeaksToUser] = useState(false);
  const [isAsync, setIsAsync] = useState(false);
  const [connectKB, setConnectKB] = useState(false);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Add Chain Step</span>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Step name</label>
              <input className={styles.formInput} placeholder="e.g. intent_analyzer" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Role preset</label>
              <span className={styles.formHint}>Optional — start from a template</span>
              <select className={styles.formSelect}>
                <option value="">Custom</option>
                <option value="talker">Talker (speaks to user)</option>
                <option value="thinker">Thinker (silent analysis)</option>
                <option value="extractor">Extractor (collects fields)</option>
                <option value="profiler">Profiler (async deep analysis)</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Model</label>
            <select className={styles.formSelect}>
              <option>gemini-2.5-flash</option>
              <option>gpt-4o</option>
              <option>gpt-4o-mini</option>
              <option>gpt-5</option>
              <option>claude-sonnet-4-6</option>
              <option>claude-opus-4-6</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Prompt</label>
            <span className={styles.formHint}>What should this step do?</span>
            <textarea className={styles.formTextarea} style={{ minHeight: 80 }}
              placeholder="e.g. Analyze the conversation and determine the customer's intent. Return a JSON with..." />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>History depth</label>
              <span className={styles.formHint}>How many messages to include</span>
              <select className={styles.formSelect}>
                <option>All messages</option>
                <option>Last 10</option>
                <option>Last 5</option>
                <option>Last message only</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Writes output to</label>
              <span className={styles.formHint}>Where results are saved</span>
              <select className={styles.formSelect}>
                <option>Context (conversation)</option>
                <option>Context (user-level)</option>
                <option>Collected fields</option>
              </select>
            </div>
          </div>

          <div
            className={`${styles.formToggleRow} ${speaksToUser ? styles.formToggleRowActive : ''}`}
            onClick={() => setSpeaksToUser(!speaksToUser)}
          >
            <div className={`${styles.kbToggle} ${speaksToUser ? styles.kbToggleOn : ''}`}>
              <div className={styles.kbToggleDot} />
            </div>
            <div>
              <div className={styles.formToggleLabel}>💬 Speaks to user</div>
              <div className={styles.formToggleHint}>This step's output is streamed to the chat</div>
            </div>
          </div>

          <div
            className={`${styles.formToggleRow} ${isAsync ? styles.formToggleRowActive : ''}`}
            onClick={() => setIsAsync(!isAsync)}
          >
            <div className={`${styles.kbToggle} ${isAsync ? styles.kbToggleOn : ''}`}>
              <div className={styles.kbToggleDot} />
            </div>
            <div>
              <div className={styles.formToggleLabel}>⏱️ Async (background)</div>
              <div className={styles.formToggleHint}>Runs in the background — doesn't block the response</div>
            </div>
          </div>

          <div
            className={`${styles.formToggleRow} ${connectKB ? styles.formToggleRowActive : ''}`}
            onClick={() => setConnectKB(!connectKB)}
          >
            <div className={`${styles.kbToggle} ${connectKB ? styles.kbToggleOn : ''}`}>
              <div className={styles.kbToggleDot} />
            </div>
            <div>
              <div className={styles.formToggleLabel}>📁 Connect to Knowledge Base</div>
              <div className={styles.formToggleHint}>This step can search the KB for relevant documents</div>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.modalBtnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.modalBtnPrimary} onClick={onClose}>Add Step</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Add Field Modal (simplified) ===== */

function AddFieldModal({ onClose }: { onClose: () => void }) {
  const [fieldType, setFieldType] = useState('string');

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Add Field</span>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Field name</label>
              <input className={styles.formInput} placeholder="e.g. marital_status" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Type</label>
              <select className={styles.formSelect} value={fieldType} onChange={e => setFieldType(e.target.value)}>
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="enum">Enum (list of values)</option>
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <span className={styles.formHint}>How should the model extract this field from the conversation?</span>
            <textarea className={styles.formTextarea} placeholder="e.g. The customer's marital status — single, married, divorced, or widowed" />
          </div>
          {fieldType === 'enum' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Allowed values</label>
              <span className={styles.formHint}>Type a value and press Enter to add</span>
              <div className={styles.valuesInput}>
                <span className={styles.valueChipEditable}>single <span className={styles.valueChipRemove}>×</span></span>
                <span className={styles.valueChipEditable}>married <span className={styles.valueChipRemove}>×</span></span>
                <span className={styles.valueChipEditable}>divorced <span className={styles.valueChipRemove}>×</span></span>
                <span className={styles.valueChipEditable}>widowed <span className={styles.valueChipRemove}>×</span></span>
                <input className={styles.valuesAddInput} placeholder="Add value..." />
              </div>
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.modalBtnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.modalBtnPrimary} onClick={onClose}>Add Field</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Triggered Context Modal (the big one) ===== */

function TriggeredContextModal({ onClose }: { onClose: () => void }) {
  const [activeField, setActiveField] = useState('intent');

  const fields: Record<string, { emoji: string; values: string[]; contexts: Record<string, string> }> = {
    intent: {
      emoji: '🎯',
      values: ['open_account', 'close_account', 'complaint', 'info_request'],
      contexts: {
        open_account: '## Open Account — Handling Guide\n\nThe customer wants to open an account.\n\nGoals:\n- Qualify the customer (employment, income, age)\n- Build excitement about the right account type\n- Never discuss fees or conditions proactively\n\nTone: Enthusiastic but professional. Make them feel this is the right decision.\n\nQuestions to ask naturally:\n- Employment status\n- Monthly income range\n- Primary use (salary, savings, both)\n\nProducts to suggest based on profile:\n- Young (18-25): Student account, zero fees\n- Salaried: Classic checking + credit card bundle\n- Self-employed: Business-lite account\n- High income: Premium account with advisor',
        close_account: '## Close Account — Retention Guide\n\nThe customer wants to close their account.\n\nPriority: Understand WHY before offering solutions.\n\nStep 1 — Listen:\n- "I understand. Can I ask what led to this decision?"\n- Don\'t interrupt. Let them finish.\n\nStep 2 — Acknowledge:\n- Validate their frustration or reason\n- Never be defensive about the bank\n\nStep 3 — Offer alternatives (only if appropriate):\n- Fee reduction\n- Account upgrade\n- Service improvement commitment\n\nStep 4 — If they insist:\n- Guide them through the process respectfully\n- Mention what they need to bring/do\n- Leave the door open: "We\'d love to have you back"',
        complaint: '## Complaint Handling Guide\n\nThe customer has a complaint.\n\nRule #1: Never be defensive. Ever.\n\nFlow:\n1. Acknowledge: "I hear you, and I\'m sorry about this experience"\n2. Understand: Ask clarifying questions\n3. Document: Make sure you capture the issue clearly\n4. Resolve or escalate: Offer a solution or explain next steps\n5. Follow up: "I want to make sure this gets resolved"\n\nTone: Calm, empathetic, solution-oriented.\n\nPhrases to use:\n- "That shouldn\'t have happened"\n- "Let me look into this for you"\n- "I want to make this right"\n\nPhrases to NEVER use:\n- "That\'s our policy"\n- "There\'s nothing I can do"\n- "You should have..."',
        info_request: '## Information Request Guide\n\nThe customer is looking for information.\n\nApproach: Be helpful, concise, and proactive.\n\nRules:\n- Answer the question directly first\n- Then offer related helpful info\n- If you don\'t know, say so — don\'t guess\n- Offer to connect them with a specialist if needed\n\nTone: Knowledgeable, friendly, efficient.',
      },
    },
    user_type: {
      emoji: '😤',
      values: ['cooperative', 'stubborn', 'confused', 'kid'],
      contexts: {
        cooperative: '## Cooperative Customer\n\nThis customer is engaged and willing.\n\nApproach: Match their energy. Be efficient.\n- Move at their pace\n- You can ask multiple things if they\'re flowing\n- Be direct with recommendations',
        stubborn: '## Resistant / Stubborn Customer\n\nThis customer pushes back on suggestions.\n\nKey principles:\n- NEVER push. Ever. Pushing makes it worse.\n- Lead with empathy: "I totally understand your hesitation"\n- Use facts, not pressure\n- Give them control: "What would work best for you?"\n- Patience is everything — if they say no, respect it\n\nTone: Calm, respectful, non-judgmental.\n\nAvoid:\n- "But this is the best option"\n- "You should really consider..."\n- Any urgency or pressure tactics',
        confused: '## Confused Customer\n\nThis customer is having trouble following.\n\nKey principles:\n- Simplify EVERYTHING\n- One concept at a time\n- Use analogies from everyday life\n- Confirm understanding: "Does that make sense?"\n- Never make them feel dumb\n\nTone: Patient, warm, encouraging.\n\nStructure:\n- Short sentences\n- No jargon\n- Repeat key points\n- Summarize frequently',
        kid: '## Young / Minor Customer\n\nThis customer is young (under 18 or very young adult).\n\nKey principles:\n- Simple, friendly language\n- Be encouraging and positive\n- Explain banking basics naturally\n- Make it feel fun, not scary\n- If they need a parent/guardian, guide them gently\n\nTone: Friendly, playful, supportive.\n\nAvoid:\n- Complex financial terminology\n- Condescending tone\n- Assuming they know banking concepts',
      },
    },
  };

  const activeData = fields[activeField];
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const charCount = (v: string) => { const c = fields[activeField]?.contexts[v]?.length || 0; return c > 200 ? `${Math.round(c / 100) * 100}+ chars` : `${c} chars`; };

  const selectField = (key: string) => { setActiveField(key); setActiveValue(null); };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.tcModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <span className={styles.modalTitle}>🎯 Triggered Context</span>
            <span className={styles.formHint} style={{ display: 'block', marginTop: 4 }}>
              When a field value is detected → a full context block is injected into the prompt
            </span>
          </div>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.tcLayout}>
          {/* LEFT — fields + value tree */}
          <div className={styles.tcSidebar}>
            {Object.entries(fields).map(([key, f]) => (
              <div key={key}>
                <button
                  className={`${styles.tcFieldBtn} ${activeField === key ? styles.tcFieldBtnActive : ''}`}
                  onClick={() => selectField(key)}
                >
                  <span className={styles.tcFieldEmoji}>{f.emoji}</span>
                  <div className={styles.tcFieldInfo}>
                    <span className={styles.tcFieldName}>{key}</span>
                    <span className={styles.tcFieldCount}>{f.values.length} values</span>
                  </div>
                </button>
                {activeField === key && (
                  <div className={styles.tcValueList}>
                    {f.values.map(v => (
                      <button key={v}
                        className={`${styles.tcValueBtn} ${activeValue === v ? styles.tcValueBtnActive : ''}`}
                        onClick={() => setActiveValue(v)}
                      >
                        <span className={styles.tcValueDot} />
                        <span>{v}</span>
                        <span className={styles.tcValueChars}>{charCount(v)}</span>
                      </button>
                    ))}
                    <button className={styles.tcValueBtnAdd}>+ value</button>
                  </div>
                )}
              </div>
            ))}
            <button className={styles.tcAddValue} style={{ marginTop: 8 }}>
              + Add field
            </button>
          </div>

          {/* RIGHT — overview or editor */}
          <div className={styles.tcMain}>
            {activeValue ? (
              /* EDITOR — single value, full textarea */
              <>
                <div className={styles.tcEditorHeader}>
                  <button className={styles.tcBackBtn} onClick={() => setActiveValue(null)}>←</button>
                  <span className={styles.tcEditorLabel}>{activeValue}</span>
                  <span className={styles.tcEditorMeta}>{charCount(activeValue)}</span>
                </div>
                <div className={styles.tcEditorPane}>
                  <textarea className={styles.tcFullTextarea}
                    defaultValue={activeData.contexts[activeValue]}
                    key={`${activeField}-${activeValue}`} />
                </div>
              </>
            ) : activeField ? (
              /* OVERVIEW — values as clickable rows with preview */
              <div className={styles.tcOverview}>
                {activeData.values.map(v => (
                  <div key={v} className={styles.tcOverviewItem} onClick={() => setActiveValue(v)}>
                    <div className={styles.tcOverviewName}>
                      {v}
                      <span className={styles.tcOverviewArrow}>→</span>
                    </div>
                    <div className={styles.tcOverviewPreview}>
                      {activeData.contexts[v]}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* EMPTY — nothing selected */
              <div className={styles.tcEmpty}>
                <span className={styles.tcEmptyIcon}>🎯</span>
                <span className={styles.tcEmptyText}>Select a field to see its values<br />and context blocks</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.modalBtnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.modalBtnPrimary} onClick={onClose}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Main ===== */

export function CrewBuilderMockupPage() {
  const [activeCrew, setActiveCrew] = useState(1);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [openFields, setOpenFields] = useState<Set<string>>(new Set());
  const [showAddField, setShowAddField] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [showTriggerContext, setShowTriggerContext] = useState(false);

  const toggle = (s: string) => {
    const next = new Set(openSections);
    next.has(s) ? next.delete(s) : next.add(s);
    setOpenSections(next);
  };

  const toggleField = (f: string) => {
    const next = new Set(openFields);
    next.has(f) ? next.delete(f) : next.add(f);
    setOpenFields(next);
  };

  const isOpen = (s: string) => openSections.has(s);

  return (
    <div className={styles.container}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <Link to="/lybi" className={styles.logo}>
            <img src="/img/lybi-logo-transparent.png" alt="Lybi" />
          </Link>
          <span className={styles.topBadge}>Crew Builder</span>
          <span className={styles.topTitle}>Banking Onboarder</span>
        </div>
        <div className={styles.topRight}>
          <span className={styles.mockBadge}>Mockup</span>
        </div>
      </div>

      <div className={styles.main}>
        {/* ===== LEFT: Chat ===== */}
        <div className={styles.chatArea}>
          <div className={styles.chatHeader}>
            <div className={styles.crewTabs}>
              {CREWS.map((c, i) => (
                <button key={c}
                  className={`${styles.crewTab} ${i === activeCrew ? styles.crewTabActive : ''}`}
                  onClick={() => setActiveCrew(i)}
                >{c}</button>
              ))}
            </div>
          </div>
          <div className={styles.chatMessages}>
            <div className={styles.msgBot}>
              היי! 👋 אני ליבי, הבנקאית הדיגיטלית שלך. מה שמך?
            </div>
            <div className={styles.msgUser}>
              שרה, אני רוצה לפתוח חשבון
            </div>
            <div className={styles.msgBot}>
              שרה, נעים מאוד! 😊 אשמח לעזור לך לפתוח חשבון. כדי שאוכל להתאים לך את ההצעה הכי טובה — מה גילך?
            </div>
            <div className={styles.msgUser}>
              32
            </div>
            <div className={styles.msgBot}>
              מעולה שרה! ובמה את עוסקת? שכירה, עצמאית, סטודנטית?
            </div>
          </div>
          <div className={styles.chatInput}>
            <input className={styles.chatInputField} placeholder="Type a message..." readOnly />
          </div>
        </div>

        {/* ===== RIGHT: Editor ===== */}
        <div className={styles.editorPanel}>
          <div className={styles.editorHeader}>
            <span className={styles.editorTitle}>Crew Editor</span>
            <select className={styles.editorCrewSelect} value={activeCrew} onChange={e => setActiveCrew(Number(e.target.value))}>
              {CREWS.map((c, i) => <option key={c} value={i}>{c}</option>)}
            </select>
          </div>

          <div className={styles.editorBody}>

            {/* === AGENT PERSONA === */}
            <div className={styles.section}>
              <div className={styles.sectionHeader} onClick={() => toggle('agent-persona')}>
                <span className={styles.sectionLabel}>
                  🎭 Agent Persona
                  <span className={`${styles.sectionBadge} ${styles.badgeAgent}`}>Agent-level</span>
                </span>
                <span className={`${styles.chevron} ${isOpen('agent-persona') ? styles.chevronOpen : ''}`}>▼</span>
              </div>
              {isOpen('agent-persona') && (
                <div className={styles.sectionContent}>
                  <span className={styles.textareaLabel}>Shared across all crew members</span>
                  <textarea className={styles.textarea} defaultValue={`You are LYBI — a warm, confident digital banker. You combine clarity with the ease of a friend. You speak Hebrew naturally, never bureaucratic.\n\nCore traits:\n- Conversational and adaptive\n- Sales instinct wrapped in genuine care\n- Direct but never pushy`} />
                </div>
              )}
            </div>

            {/* === TRIGGERED CONTEXT (Agent-level) === */}
            <div className={styles.section}>
              <div className={styles.sectionHeader} onClick={() => toggle('trigger-context')}>
                <span className={styles.sectionLabel}>
                  🎯 Triggered Context
                  <span className={`${styles.sectionBadge} ${styles.badgeAgent}`}>Agent-level</span>
                  <span className={`${styles.sectionBadge} ${styles.badgeNew}`}>New</span>
                </span>
                <span className={`${styles.chevron} ${isOpen('trigger-context') ? styles.chevronOpen : ''}`}>▼</span>
              </div>
              {isOpen('trigger-context') && (
                <div className={styles.sectionContent}>
                  <span className={styles.textareaLabel}>
                    Field value → full context block injected into the prompt. Like a personal KB per user persona — but precise and deterministic.
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className={`${styles.fieldTag} ${styles.fieldCollected}`} style={{ cursor: 'pointer' }}
                      onClick={() => setShowTriggerContext(true)}>🎯 intent — 4 values</span>
                    <span className={`${styles.fieldTag} ${styles.fieldCollected}`} style={{ cursor: 'pointer' }}
                      onClick={() => setShowTriggerContext(true)}>😤 user_type — 4 values</span>
                  </div>
                  <button className={styles.addFieldBtn} style={{ marginTop: 8 }}
                    onClick={() => setShowTriggerContext(true)}>Edit triggered context</button>
                </div>
              )}
            </div>

            {/* === CREW PERSONA === */}
            <div className={styles.section}>
              <div className={styles.sectionHeader} onClick={() => toggle('crew-persona')}>
                <span className={styles.sectionLabel}>
                  🎭 Crew Persona
                  <span className={`${styles.sectionBadge} ${styles.badgeCrew}`}>Crew-level</span>
                  <span className={`${styles.sectionBadge} ${styles.badgeNew}`}>New</span>
                </span>
                <span className={`${styles.chevron} ${isOpen('crew-persona') ? styles.chevronOpen : ''}`}>▼</span>
              </div>
              {isOpen('crew-persona') && (
                <div className={styles.sectionContent}>
                  <span className={styles.textareaLabel}>Specific to this crew member only</span>
                  <textarea className={styles.textarea} style={{ minHeight: 60 }} defaultValue={`In this phase you are the financial advisor. Be analytical yet warm. Ask probing questions about finances naturally — never sound like a form.`} />
                </div>
              )}
            </div>

            {/* === CHAIN STEPS HEADER + ADD === */}
            <div className={styles.section}>
              <div className={styles.sectionHeader} style={{ justifyContent: 'space-between' }}>
                <span className={styles.sectionLabel}>🔗 Chain Steps</span>
                <button className={styles.addFieldBtn} style={{ width: 'auto', margin: 0, padding: '4px 12px', fontSize: '11px' }}
                  onClick={() => setShowAddStep(true)}>+ Add step</button>
              </div>
            </div>

            {/* === TALKER === */}
            <div className={styles.section}>
              <div className={styles.sectionHeader} onClick={() => toggle('talker')}>
                <span className={styles.sectionLabel}>💬 Talker</span>
                <span className={`${styles.chevron} ${isOpen('talker') ? styles.chevronOpen : ''}`}>▼</span>
              </div>
              {isOpen('talker') && (
                <div className={styles.sectionContent}>
                  <div className={styles.modelRow}>
                    <span className={styles.modelLabel}>Model</span>
                    <select className={styles.modelSelect} defaultValue="gemini-2.5-flash">
                      <option>gemini-2.5-flash</option>
                      <option>gpt-4o</option>
                      <option>gpt-5</option>
                      <option>claude-sonnet-4-6</option>
                    </select>
                  </div>
                  <span className={styles.textareaLabel}>Guidance / Instructions</span>
                  <textarea className={styles.textarea} style={{ minHeight: 100 }} defaultValue={`You are LYBI's account advisor. Follow the thinker's strategy.\n\nRules:\n- Ask ONE question at a time\n- Never mention fees unless the customer asks\n- Use the customer's name naturally\n- If the thinker says "readyToTransfer" — summarize and hand off`} />
                </div>
              )}
            </div>

            {/* === THINKER === */}
            <div className={styles.section}>
              <div className={styles.sectionHeader} onClick={() => toggle('thinker')}>
                <span className={styles.sectionLabel}>🤔 Thinker</span>
                <span className={`${styles.chevron} ${isOpen('thinker') ? styles.chevronOpen : ''}`}>▼</span>
              </div>
              {isOpen('thinker') && (
                <div className={styles.sectionContent}>
                  <div className={styles.modelRow}>
                    <span className={styles.modelLabel}>Model</span>
                    <select className={styles.modelSelect} defaultValue="claude-sonnet-4-6">
                      <option>claude-sonnet-4-6</option>
                      <option>claude-opus-4-6</option>
                      <option>gpt-4o</option>
                      <option>gpt-5</option>
                    </select>
                  </div>
                  <span className={styles.textareaLabel}>Thinking prompt</span>
                  <textarea className={styles.textarea} style={{ minHeight: 80 }} defaultValue={`Analyze the conversation. Return JSON with strategy for the talker.\nAssess: profile completeness, customer readiness, next question.`} />

                  <span className={styles.textareaLabel} style={{ marginTop: 12 }}>Output schema (JSON fields)</span>
                  <div className={styles.schemaGrid}>
                    <div className={styles.schemaRow}>
                      <span className={styles.schemaField}>intent</span>
                      <span className={styles.schemaType}>enum</span>
                      <span className={styles.schemaDesc}>open_account | close_account | complaint | info_request</span>
                    </div>
                    <div className={styles.schemaRow}>
                      <span className={styles.schemaField}>user_type</span>
                      <span className={styles.schemaType}>enum</span>
                      <span className={styles.schemaDesc}>cooperative | stubborn | confused | kid</span>
                    </div>
                    <div className={styles.schemaRow}>
                      <span className={styles.schemaField}>nextQuestion</span>
                      <span className={styles.schemaType}>string</span>
                      <span className={styles.schemaDesc}>The next question to ask the customer</span>
                    </div>
                    <div className={styles.schemaRow}>
                      <span className={styles.schemaField}>readyToTransfer</span>
                      <span className={styles.schemaType}>boolean</span>
                      <span className={styles.schemaDesc}>Should we move to the next crew?</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* === FIELD DEFINITIONS === */}
            <div className={styles.section}>
              <div className={styles.sectionHeader} onClick={() => toggle('fields')}>
                <span className={styles.sectionLabel}>📝 Fields</span>
                <span className={`${styles.chevron} ${isOpen('fields') ? styles.chevronOpen : ''}`}>▼</span>
              </div>
              {isOpen('fields') && (
                <div className={styles.sectionContent}>
                  <span className={styles.textareaLabel}>Fields to collect in this crew. Any chain step can extract them.</span>

                  <div className={styles.fieldDefList}>

                    <FieldDef
                      name="name" type="string" typeClass={styles.typeString}

                      description="Customer's first name"
                      isOpen={openFields.has('name')} onToggle={() => toggleField('name')}
                    />

                    <FieldDef
                      name="age" type="number" typeClass={styles.typeNumber}

                      description="Customer's age"
                      isOpen={openFields.has('age')} onToggle={() => toggleField('age')}
                    />

                    <FieldDefWithTrigger
                      name="intent"
                      description="What the customer wants to do"
                      values={['open_account', 'close_account', 'complaint', 'info_request']}
                      onOpenTrigger={() => setShowTriggerContext(true)}
                      isOpen={openFields.has('intent')} onToggle={() => toggleField('intent')}
                    />

                    <FieldDefWithTrigger
                      name="user_type"
                      description="Customer's personality / communication style"
                      values={['cooperative', 'stubborn', 'confused', 'kid']}
                      onOpenTrigger={() => setShowTriggerContext(true)}
                      isOpen={openFields.has('user_type')} onToggle={() => toggleField('user_type')}
                    />

                    <FieldDef
                      name="employment" type="string" typeClass={styles.typeString}

                      description="Employment status (employed, self-employed, student, unemployed)"
                      isOpen={openFields.has('employment')} onToggle={() => toggleField('employment')}
                    />

                    <FieldDef
                      name="income_range" type="string" typeClass={styles.typeString}

                      description="Monthly income range"
                      isOpen={openFields.has('income_range')} onToggle={() => toggleField('income_range')}
                    />

                    <button className={styles.addFieldBtn} onClick={() => setShowAddField(true)}>+ Add field</button>
                  </div>
                </div>
              )}
            </div>

            {/* === KNOWLEDGE BASE === */}
            <div className={styles.section}>
              <div className={styles.sectionHeader} onClick={() => toggle('kb')}>
                <span className={styles.sectionLabel}>📁 Knowledge Base</span>
                <span className={`${styles.chevron} ${isOpen('kb') ? styles.chevronOpen : ''}`}>▼</span>
              </div>
              {isOpen('kb') && (
                <div className={styles.sectionContent}>
                  <div className={styles.kbRow}>
                    <div className={`${styles.kbToggle} ${styles.kbToggleOn}`}>
                      <div className={styles.kbToggleDot} />
                    </div>
                    <span className={styles.kbName}>Onboarding KB</span>
                  </div>
                  <div className={styles.kbRow}>
                    <div className={styles.kbToggle}>
                      <div className={styles.kbToggleDot} />
                    </div>
                    <span className={styles.kbName}>Product Catalog</span>
                  </div>
                  <div className={styles.kbRow}>
                    <div className={styles.kbToggle}>
                      <div className={styles.kbToggleDot} />
                    </div>
                    <span className={styles.kbName}>Competitor Info</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddField && <AddFieldModal onClose={() => setShowAddField(false)} />}
      {showAddStep && <AddChainStepModal onClose={() => setShowAddStep(false)} />}
      {showTriggerContext && <TriggeredContextModal onClose={() => setShowTriggerContext(false)} />}
    </div>
  );
}
