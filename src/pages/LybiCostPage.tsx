import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// Pricing tool: cost per interaction by agent complexity.
// One interaction = one user message + every model call made to answer it.
// Word counts are expressed as simple levels (Reads / Writes); the words
// behind each level are editable under Advanced.
// Token prices are USD list prices per 1M tokens (verified July 2026).

interface ModelPrice { id: string; name: string; prov: string; pin: number; pout: number }
interface Row { kind: string; name: string; desc: string; model: string; read: string; write: string; runs: number; count: number }
interface Tier { key: string; badge: string; title: string; tagline: string; rows: Row[] }

const MODELS: ModelPrice[] = [
  { id: 'gpt-5.6', name: 'GPT-5.6 (Sol)', prov: 'OpenAI', pin: 5.0, pout: 30.0 },
  { id: 'gpt-5.5', name: 'GPT-5.5', prov: 'OpenAI', pin: 5.0, pout: 30.0 },
  { id: 'gpt-4o', name: 'GPT-4o', prov: 'OpenAI', pin: 2.5, pout: 10.0 },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini', prov: 'OpenAI', pin: 0.75, pout: 4.5 },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', prov: 'OpenAI', pin: 0.15, pout: 0.6 },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', prov: 'Anthropic', pin: 5.0, pout: 25.0 },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', prov: 'Anthropic', pin: 3.0, pout: 15.0 },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', prov: 'Anthropic', pin: 1.0, pout: 5.0 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', prov: 'Google', pin: 1.25, pout: 10.0 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', prov: 'Google', pin: 0.3, pout: 2.5 },
];
const MODEL_BY_ID = Object.fromEntries(MODELS.map(m => [m.id, m]));

// Component types: what can be in an agent, which models fit each,
// and sensible defaults when adding one.
interface ComponentType {
  base: string; desc: string; models: string[];
  model: string; read: string; write: string; runs: number;
  addable: boolean;
}
const GPT_MODELS = ['gpt-5.6', 'gpt-5.5', 'gpt-4o', 'gpt-5.4-mini', 'gpt-4o-mini'];
const ALL_MODELS = MODELS.map(m => m.id);
const CHEAP_MODELS = ['gpt-4o-mini', 'gpt-5.4-mini', 'claude-haiku-4-5', 'gemini-2.5-flash'];

const COMPONENT_TYPES: Record<string, ComponentType> = {
  talker: { base: 'Talker', desc: 'prompt + history + KB + message', models: GPT_MODELS, model: 'gpt-5.5', read: 'alot', write: 'normal', runs: 1, addable: false },
  thinker: { base: 'Thinker', desc: 'plans before the reply', models: ALL_MODELS, model: 'claude-sonnet-4-6', read: 'medium', write: 'detailed', runs: 1, addable: true },
  fieldExtractor: { base: 'Field extractor', desc: 'pulls structured data', models: CHEAP_MODELS, model: 'gpt-4o-mini', read: 'little', write: 'short', runs: 1, addable: true },
  vibeExtractor: { base: 'Vibe extractor', desc: 'reads tone & emotion', models: CHEAP_MODELS, model: 'gpt-4o-mini', read: 'little', write: 'short', runs: 1, addable: true },
  liveBrain: { base: 'Live brain', desc: 'live analysis per message', models: ALL_MODELS, model: 'claude-sonnet-4-6', read: 'medium', write: 'normal', runs: 1, addable: true },
  profiler: { base: 'Profiler', desc: 'background, every 5th message', models: GPT_MODELS, model: 'gpt-5.5', read: 'alot', write: 'long', runs: 0.2, addable: true },
};

// How much the component READS per run (prompt + history + KB + message).
const READ_LEVELS = [
  { id: 'little', label: 'Little' },
  { id: 'medium', label: 'Medium' },
  { id: 'alot', label: 'A lot' },
  { id: 'everything', label: 'Everything' },
];
// How much the component WRITES per run.
const WRITE_LEVELS = [
  { id: 'short', label: 'Short' },
  { id: 'normal', label: 'Normal' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'long', label: 'Long' },
];
const DEFAULT_READ_WORDS: Record<string, number> = { little: 600, medium: 1500, alot: 2700, everything: 4100 };
const DEFAULT_WRITE_WORDS: Record<string, number> = { short: 60, normal: 150, detailed: 220, long: 400 };

