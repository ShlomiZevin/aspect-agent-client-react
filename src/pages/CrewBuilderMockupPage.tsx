import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './CrewBuilderMockupPage.module.css';

const CREWS = ['Welcome', 'Advisor', 'Review'];

/* ===== Chain Data ===== */
const MAIN_CHAIN = [
  { id: 'input-extractor', icon: '📥', name: 'Input Extractor', color: '#f59e0b', model: 'gemini-2.5-flash', history: 'Last 2–3', output: 'Fields → DB', kb: false, speaks: false, prompt: 'How to extract fields from the user message.\nBe precise — extract only what the user explicitly said or clearly implied.\nDon\'t infer or guess.' },
  { id: 'strategic', icon: '🧠', name: 'Strategic', color: '#6366f1', model: 'claude-sonnet-4-6', history: 'Full', output: 'Strategy JSON → context', kb: true, speaks: false, prompt: 'Analyze the conversation. Return JSON:\n- nextQuestion: what to ask next\n- strategy: how to approach\n- readyToTransfer: boolean' },
  { id: 'talker', icon: '💬', name: 'Talker', color: '#8b5cf6', model: 'gemini-2.5-flash', history: 'Last 3–5', output: 'Chat response', kb: false, speaks: true, prompt: 'Follow the strategy. Speak naturally in Hebrew.\n\nRules:\n- Ask ONE question at a time\n- Never mention fees unless asked\n- Use the customer\'s name naturally' },
  { id: 'formatter', icon: '✨', name: 'Formatter', color: '#64748b', model: 'gpt-4o-mini', history: 'None', output: 'JSON for UI', kb: false, speaks: true, prompt: 'Convert the response to structured JSON for UI rendering.\nReturn: { type: "text" | "card" | "list", content: ... }' },
];

const BG_CHAIN = [
  { id: 'vibe-extractor', icon: '🧐', name: 'Vibe Extractor', color: '#ec4899', model: 'gpt-4o', history: 'Last 5–8', output: 'Fields → Memory', kb: false, speaks: false, prompt: 'How to assess the user\'s personality from conversation patterns.\nLook at tone, patience, engagement level — not what they said, but how.' },
];

const OFFLINE_CHAIN = [
  { id: 'summarizer', icon: '📝', name: 'Summarizer', color: '#f97316', model: 'gpt-4o-mini', history: 'Recent (since last summary)', output: 'Summary → Memory', kb: false, speaks: false, prompt: 'Summarize the conversation so far.\nCapture: key facts learned, decisions made, current state, open questions.\nBe concise — this summary replaces message history.' },
];

const TRANSITION = { id: 'transitioner', icon: '🔀', name: 'Transitioner', color: '#0ea5e9', type: 'fields' as const, rule: 'When all required fields collected AND readyToTransfer = true → move to Review' };

const ALL_STEPS = [...MAIN_CHAIN, ...BG_CHAIN, ...OFFLINE_CHAIN];

const FIELDS = [
  { name: 'name', type: 'string', extractor: 'input', domain: 'customer_profile', description: 'Customer\'s first name' },
  { name: 'age', type: 'number', extractor: 'input', domain: 'customer_profile', description: 'Customer\'s age' },
  { name: 'intent', type: 'enum', extractor: 'input', domain: null, description: 'What the customer wants to do', values: ['open_account', 'close_account', 'complaint', 'info_request'], triggers: true },
  { name: 'employment', type: 'string', extractor: 'input', domain: 'customer_profile', description: 'Employment status' },
  { name: 'income_range', type: 'string', extractor: 'input', domain: 'customer_profile', description: 'Monthly income range' },
  { name: 'user_type', type: 'enum', extractor: 'vibe', domain: 'user_persona', description: 'Customer personality / communication style', values: ['cooperative', 'stubborn', 'confused', 'kid'], triggers: true },
  { name: 'mood', type: 'string', extractor: 'vibe', domain: null, description: 'Current emotional state' },
];

const BRAIN_DOMAINS = [
  {
    name: 'customer_profile', icon: '👤',
    fields: ['name', 'age', 'employment', 'income_range'],
    writers: ['📥 Input Extractor'],
    readers: ['🧠 Strategic', '💬 Talker'],
  },
  {
    name: 'user_persona', icon: '🎭',
    fields: ['user_type', 'mood', 'patience_level'],
    writers: ['🧐 Vibe Extractor'],
    readers: ['🧠 Strategic'],
  },
  {
    name: 'strategy', icon: '🧠',
    fields: ['nextQuestion', 'approach', 'readyToTransfer'],
    writers: ['🧠 Strategic'],
    readers: ['💬 Talker'],
  },
  {
    name: 'conversation', icon: '💬',
    fields: ['summary', 'key_facts', 'open_questions'],
    writers: ['📝 Summarizer'],
    readers: ['🧠 Strategic', '💬 Talker'],
  },
];

