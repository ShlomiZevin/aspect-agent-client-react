/**
 * KbRetrieverRunBody — the KB Retriever's own debug body inside the
 * AddonRunCard. The generic Prompt/Output/Memory sections don't fit an
 * addon that runs up to three sub-steps (decide → rewrite → search) and
 * writes an ephemeral slot, so this renders the run as a readable trail:
 *
 *   1. Steps   — When → What → Search, each LLM step expandable to its
 *                prompt + raw answer (so "why did it fire / what did it
 *                ask" is always answerable).
 *   2. Results — retrieved chunks as clean cards (filename + score%, the
 *                chunk text clamped/expandable) — never the raw \n\n JSON.
 *   3. Wrote   — what landed in the {{kb:NAME}} brain slot this turn.
 *
 * Reads the structured `parsedOutput` the server plugin emits.
 */

import { useState } from 'react';
import styles from './KbRetrieverRunBody.module.css';

interface KbStep {
  id: string;
  title: string;
  summary: string;
  error?: boolean;
  llm?: { model: string | null; history: string; prompt: string; output: string };
  namespaces?: string[];
  topK?: number;
  minScore?: number;
}
interface KbHit {
  fileName: string;
  score: number;
  chunkIndex?: number;
  namespace?: string;
  text: string;
}
export interface KbParsed {
  kb: string;
  fired: boolean;
  steps: KbStep[];
  written?: { slot: string; action: 'set' | 'cleared' | 'kept'; chars: number | null };
  query?: string | null;
  hitCount?: number;
  queryTimeMs?: number;
  hits?: KbHit[];
  note?: string;
  error?: string;
}

const STEP_ICON: Record<string, string> = { trigger: '🟢', query: '✏️', search: '🔎' };

export function KbRetrieverRunBody({ parsed }: { parsed: KbParsed }) {
  const hits = parsed.hits ?? [];
  const written = parsed.written;
  return (
    <div className={styles.wrap}>
      {/* ── Step trail ── */}
      <div className={styles.steps}>
        {parsed.steps.map((s, i) => <StepRow key={i} step={s} />)}
      </div>

      {/* ── Final query (what actually hit the index) ── */}
      {parsed.query && (
        <div className={styles.queryLine}>
          <span className={styles.queryLabel}>Searched for</span>
          <span className={styles.queryText}>{parsed.query}</span>
        </div>
      )}

      {/* ── Results ── */}
      {hits.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsHead}>
            {hits.length} result{hits.length === 1 ? '' : 's'}
            {typeof parsed.queryTimeMs === 'number' && <span className={styles.dim}> · {parsed.queryTimeMs}ms</span>}
          </div>
          {hits.map((h, i) => <HitCard key={i} hit={h} />)}
        </div>
      )}
      {parsed.fired && hits.length === 0 && (
        <div className={styles.noResults}>No chunks passed the score threshold.</div>
      )}

      {/* ── What was written to the brain slot ── */}
      {written && (
        <div className={styles.written}>
          <span className={styles.writtenToken}>{`{{kb:${written.slot}}}`}</span>
          <span className={styles.writtenArrow}>←</span>
          {written.action === 'set' && <span className={styles.writtenSet}>injected {written.chars} chars</span>}
          {written.action === 'cleared' && <span className={styles.writtenEmpty}>cleared (empty message)</span>}
          {written.action === 'kept' && <span className={styles.writtenEmpty}>kept previous result</span>}
        </div>
      )}
    </div>
  );
}

function StepRow({ step }: { step: KbStep }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!step.llm;
  return (
    <div className={styles.step}>
      <button
        type="button"
        className={styles.stepHead}
        onClick={hasDetail ? () => setOpen(o => !o) : undefined}
        style={hasDetail ? undefined : { cursor: 'default' }}
      >
        <span className={styles.stepIcon}>{STEP_ICON[step.id] ?? '•'}</span>
        <span className={styles.stepTitle}>{step.title}</span>
        <span className={`${styles.stepSummary} ${step.error ? styles.stepError : ''}`}>{step.summary}</span>
        {step.llm && <span className={styles.stepModel}>🤖 {step.llm.model ?? 'model'}</span>}
        {hasDetail && <span className={styles.stepCaret}>{open ? '▾' : '▸'}</span>}
      </button>
      {hasDetail && open && step.llm && (
        <div className={styles.stepDetail}>
          <div className={styles.detailMeta}>history: {step.llm.history}</div>
          <div className={styles.detailLabel}>Prompt sent</div>
          <pre className={styles.detailPre}>{step.llm.prompt}</pre>
          <div className={styles.detailLabel}>LLM answered</div>
          <pre className={styles.detailPre}>{step.llm.output}</pre>
        </div>
      )}
    </div>
  );
}

function HitCard({ hit }: { hit: KbHit }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((Number(hit.score) || 0) * 100);
  // The chunk text is the long part — clamp by default, expand on click.
  return (
    <div className={styles.hit}>
      <button type="button" className={styles.hitHead} onClick={() => setOpen(o => !o)}>
        <span className={styles.hitCaret}>{open ? '▾' : '▸'}</span>
        <span className={styles.hitFile}>{hit.fileName}</span>
        {hit.namespace && <span className={styles.hitNs}>{hit.namespace}</span>}
        <span className={styles.hitScore} title="cosine similarity">{pct}%</span>
      </button>
      <div className={`${styles.hitText} ${open ? styles.hitTextOpen : styles.hitTextClamped}`}>
        {hit.text}
      </div>
    </div>
  );
}