const row = (kind: string, patch: Partial<Row> = {}): Row => {
  const t = COMPONENT_TYPES[kind];
  return { kind, name: t.base, desc: t.desc, model: t.model, read: t.read, write: t.write, runs: t.runs, count: 1, ...patch };
};

const DEFAULT_TIERS: Tier[] = [
  {
    key: 'talker',
    badge: 'Simple',
    title: 'Talker only',
    tagline: 'One model answers. No addons.',
    rows: [
      row('talker', { desc: 'prompt + history + message', read: 'medium' }),
    ],
  },
  {
    key: 'brain',
    badge: 'Standard',
    title: 'Talker + Brain',
    tagline: 'A few simple addons.',
    rows: [
      row('talker'),
      row('thinker'),
      row('fieldExtractor'),
      row('vibeExtractor'),
    ],
  },
  {
    key: 'crew',
    badge: 'Smart',
    title: 'Full Crew',
    tagline: 'Lots of thinking addons + live brain + profiler.',
    rows: [
      row('talker', { model: 'gpt-5.6', desc: 'long prompt + history + big KB', read: 'everything', write: 'detailed' }),
      row('thinker', { name: 'Thinkers', count: 3 }),
      row('fieldExtractor'),
      row('vibeExtractor'),
      row('liveBrain'),
      row('profiler'),
    ],
  },
];

// Baked-in assumption (adjustable under Advanced):
// Hebrew tokenizes at ~2 tokens per word (English ~1.3).
const DEFAULT_TPW = 2.0;
const DEFAULT_FX = 3.0;
// Safety factor: extra buffer on the actual cost, ×1 = no buffer.
const DEFAULT_SAFE = 1.0;
// Headline figure is per this many interactions.
const DEFAULT_INTERACTIONS = 1000;

const PURPLE = '#680662';
const INK = '#1C1917';
const MUTED = '#78716C';
const FAINT = '#A8A29E';
const LINE = '#E7E5E4';
const MONO = "'SF Mono', 'Cascadia Code', Consolas, monospace";

const usd = (v: number) => '$' + v.toFixed(3);
const ils = (v: number) => '₪' + v.toFixed(2);

const numInput: React.CSSProperties = {
  fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 14, color: INK,
  background: '#FAF7F7', border: `1px solid ${LINE}`, borderRadius: 6,
  width: 76, padding: '6px 8px', textAlign: 'right' as const,
};

const selectStyle: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 13, color: INK, background: '#FAF7F7',
  border: `1px solid ${LINE}`, borderRadius: 6, padding: '6px 6px', cursor: 'pointer',
};

const thStyle = (align: 'left' | 'right'): React.CSSProperties => ({
  textAlign: align, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
  color: FAINT, fontWeight: 600, padding: '10px 10px 7px', borderBottom: `1px solid ${LINE}`,
  whiteSpace: 'nowrap' as const,
});

const tdStyle = (last: boolean): React.CSSProperties => ({
  padding: '9px 10px', borderBottom: last ? 'none' : `1px solid ${LINE}`, verticalAlign: 'middle',
});