const STEP_TYPES = [
  { id: 'input-extractor', icon: '📥', name: 'Input Extractor', desc: 'Extract concrete fields from user message', color: '#f59e0b', layer: 'main' },
  { id: 'strategic', icon: '🧠', name: 'Strategic', desc: 'Analyze everything, recommend strategy', color: '#6366f1', layer: 'main' },
  { id: 'talker', icon: '💬', name: 'Talker', desc: 'Speak the strategy to the user', color: '#8b5cf6', layer: 'main' },
  { id: 'formatter', icon: '✨', name: 'Formatter', desc: 'Structure response as JSON for UI', color: '#64748b', layer: 'main' },
  { id: 'vibe-extractor', icon: '🧐', name: 'Vibe Extractor', desc: 'Read personality, mood, type from conversation', color: '#ec4899', layer: 'bg' },
  { id: 'summarizer', icon: '📝', name: 'Summarizer', desc: 'Periodic conversation summary (runs every X tokens)', color: '#f97316', layer: 'offline' },
];

/* ===== Fixed config per step type ===== */
const STEP_FIXED: Record<string, { speaks: string; output: string; timing: string; kbOption: boolean; historyOptions: string[]; runEvery?: boolean }> = {
  'input-extractor': { speaks: 'No', output: 'Fields → Memory', timing: 'Sync', kbOption: false, historyOptions: ['Last 2–3', 'Last 3–5', 'Last message only'] },
  'vibe-extractor': { speaks: 'No', output: 'Fields → Memory', timing: 'Background', kbOption: false, historyOptions: ['Last 5–8', 'Last 3–5', 'Full'] },
  'strategic': { speaks: 'No', output: 'Strategy → Memory', timing: 'Sync', kbOption: true, historyOptions: ['Full', 'Last 10', 'Last 5–8', 'Summary'] },
  'talker': { speaks: 'Yes', output: 'Chat response', timing: 'Sync', kbOption: true, historyOptions: ['Last 3–5', 'Last 5–8', 'Summary'] },
  'formatter': { speaks: 'Yes (replaces)', output: 'JSON for UI', timing: 'Sync', kbOption: false, historyOptions: ['None'] },
  'summarizer': { speaks: 'No', output: 'Summary → Memory', timing: 'Offline', kbOption: false, historyOptions: ['Recent (since last summary)'], runEvery: true },
};