export function LybiCostPage() {
  const [tiers, setTiers] = useState<Tier[]>(() => structuredClone(DEFAULT_TIERS));
  const [fx, setFx] = useState(DEFAULT_FX);
  const [safe, setSafe] = useState(DEFAULT_SAFE);
  const [interactions, setInteractions] = useState(DEFAULT_INTERACTIONS);
  const [tpw, setTpw] = useState(DEFAULT_TPW);
  const [readWords, setReadWords] = useState<Record<string, number>>({ ...DEFAULT_READ_WORDS });
  const [writeWords, setWriteWords] = useState<Record<string, number>>({ ...DEFAULT_WRITE_WORDS });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.title = 'Cost per Interaction | Lybi';
    return () => window.clearTimeout(copyTimer.current);
  }, []);

  const rowCost = (r: Row): number => {
    const m = MODEL_BY_ID[r.model];
    const win = readWords[r.read] ?? 0;
    const wout = writeWords[r.write] ?? 0;
    return ((win * tpw / 1e6) * m.pin + (wout * tpw / 1e6) * m.pout) * r.runs * r.count;
  };

  const updateRow = (ti: number, ri: number, patch: Partial<Row>) => {
    setTiers(prev => prev.map((t, i) => i !== ti ? t : {
      ...t,
      rows: t.rows.map((r, j) => j !== ri ? r : { ...r, ...patch }),
    }));
  };

  const addComponent = (ti: number, kind: string) => {
    setTiers(prev => prev.map((t, i) => {
      if (i !== ti) return t;
      const sameKind = t.rows.filter(r => r.kind === kind).length;
      const base = COMPONENT_TYPES[kind].base;
      const name = sameKind === 0 ? base : `${base} ${sameKind + 1}`;
      return { ...t, rows: [...t.rows, row(kind, { name })] };
    }));
  };

  const removeRow = (ti: number, ri: number) => {
    setTiers(prev => prev.map((t, i) => i !== ti ? t : {
      ...t,
      rows: t.rows.filter((_, j) => j !== ri),
    }));
  };

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 1500);
    });
  };

  const reset = () => {
    setTiers(structuredClone(DEFAULT_TIERS));
    setFx(DEFAULT_FX);
    setSafe(DEFAULT_SAFE);
    setInteractions(DEFAULT_INTERACTIONS);
    setTpw(DEFAULT_TPW);
    setReadWords({ ...DEFAULT_READ_WORDS });
    setWriteWords({ ...DEFAULT_WRITE_WORDS });
  };

  const copyBtn = (id: string, value: string, label: string): React.ReactNode => (
    <button
      onClick={() => copy(id, value)}
      style={{
        fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        color: copied === id ? '#fff' : PURPLE,
        background: copied === id ? PURPLE : 'rgba(104,6,98,0.06)',
        border: 'none', borderRadius: 6, padding: '6px 12px',
        transition: 'all 0.15s', whiteSpace: 'nowrap' as const,
      }}
    >
      {copied === id ? 'Copied ✓' : label}
    </button>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FAF7F7', color: INK, minHeight: '100vh', overflow: 'auto' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,247,247,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/lybi/knowledge" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <img src="/img/lybi-logo-transparent.png" alt="Lybi" style={{ height: 32, width: 'auto' }} />
          </Link>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: PURPLE, background: 'rgba(104,6,98,0.06)', padding: '4px 10px', borderRadius: 4 }}>
            Cost per Interaction
          </span>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 64px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' as const }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: MUTED }}>
            USD → ILS
            <input
              type="number" step={0.05} min={0} value={fx}
              onChange={e => setFx(+e.target.value || 0)}
              style={{ ...numInput, width: 62, background: '#fff' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: MUTED }}>
            Safety factor ×
            <input
              type="number" step={0.1} min={1} value={safe}
              onChange={e => setSafe(+e.target.value || DEFAULT_SAFE)}
              style={{ ...numInput, width: 62, background: '#fff' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: MUTED }}>
            Interactions
            <input
              type="number" step={100} min={1} value={interactions}
              onChange={e => setInteractions(Math.max(1, Math.round(+e.target.value || DEFAULT_INTERACTIONS)))}
              style={{ ...numInput, width: 82, background: '#fff' }}
            />
          </label>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowAdvanced(v => !v)}
            style={{ background: 'none', border: 'none', color: FAINT, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 4 }}
          >
            {showAdvanced ? 'Hide advanced' : 'Advanced'}
          </button>
          <button
            onClick={reset}
            style={{ background: 'none', border: `1px solid ${LINE}`, color: MUTED, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: '5px 12px', borderRadius: 6 }}
          >
            Reset
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 18 }}>
          {tiers.map((t, ti) => {
            const total = t.rows.reduce((s, r) => s + rowCost(r), 0) * safe;
            const winTot = Math.round(t.rows.reduce((s, r) => s + (readWords[r.read] ?? 0) * r.runs * r.count, 0));
            const woutTot = Math.round(t.rows.reduce((s, r) => s + (writeWords[r.write] ?? 0) * r.runs * r.count, 0));
            const perN = total * interactions;
            return (
              <div key={t.key} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexWrap: 'wrap' as const }}>

                {/* Left: tier + the number to take */}
                <div style={{ flex: '0 0 270px', minWidth: 250, padding: '22px 24px', borderRight: `1px solid ${LINE}` }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: PURPLE, background: 'rgba(104,6,98,0.06)', padding: '3px 10px', borderRadius: 99 }}>
                    {t.badge}
                  </span>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, margin: '12px 0 2px' }}>{t.title}</h2>
                  <p style={{ fontSize: 13, color: MUTED, margin: '0 0 18px' }}>{t.tagline}</p>

                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: FAINT, marginBottom: 4 }}>
                    Per {interactions.toLocaleString()} interactions
                  </div>
                  <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', color: PURPLE, lineHeight: 1.1 }}>
                    ${perN.toFixed(perN < 100 ? 1 : 0)}
                  </div>
                  <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 19, color: MUTED, margin: '2px 0 12px' }}>
                    ₪{(perN * fx).toFixed(0)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {copyBtn(`${t.key}-usd1k`, perN.toFixed(2), 'Copy $')}
                    {copyBtn(`${t.key}-ils1k`, (perN * fx).toFixed(2), 'Copy ₪')}
                  </div>

                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: FAINT, marginBottom: 4 }}>
                    Per interaction
                  </div>
                  <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1.2 }}>
                    {usd(total)}
                    <span style={{ fontSize: 15, color: MUTED, fontWeight: 400 }}> · {ils(total * fx)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, margin: '8px 0 16px' }}>
                    {copyBtn(`${t.key}-usd`, total.toFixed(4), 'Copy $')}
                    {copyBtn(`${t.key}-ils`, (total * fx).toFixed(4), 'Copy ₪')}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: 12, background: '#FAF7F7', borderRadius: 6, padding: '4px 10px', color: MUTED }}>
                      words in <b style={{ fontFamily: MONO, color: INK }}>{winTot.toLocaleString()}</b>
                    </span>
                    <span style={{ fontSize: 12, background: '#FAF7F7', borderRadius: 6, padding: '4px 10px', color: MUTED }}>
                      words out <b style={{ fontFamily: MONO, color: INK }}>{woutTot.toLocaleString()}</b>
                    </span>
                  </div>
                </div>

                {/* Right: the assumptions table */}
                <div style={{ flex: '1 1 480px', overflowX: 'auto' as const, display: 'flex', flexDirection: 'column' as const }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13.5 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle('left'), paddingLeft: 24 }}>Component</th>
                        <th style={thStyle('right')}>Count</th>
                        <th style={thStyle('left')}>Model</th>
                        <th style={thStyle('left')}>Reads</th>
                        <th style={thStyle('left')}>Writes</th>
                        <th style={{ ...thStyle('right') }}>Cost</th>
                        <th style={{ ...thStyle('right'), paddingRight: 18, width: 28 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map((r, ri) => {
                        const last = ri === t.rows.length - 1;
                        const choices = COMPONENT_TYPES[r.kind]?.models ?? MODELS.map(m => m.id);
                        return (
                          <tr key={`${r.kind}-${ri}`}>
                            <td style={{ ...tdStyle(last), paddingLeft: 24 }}>
                              <div style={{ fontWeight: 600, whiteSpace: 'nowrap' as const }}>{r.name}</div>
                              <div style={{ fontSize: 11.5, color: FAINT, whiteSpace: 'nowrap' as const }}>{r.desc}</div>
                            </td>
                            <td style={{ ...tdStyle(last), textAlign: 'right' as const }}>
                              <input
                                type="number" min={1} step={1} value={r.count}
                                onChange={e => updateRow(ti, ri, { count: Math.max(1, Math.round(+e.target.value || 1)) })}
                                style={{ ...numInput, width: 52 }}
                              />
                            </td>
                            <td style={tdStyle(last)}>
                              {choices.length === 1 ? (
                                <span style={{ fontSize: 13, color: MUTED, whiteSpace: 'nowrap' as const }}>{MODEL_BY_ID[choices[0]].name}</span>
                              ) : (
                                <select
                                  value={r.model}
                                  onChange={e => updateRow(ti, ri, { model: e.target.value })}
                                  style={{ ...selectStyle, maxWidth: 160 }}
                                >
                                  {choices.map(id => <option key={id} value={id}>{MODEL_BY_ID[id].name}</option>)}
                                </select>
                              )}
                            </td>
                            <td style={tdStyle(last)}>
                              <select
                                value={r.read}
                                onChange={e => updateRow(ti, ri, { read: e.target.value })}
                                style={selectStyle}
                              >
                                {READ_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                              </select>
                            </td>
                            <td style={tdStyle(last)}>
                              <select
                                value={r.write}
                                onChange={e => updateRow(ti, ri, { write: e.target.value })}
                                style={selectStyle}
                              >
                                {WRITE_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                              </select>
                            </td>
                            <td style={{ ...tdStyle(last), textAlign: 'right' as const, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' as const, color: MUTED }}>
                              ${rowCost(r).toFixed(4)}
                            </td>
                            <td style={{ ...tdStyle(last), textAlign: 'right' as const, paddingRight: 18 }}>
                              {r.kind !== 'talker' && (
                                <button
                                  onClick={() => removeRow(ti, ri)}
                                  title={`Remove ${r.name}`}
                                  style={{ background: 'none', border: 'none', color: FAINT, fontSize: 15, cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 'auto', padding: '10px 24px 14px', borderTop: `1px solid ${LINE}` }}>
                    <select
                      value=""
                      onChange={e => { if (e.target.value) addComponent(ti, e.target.value); }}
                      style={{ ...selectStyle, background: 'rgba(104,6,98,0.06)', color: PURPLE, fontWeight: 600, border: 'none', padding: '7px 10px' }}
                    >
                      <option value="">+ Add component</option>
                      {Object.entries(COMPONENT_TYPES).filter(([, c]) => c.addable).map(([kind, c]) => (
                        <option key={kind} value={kind}>{c.base}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showAdvanced && (
          <div style={{ marginTop: 24, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' as const, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 600, color: MUTED, marginBottom: 8 }}>
                  Reads — words per level
                </div>
                {READ_LEVELS.map(l => (
                  <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED, marginBottom: 6 }}>
                    <span style={{ width: 84 }}>{l.label}</span>
                    <input
                      type="number" min={0} step={100} value={readWords[l.id]}
                      onChange={e => setReadWords(prev => ({ ...prev, [l.id]: +e.target.value || 0 }))}
                      style={numInput}
                    />
                  </label>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 600, color: MUTED, marginBottom: 8 }}>
                  Writes — words per level
                </div>
                {WRITE_LEVELS.map(l => (
                  <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED, marginBottom: 6 }}>
                    <span style={{ width: 84 }}>{l.label}</span>
                    <input
                      type="number" min={0} step={10} value={writeWords[l.id]}
                      onChange={e => setWriteWords(prev => ({ ...prev, [l.id]: +e.target.value || 0 }))}
                      style={numInput}
                    />
                  </label>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 600, color: MUTED, marginBottom: 8 }}>
                  Tokens per word
                </div>
                <input type="number" step={0.1} min={0.5} value={tpw} onChange={e => setTpw(+e.target.value || DEFAULT_TPW)} style={numInput} />
                <div style={{ fontSize: 11.5, color: FAINT, marginTop: 4 }}>Hebrew ≈ 2.0 · English ≈ 1.3</div>
              </div>
            </div>
            <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 600, color: MUTED, marginBottom: 8 }}>
              Model prices (USD per 1M tokens)
            </div>
            <div style={{ overflowX: 'auto' as const }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle('left'), paddingLeft: 0 }}>Model</th>
                    <th style={thStyle('left')}>Provider</th>
                    <th style={thStyle('right')}>Input</th>
                    <th style={thStyle('right')}>Output</th>
                  </tr>
                </thead>
                <tbody>
                  {MODELS.map((m, i) => {
                    const last = i === MODELS.length - 1;
                    return (
                      <tr key={m.id}>
                        <td style={{ ...tdStyle(last), paddingLeft: 0, fontWeight: 600 }}>{m.name}</td>
                        <td style={{ ...tdStyle(last), color: MUTED }}>{m.prov}</td>
                        <td style={{ ...tdStyle(last), textAlign: 'right' as const, fontFamily: MONO }}>${m.pin.toFixed(2)}</td>
                        <td style={{ ...tdStyle(last), textAlign: 'right' as const, fontFamily: MONO }}>${m.pout.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