/* ===== Step Editor Modal ===== */
function StepEditorModal({ step, onClose }: { step: typeof ALL_STEPS[number]; onClose: () => void }) {
  const isExtractor = step.id.includes('extractor');
  const stepFields = FIELDS.filter(f => (step.id === 'input-extractor' && f.extractor === 'input') || (step.id === 'vibe-extractor' && f.extractor === 'vibe'));
  const fixed = STEP_FIXED[step.id] || {};

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.builderModal} onClick={e => e.stopPropagation()}>
        <div className={styles.builderModalHeader}>
          <div className={styles.builderModalTitle}>
            <span className={styles.builderModalIcon} style={{ background: `${step.color}18`, color: step.color }}>{step.icon}</span>
            <span>{step.name}</span>
          </div>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.builderModalBody}>
          {/* Editable settings */}
          <div className={styles.settingsGrid}>
            <div className={styles.settingsItem}>
              <span className={styles.settingsLabel}>🧠 Model</span>
              <select className={styles.settingsSelect} defaultValue={step.model}>
                <option>gemini-2.5-flash</option><option>gpt-4o</option><option>gpt-4o-mini</option>
                <option>gpt-5</option><option>claude-sonnet-4-6</option><option>claude-opus-4-6</option>
              </select>
            </div>
            <div className={styles.settingsItem}>
              <span className={styles.settingsLabel}>📖 History</span>
              {fixed.historyOptions?.length === 1 ? (
                <span className={styles.settingsFixed}>{fixed.historyOptions[0]}</span>
              ) : (
                <select className={styles.settingsSelect} defaultValue={step.history}>
                  {(fixed.historyOptions || []).map(h => <option key={h}>{h}</option>)}
                </select>
              )}
            </div>
            {fixed.kbOption && (
              <div className={styles.settingsItem}>
                <span className={styles.settingsLabel}>📁 KB</span>
                <select className={styles.settingsSelect} defaultValue={step.kb ? 'Onboarding KB' : 'No'}>
                  <option>No</option><option>Onboarding KB</option><option>Product Catalog</option><option>Both</option>
                </select>
              </div>
            )}
            {'runEvery' in fixed && (
              <div className={styles.settingsItem}>
                <span className={styles.settingsLabel}>🔄 Run every</span>
                <select className={styles.settingsSelect} defaultValue="2000">
                  <option value="1000">1,000 tokens</option>
                  <option value="2000">2,000 tokens</option>
                  <option value="4000">4,000 tokens</option>
                  <option value="8000">8,000 tokens</option>
                </select>
              </div>
            )}
          </div>

          {/* Fixed settings (read-only) */}
          <div className={styles.fixedRow}>
            <span className={styles.fixedChip}>💬 {fixed.speaks}</span>
            <span className={styles.fixedChip}>📤 {fixed.output}</span>
            <span className={styles.fixedChip}>⏱️ {fixed.timing}</span>
            {!fixed.kbOption && <span className={styles.fixedChip}>📁 No KB</span>}
          </div>

          {/* Memory: Reads from (top — only for steps that read) */}
          {['strategic', 'talker', 'summarizer'].includes(step.id) && (
            <div className={styles.brainEditorSection}>
              <span className={styles.settingsLabel}>📖 Reads from Memory</span>
              <p className={styles.brainEditorHint}>Which domains does this step get in its context</p>
              <div className={styles.brainEditorChecks}>
                {BRAIN_DOMAINS.map(d => (
                  <label key={d.name} className={styles.brainEditorCheck}>
                    <input type="checkbox" defaultChecked={d.readers.some(r => r.includes(step.name))} />
                    <span>{d.icon} {d.name}</span>
                    <span className={styles.brainEditorFieldCount}>{d.fields.length}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Fields this step extracts (only for extractors) */}
          {isExtractor && stepFields.length > 0 && (
            <div className={styles.brainEditorSection}>
              <span className={styles.settingsLabel}>Fields extracted by this step</span>
              <div className={styles.settingsFieldsList}>
                {stepFields.map(f => (
                  <div key={f.name} className={styles.settingsFieldRow}>
                    <span className={styles.settingsFieldName}>{f.name}</span>
                    <span className={styles.settingsFieldType}>{f.type}</span>
                    {f.triggers && <span className={styles.settingsFieldTrigger}>triggers context</span>}
                    <span className={styles.settingsFieldDesc}>{f.description}</span>
                  </div>
                ))}
              </div>
              <span className={styles.settingsHint}>Manage fields in the Fields tab</span>
            </div>
          )}

          {/* Prompt */}
          <div className={styles.settingsPromptSection}>
            <span className={styles.settingsLabel}>📋 Prompt {isExtractor && <span className={styles.settingsHint}>— how to extract (fields come from the Fields tab)</span>}</span>
            <textarea className={styles.settingsTextarea} defaultValue={step.prompt} />
          </div>

        </div>

        <div className={styles.builderModalFooter}>
          <button className={styles.builderModalRemove}>Remove from chain</button>
          <div>
            <button className={styles.modalBtnSecondary} onClick={onClose}>Cancel</button>
            <button className={styles.modalBtnPrimary} onClick={onClose}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Transition Editor Modal ===== */
function TransitionEditorModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<'fields' | 'llm'>('fields');
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.builderModal} onClick={e => e.stopPropagation()}>
        <div className={styles.builderModalHeader}>
          <div className={styles.builderModalTitle}>
            <span className={styles.builderModalIcon} style={{ background: '#0ea5e918', color: '#0ea5e9' }}>🔀</span>
            <span>Transitioner</span>
          </div>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.builderModalBody}>
          <div className={styles.transitionTypeRow}>
            <button className={`${styles.transitionTypeBtn} ${type === 'fields' ? styles.transitionTypeBtnActive : ''}`}
              onClick={() => setType('fields')}>
              <span>📋</span>
              <div>
                <strong>Fields checker</strong>
                <span className={styles.settingsHint}>Code-based — check if fields meet conditions</span>
              </div>
            </button>
            <button className={`${styles.transitionTypeBtn} ${type === 'llm' ? styles.transitionTypeBtnActive : ''}`}
              onClick={() => setType('llm')}>
              <span>🧠</span>
              <div>
                <strong>LLM-based</strong>
                <span className={styles.settingsHint}>Let the model decide when to transition</span>
              </div>
            </button>
          </div>

          {type === 'fields' ? (
            <div className={styles.transitionRules}>
              <span className={styles.settingsLabel}>Transition when:</span>
              <div className={styles.transitionRule}>
                <select className={styles.settingsSelect} defaultValue="all-required">
                  <option value="all-required">All required fields collected</option>
                  <option value="specific">Specific field has value</option>
                </select>
                <span className={styles.transitionAnd}>AND</span>
                <select className={styles.settingsSelect} defaultValue="readyToTransfer">
                  <option value="readyToTransfer">readyToTransfer = true</option>
                  <option value="custom">Custom condition...</option>
                </select>
              </div>
              <div className={styles.transitionTarget}>
                <span className={styles.settingsLabel}>→ Move to crew:</span>
                <select className={styles.settingsSelect} defaultValue="Review">
                  {CREWS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className={styles.settingsPromptSection}>
              <span className={styles.settingsLabel}>📋 Transition prompt</span>
              <textarea className={styles.settingsTextarea} defaultValue="Decide if we should move to the next crew member.\nReturn: { shouldTransition: boolean, reason: string }" />
              <div className={styles.settingsGrid} style={{ marginTop: 12 }}>
                <div className={styles.settingsItem}>
                  <span className={styles.settingsLabel}>🧠 Model</span>
                  <select className={styles.settingsSelect}><option>gemini-2.5-flash</option><option>gpt-4o-mini</option></select>
                </div>
                <div className={styles.settingsItem}>
                  <span className={styles.settingsLabel}>→ Target crew</span>
                  <select className={styles.settingsSelect} defaultValue="Review">
                    {CREWS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className={styles.builderModalFooter}>
          <div />
          <div>
            <button className={styles.modalBtnSecondary} onClick={onClose}>Cancel</button>
            <button className={styles.modalBtnPrimary} onClick={onClose}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Add Step Modal ===== */
function AddChainStepModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Add to Chain</span>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.stepTypePicker}>
            <span className={styles.stepTypeGroupLabel}>Main chain</span>
            {STEP_TYPES.filter(s => s.layer === 'main').map(st => (
              <button key={st.id} className={styles.stepTypeCard} onClick={onClose}>
                <span className={styles.stepTypeIcon} style={{ background: `${st.color}18`, color: st.color }}>{st.icon}</span>
                <div className={styles.stepTypeInfo}>
                  <span className={styles.stepTypeName}>{st.name}</span>
                  <span className={styles.stepTypeDesc}>{st.desc}</span>
                </div>
              </button>
            ))}
            <span className={styles.stepTypeGroupLabel} style={{ marginTop: 8 }}>Background</span>
            {STEP_TYPES.filter(s => s.layer === 'bg').map(st => (
              <button key={st.id} className={styles.stepTypeCard} onClick={onClose}>
                <span className={styles.stepTypeIcon} style={{ background: `${st.color}18`, color: st.color }}>{st.icon}</span>
                <div className={styles.stepTypeInfo}>
                  <span className={styles.stepTypeName}>{st.name}</span>
                  <span className={styles.stepTypeDesc}>{st.desc}</span>
                </div>
              </button>
            ))}
            <span className={styles.stepTypeGroupLabel} style={{ marginTop: 8 }}>Offline</span>
            {STEP_TYPES.filter(s => s.layer === 'offline').map(st => (
              <button key={st.id} className={styles.stepTypeCard} onClick={onClose}>
                <span className={styles.stepTypeIcon} style={{ background: `${st.color}18`, color: st.color }}>{st.icon}</span>
                <div className={styles.stepTypeInfo}>
                  <span className={styles.stepTypeName}>{st.name}</span>
                  <span className={styles.stepTypeDesc}>{st.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Triggered Context Modal ===== */
function TriggeredContextModal({ onClose }: { onClose: () => void }) {
  const [activeField, setActiveField] = useState('intent');
  const fields: Record<string, { emoji: string; values: string[]; contexts: Record<string, string> }> = {
    intent: {
      emoji: '🎯', values: ['open_account', 'close_account', 'complaint', 'info_request'],
      contexts: {
        open_account: '## Open Account — Handling Guide\n\nGoals:\n- Qualify the customer (employment, income, age)\n- Build excitement about the right account type\n- Never discuss fees proactively\n\nProducts by profile:\n- Young: Student account\n- Salaried: Classic + credit bundle\n- Self-employed: Business-lite\n- High income: Premium with advisor',
        close_account: '## Close Account — Retention Guide\n\nPriority: Understand WHY first.\n\n1. Listen\n2. Acknowledge\n3. Offer alternatives (if appropriate)\n4. If they insist, guide respectfully',
        complaint: '## Complaint Handling\n\nRule #1: Never be defensive.\n\n1. Acknowledge\n2. Understand\n3. Resolve or escalate\n4. Follow up',
        info_request: '## Information Request\n\n- Answer directly first\n- Offer related info\n- If unsure, say so',
      },
    },
    user_type: {
      emoji: '😤', values: ['cooperative', 'stubborn', 'confused', 'kid'],
      contexts: {
        cooperative: '## Cooperative Customer\n\nMatch their energy. Be efficient and direct.',
        stubborn: '## Resistant Customer\n\nNEVER push. Lead with empathy. Use facts, not pressure. Give them control.',
        confused: '## Confused Customer\n\nSimplify everything. One concept at a time. Use analogies. Never make them feel dumb.',
        kid: '## Young Customer\n\nSimple, friendly language. Be encouraging. Make it fun, not scary.',
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
            <span className={styles.formHint} style={{ display: 'block', marginTop: 4 }}>Field value → context block injected into the prompt</span>
          </div>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.tcLayout}>
          <div className={styles.tcSidebar}>
            {Object.entries(fields).map(([key, f]) => (
              <div key={key}>
                <button className={`${styles.tcFieldBtn} ${activeField === key ? styles.tcFieldBtnActive : ''}`} onClick={() => selectField(key)}>
                  <span className={styles.tcFieldEmoji}>{f.emoji}</span>
                  <div className={styles.tcFieldInfo}>
                    <span className={styles.tcFieldName}>{key}</span>
                    <span className={styles.tcFieldCount}>{f.values.length} values</span>
                  </div>
                </button>
                {activeField === key && (
                  <div className={styles.tcValueList}>
                    {f.values.map(v => (
                      <button key={v} className={`${styles.tcValueBtn} ${activeValue === v ? styles.tcValueBtnActive : ''}`} onClick={() => setActiveValue(v)}>
                        <span className={styles.tcValueDot} /><span>{v}</span>
                        <span className={styles.tcValueChars}>{charCount(v)}</span>
                      </button>
                    ))}
                    <button className={styles.tcValueBtnAdd}>+ value</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className={styles.tcMain}>
            {activeValue ? (
              <>
                <div className={styles.tcEditorHeader}>
                  <button className={styles.tcBackBtn} onClick={() => setActiveValue(null)}>←</button>
                  <span className={styles.tcEditorLabel}>{activeValue}</span>
                  <span className={styles.tcEditorMeta}>{charCount(activeValue)}</span>
                </div>
                <div className={styles.tcEditorPane}>
                  <textarea className={styles.tcFullTextarea} defaultValue={activeData.contexts[activeValue]} key={`${activeField}-${activeValue}`} />
                </div>
              </>
            ) : activeField ? (
              <div className={styles.tcOverview}>
                {activeData.values.map(v => (
                  <div key={v} className={styles.tcOverviewItem} onClick={() => setActiveValue(v)}>
                    <div className={styles.tcOverviewName}>{v}<span className={styles.tcOverviewArrow}>→</span></div>
                    <div className={styles.tcOverviewPreview}>{activeData.contexts[v]}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.tcEmpty}><span className={styles.tcEmptyIcon}>🎯</span><span className={styles.tcEmptyText}>Select a field</span></div>
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

/* ===== Field Editor Modal ===== */
function FieldEditorModal({ field, onClose, onOpenTC }: { field: typeof FIELDS[number]; onClose: () => void; onOpenTC: () => void }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.builderModal} style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div className={styles.builderModalHeader}>
          <div className={styles.builderModalTitle}>
            <span className={styles.builderModalIcon} style={{ background: '#f0fdf4', color: '#16a34a' }}>📝</span>
            <span>{field.name}</span>
            <span className={`${styles.fieldDefType} ${field.type === 'enum' ? styles.typeEnum : field.type === 'number' ? styles.typeNumber : styles.typeString}`}>{field.type}</span>
          </div>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.builderModalBody}>
          <div className={styles.settingsGrid} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className={styles.settingsItem}>
              <span className={styles.settingsLabel}>Type</span>
              <select className={styles.settingsSelect} defaultValue={field.type}>
                <option>string</option><option>number</option><option>boolean</option><option>enum</option>
              </select>
            </div>
            <div className={styles.settingsItem}>
              <span className={styles.settingsLabel}>Extracted by</span>
              <select className={styles.settingsSelect} defaultValue={field.extractor}>
                <option value="input">📥 Input Extractor</option>
                <option value="vibe">🧐 Vibe Extractor</option>
              </select>
            </div>
            <div className={styles.settingsItem}>
              <span className={styles.settingsLabel}>💾 Save to Memory</span>
              <select className={styles.settingsSelect} defaultValue={field.domain || ''}>
                <option value="">— don't save</option>
                {BRAIN_DOMAINS.map(d => <option key={d.name} value={d.name}>{d.icon} {d.name}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.settingsItem} style={{ marginTop: 12 }}>
            <span className={styles.settingsLabel}>Description</span>
            <textarea className={styles.settingsTextarea} style={{ minHeight: 60 }} defaultValue={field.description} />
          </div>
          {field.values && (
            <div className={styles.settingsItem} style={{ marginTop: 12 }}>
              <span className={styles.settingsLabel}>Allowed values</span>
              <div className={styles.fieldDefValues} style={{ marginTop: 6 }}>
                {field.values.map(v => <span key={v} className={styles.fieldDefValueChip}>{v}</span>)}
              </div>
            </div>
          )}
          {field.triggers && (
            <button className={styles.triggeredFieldBtn} style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => { onClose(); onOpenTC(); }}>
              🎯 Edit triggered context for {field.name}
            </button>
          )}
        </div>
        <div className={styles.builderModalFooter}>
          <button className={styles.builderModalRemove}>Delete field</button>
          <div>
            <button className={styles.modalBtnSecondary} onClick={onClose}>Cancel</button>
            <button className={styles.modalBtnPrimary} onClick={onClose}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== MAIN PAGE ===== */

export function CrewBuilderMockupPage() {
  const [activeCrew, setActiveCrew] = useState(1);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editingTransition, setEditingTransition] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [showAddStep, setShowAddStep] = useState(false);
  const [showTriggerContext, setShowTriggerContext] = useState(false);
  const [showAddField, setShowAddField] = useState(false);

  const editStepData = ALL_STEPS.find(s => s.id === editingStep);
  const editFieldData = FIELDS.find(f => f.name === editingField);
  const editDomainData = BRAIN_DOMAINS.find(d => d.name === editingDomain);

  return (
    <div className={styles.container}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <Link to="/lybi" className={styles.logo}><img src="/img/lybi-logo-transparent.png" alt="Lybi" /></Link>
          <span className={styles.topBadge}>Agent Builder</span>
          <span className={styles.topTitle}>Banking Onboarder</span>
          <div className={styles.crewTabs}>
            {CREWS.map((c, i) => (
              <button key={c} className={`${styles.crewTab} ${i === activeCrew ? styles.crewTabActive : ''}`}
                onClick={() => setActiveCrew(i)}>{c}</button>
            ))}
          </div>
        </div>
        <div className={styles.topRight}><span className={styles.mockBadge}>Mockup</span></div>
      </div>

      <div className={styles.builderLayout}>

        {/* ===== LEFT: Persona sidebar ===== */}
        <div className={styles.personaSidebar}>
          <div className={styles.personaSidebarSection}>
            <div className={styles.personaSidebarTitle}>
              🎭 Agent Persona
              <span className={`${styles.sectionBadge} ${styles.badgeAgent}`}>Agent</span>
            </div>
            <textarea className={styles.personaTextarea} defaultValue={`You are LYBI — a warm, confident digital banker.\nYou combine clarity with the ease of a friend.\nSpeak Hebrew naturally, never bureaucratic.\n\nCore traits:\n- Conversational and adaptive\n- Sales instinct wrapped in genuine care\n- Direct but never pushy`} />
          </div>
          <div className={styles.personaSidebarDivider} />
          <div className={styles.personaSidebarSection}>
            <div className={styles.personaSidebarTitle}>
              🎭 Crew Persona
              <span className={`${styles.sectionBadge} ${styles.badgeCrew}`}>Crew</span>
            </div>
            <textarea className={styles.personaTextarea} style={{ minHeight: 80 }} defaultValue={`In this phase you are the financial advisor.\nBe analytical yet warm.\nAsk probing questions about finances naturally.`} />
          </div>
        </div>

        {/* ===== CENTER: Builder ===== */}
        <div className={styles.builderArea}>

          {/* Chain Canvas */}
          <div className={styles.chainCanvas}>
            <div className={styles.chainCanvasHeader}>
              <span className={styles.chainCanvasTitle}>Chain Reaction</span>
              <button className={styles.chainAddInline} onClick={() => setShowAddStep(true)}>+ Add step</button>
            </div>

            <div className={styles.chainTrack}>
              {MAIN_CHAIN.map((step, i) => (
                <div key={step.id} style={{ display: 'contents' }}>
                  {i > 0 && <div className={styles.chainConnector}><span className={styles.chainConnectorArrow}>→</span></div>}
                  <button
                    className={`${styles.chainNodeLarge} ${editingStep === step.id ? styles.chainNodeLargeActive : ''}`}
                    style={{ '--step-color': step.color } as React.CSSProperties}
                    onClick={() => { setEditingStep(step.id); setEditingTransition(false); }}
                  >
                    <span className={styles.chainNodeLargeIcon}>{step.icon}</span>
                    <span className={styles.chainNodeLargeName}>{step.name}</span>
                    <span className={styles.chainNodeLargeModel}>{step.model.replace('claude-sonnet-4-6', 'claude-sonnet').replace('gemini-2.5-flash', 'gemini-flash')}</span>
                  </button>
                </div>
              ))}
              <div className={styles.chainConnector}><span className={styles.chainConnectorArrow}>→</span></div>
              <button
                className={`${styles.chainNodeLarge} ${editingTransition ? styles.chainNodeLargeActive : ''}`}
                style={{ '--step-color': TRANSITION.color } as React.CSSProperties}
                onClick={() => { setEditingTransition(true); setEditingStep(null); }}
              >
                <span className={styles.chainNodeLargeIcon}>{TRANSITION.icon}</span>
                <span className={styles.chainNodeLargeName}>{TRANSITION.name}</span>
                <span className={styles.chainNodeLargeModel}>code</span>
              </button>
            </div>

            <div className={styles.chainBgRow}>
              <span className={styles.chainBgLabel}>Background <span className={styles.chainBgLabelHint}>per message, doesn't block</span></span>
              <div className={styles.chainTrack}>
                {BG_CHAIN.map(step => (
                  <button key={step.id}
                    className={`${styles.chainNodeLarge} ${editingStep === step.id ? styles.chainNodeLargeActive : ''}`}
                    style={{ '--step-color': step.color } as React.CSSProperties}
                    onClick={() => { setEditingStep(step.id); setEditingTransition(false); }}
                  >
                    <span className={styles.chainNodeLargeIcon}>{step.icon}</span>
                    <span className={styles.chainNodeLargeName}>{step.name}</span>
                    <span className={styles.chainNodeLargeModel}>{step.model}</span>
                  </button>
                ))}
                <button className={styles.chainAddBtn} onClick={() => setShowAddStep(true)}>+</button>
              </div>
            </div>

            <div className={styles.chainBgRow}>
              <span className={styles.chainBgLabel}>Offline <span className={styles.chainBgLabelHint}>runs periodically, not per message</span></span>
              <div className={styles.chainTrack}>
                {OFFLINE_CHAIN.map(step => (
                  <button key={step.id}
                    className={`${styles.chainNodeLarge} ${editingStep === step.id ? styles.chainNodeLargeActive : ''}`}
                    style={{ '--step-color': step.color } as React.CSSProperties}
                    onClick={() => { setEditingStep(step.id); setEditingTransition(false); }}
                  >
                    <span className={styles.chainNodeLargeIcon}>{step.icon}</span>
                    <span className={styles.chainNodeLargeName}>{step.name}</span>
                    <span className={styles.chainNodeLargeModel}>every 2k tok</span>
                  </button>
                ))}
                <button className={styles.chainAddBtn} onClick={() => setShowAddStep(true)}>+</button>
              </div>
            </div>
          </div>

          {/* ===== FIELDS + BRAIN ===== */}
          <div className={styles.fieldsArea}>

            {/* Fields */}
            <div className={styles.fieldsPanel}>
              <div className={styles.fieldsPanelHeader}>
                <span className={styles.fieldsPanelTitle}>📝 Fields</span>
                <span className={styles.fieldsPanelCount}>{FIELDS.length}</span>
                <button className={styles.chainAddInline} onClick={() => setShowAddField(true)}>+ Add</button>
              </div>
              <div className={styles.fieldsList}>
                {FIELDS.map(f => (
                  <button key={f.name} className={styles.fieldCard} onClick={() => setEditingField(f.name)}>
                    <span className={styles.fieldCardName}>{f.name}</span>
                    <span className={styles.fieldCardMeta}>
                      <span className={`${styles.fieldDefType} ${f.type === 'number' ? styles.typeNumber : f.type === 'enum' ? styles.typeEnum : styles.typeString}`}>{f.type}</span>
                      <span className={styles.fieldDefExtractor}>{f.extractor === 'input' ? '📥' : '🧐'}</span>
                      {f.domain && <span className={styles.fieldCardDomain}>💾</span>}
                      {f.triggers && <span className={styles.fieldCardTrigger}>🎯</span>}
                    </span>
                  </button>
                ))}
              </div>
              {/* Triggered Context button */}
              <div className={styles.fieldsPanelFooter}>
                <button className={styles.triggeredBtn} onClick={() => setShowTriggerContext(true)}>
                  🎯 Triggered Context
                  <span className={styles.triggeredBtnCount}>{FIELDS.filter(f => f.triggers).length} fields</span>
                </button>
              </div>
            </div>

            {/* Brain — domains with readers & writers */}
            <div className={styles.brainPanel}>
              <div className={styles.fieldsPanelHeader}>
                <span className={styles.fieldsPanelTitle}>💾 Memory</span>
                <span className={styles.fieldsPanelCount}>{BRAIN_DOMAINS.length} domains</span>
              </div>
              <div className={styles.brainDomains}>
                {BRAIN_DOMAINS.map(d => {
                  const domainFields = FIELDS.filter(f => f.domain === d.name);
                  const writtenBy = [...new Set(domainFields.map(f => f.extractor === 'input' ? '📥 Input' : '🧐 Vibe'))];
                  return (
                    <button key={d.name} className={styles.brainDomain} onClick={() => setEditingDomain(d.name)}>
                      <div className={styles.brainDomainHeader}>
                        <span className={styles.brainDomainIcon}>{d.icon}</span>
                        <span className={styles.brainDomainName}>{d.name}</span>
                      </div>
                      <div className={styles.brainDomainFields}>
                        {domainFields.map(f => <span key={f.name} className={styles.brainDomainField}>{f.name}</span>)}
                        {d.name === 'strategy' && d.fields.map(f => <span key={f} className={styles.brainDomainField}>{f}</span>)}
                        {d.name === 'conversation' && d.fields.map(f => <span key={f} className={styles.brainDomainField}>{f}</span>)}
                      </div>
                      <div className={styles.brainDomainIO}>
                        {writtenBy.length > 0 && (
                          <div className={styles.brainDomainWriters}>
                            <span className={styles.brainIOLabel}>✍️</span>
                            {writtenBy.map(w => <span key={w} className={styles.brainIOChip}>{w}</span>)}
                          </div>
                        )}
                        {d.name === 'strategy' && (
                          <div className={styles.brainDomainWriters}>
                            <span className={styles.brainIOLabel}>✍️</span>
                            <span className={styles.brainIOChip}>🧠 Strategic</span>
                          </div>
                        )}
                        {d.name === 'conversation' && (
                          <div className={styles.brainDomainWriters}>
                            <span className={styles.brainIOLabel}>✍️</span>
                            <span className={styles.brainIOChip}>📝 Summarizer</span>
                          </div>
                        )}
                        <div className={styles.brainDomainReaders}>
                          <span className={styles.brainIOLabel}>📖</span>
                          {d.readers.map(r => <span key={r} className={styles.brainIOChip}>{r}</span>)}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button className={styles.brainDomainAdd} onClick={() => setEditingDomain('_new')}>+ Add domain</button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== RIGHT: Chat preview ===== */}
        <div className={styles.chatSidebar}>
          <div className={styles.chatSidebarHeader}>Preview</div>
          <div className={styles.chatSidebarMessages}>
            <div className={styles.msgBot}>היי! 👋 אני ליבי. מה שמך?</div>
            <div className={styles.msgUser}>שרה, אני רוצה לפתוח חשבון</div>
            <div className={styles.msgBot}>שרה, נעים מאוד! 😊 מה גילך?</div>
            <div className={styles.msgUser}>32</div>
            <div className={styles.msgBot}>מעולה! ובמה את עוסקת?</div>
          </div>
          <div className={styles.chatSidebarInput}>
            <input className={styles.chatInputField} placeholder="Type..." readOnly />
          </div>
        </div>
      </div>

      {/* Modals */}
      {editStepData && <StepEditorModal step={editStepData} onClose={() => setEditingStep(null)} />}
      {editingTransition && <TransitionEditorModal onClose={() => setEditingTransition(false)} />}
      {editFieldData && <FieldEditorModal field={editFieldData} onClose={() => setEditingField(null)} onOpenTC={() => setShowTriggerContext(true)} />}
      {editDomainData && (
        <div className={styles.modalOverlay} onClick={() => setEditingDomain(null)}>
          <div className={styles.builderModal} style={{ width: 520 }} onClick={e => e.stopPropagation()}>
            <div className={styles.builderModalHeader}>
              <div className={styles.builderModalTitle}>
                <span className={styles.builderModalIcon} style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1' }}>{editDomainData.icon}</span>
                <span>{editDomainData.name}</span>
              </div>
              <button className={styles.modalClose} onClick={() => setEditingDomain(null)}>×</button>
            </div>
            <div className={styles.builderModalBody}>
              <div className={styles.settingsItem}>
                <span className={styles.settingsLabel}>Fields in this domain</span>
                <div className={styles.brainDomainFields} style={{ marginTop: 6 }}>
                  {editDomainData.fields.map(f => <span key={f} className={styles.brainDomainField}>{f}</span>)}
                  <span className={styles.brainDomainField} style={{ borderStyle: 'dashed', color: '#a8a29e', cursor: 'pointer' }}>+ add</span>
                </div>
              </div>

              <div className={styles.brainEditorSection}>
                <span className={styles.settingsLabel}>✍️ Writers — who writes to this domain</span>
                <p className={styles.brainEditorHint}>Which chain steps write to this memory domain</p>
                <div className={styles.brainEditorChecks}>
                  {[...MAIN_CHAIN, ...BG_CHAIN, ...OFFLINE_CHAIN].map(s => (
                    <label key={s.id} className={styles.brainEditorCheck}>
                      <input type="checkbox" defaultChecked={editDomainData.writers.some(w => w.includes(s.name))} />
                      <span>{s.icon} {s.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.brainEditorSection}>
                <span className={styles.settingsLabel}>📖 Readers — who reads from this domain</span>
                <p className={styles.brainEditorHint}>Which chain steps read from this memory domain</p>
                <div className={styles.brainEditorChecks}>
                  {[...MAIN_CHAIN, ...BG_CHAIN, ...OFFLINE_CHAIN].map(s => (
                    <label key={s.id} className={styles.brainEditorCheck}>
                      <input type="checkbox" defaultChecked={editDomainData.readers.some(r => r.includes(s.name))} />
                      <span>{s.icon} {s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.builderModalFooter}>
              <button className={styles.builderModalRemove}>Delete domain</button>
              <div>
                <button className={styles.modalBtnSecondary} onClick={() => setEditingDomain(null)}>Cancel</button>
                <button className={styles.modalBtnPrimary} onClick={() => setEditingDomain(null)}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAddStep && <AddChainStepModal onClose={() => setShowAddStep(false)} />}
      {showTriggerContext && <TriggeredContextModal onClose={() => setShowTriggerContext(false)} />}
      {showAddField && (
        <div className={styles.modalOverlay} onClick={() => setShowAddField(false)}>
          <div className={styles.builderModal} style={{ width: 460 }} onClick={e => e.stopPropagation()}>
            <div className={styles.builderModalHeader}>
              <span className={styles.builderModalTitle}>Add Field</span>
              <button className={styles.modalClose} onClick={() => setShowAddField(false)}>×</button>
            </div>
            <div className={styles.builderModalBody}>
              <div className={styles.settingsGrid} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className={styles.settingsItem}>
                  <span className={styles.settingsLabel}>Name</span>
                  <input className={styles.settingsSelect} style={{ padding: '7px 10px' }} placeholder="e.g. marital_status" />
                </div>
                <div className={styles.settingsItem}>
                  <span className={styles.settingsLabel}>Type</span>
                  <select className={styles.settingsSelect}><option>String</option><option>Number</option><option>Boolean</option><option>Enum</option></select>
                </div>
                <div className={styles.settingsItem}>
                  <span className={styles.settingsLabel}>Extracted by</span>
                  <select className={styles.settingsSelect}><option>📥 Input</option><option>🧐 Vibe</option></select>
                </div>
              </div>
              <div className={styles.settingsItem} style={{ marginTop: 12 }}>
                <span className={styles.settingsLabel}>Description</span>
                <textarea className={styles.settingsTextarea} style={{ minHeight: 60 }} placeholder="How should the model extract this?" />
              </div>
            </div>
            <div className={styles.builderModalFooter}>
              <div />
              <div>
                <button className={styles.modalBtnSecondary} onClick={() => setShowAddField(false)}>Cancel</button>
                <button className={styles.modalBtnPrimary} onClick={() => setShowAddField(false)}>Add Field</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
