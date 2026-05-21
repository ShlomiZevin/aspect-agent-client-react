/**
 * AddonRunCard — one addon's run, live or historical. Same shape
 * either way:
 *   - status: running | success | error
 *   - prompt (assembled), raw output, memory writes (with parse
 *     errors collapsed into the same section)
 *   - expandable to show details
 */

import { useState } from 'react';
import { getPlugin } from '../../registry/plugins';
import styles from './AddonRunCard.module.css';

export interface AddonRunSnapshot {
  instanceId: string;
  pluginId: string;
  label?: string;
  status: 'running' | 'success' | 'error';
  prompt?: string;
  rawOutput?: string;
  parsedOutput?: unknown;
  memoryWrites?: Array<{ domain: string | null; field: string; value: unknown }>;
  parseError?: string;
  durationMs?: number;
  error?: { code: string; message: string };
}

interface Props {
  run: AddonRunSnapshot;
}

function formatDomain(domain: string | null): string {
  return domain && domain.trim() ? domain : 'general';
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AddonRunCard({ run }: Props) {
  const [open, setOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const desc = getPlugin(run.pluginId);
  const accent = desc?.color || '#6366f1';

  const writes = run.memoryWrites ?? [];
  const hasWrites = writes.length > 0;
  const hasParseError = !!run.parseError;
  const showMemorySection = hasWrites || hasParseError;

  const onCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!run.prompt) return;
    const ok = await copyToClipboard(run.prompt);
    if (ok) {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1200);
    }
  };

  return (
    <div className={styles.card} style={{ ['--accent' as string]: accent }}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.caret}>{open ? '▾' : '▸'}</span>
        <span className={styles.icon} style={{ background: `${accent}22`, color: accent }}>
          {desc?.icon ?? '?'}
        </span>
        <span className={styles.name}>{run.label || desc?.name || run.pluginId}</span>
        <span className={`${styles.status} ${styles[`status_${run.status}`]}`}>
          {run.status === 'running' ? '… running' : run.status === 'error' ? 'error' : 'done'}
        </span>
        {typeof run.durationMs === 'number' && run.status !== 'running' && (
          <span className={styles.duration}>{run.durationMs}ms</span>
        )}
      </button>

      {open && (
        <div className={styles.body}>
          {run.prompt !== undefined && (
            <Section
              title="Prompt"
              actions={
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={onCopyPrompt}
                  title="Copy prompt"
                >
                  {promptCopied ? '✓ copied' : 'copy'}
                </button>
              }
            >
              <pre className={styles.pre}>{run.prompt}</pre>
            </Section>
          )}

          {run.rawOutput !== undefined && run.rawOutput !== '' && (
            <Section title="Output">
              <pre className={styles.pre}>{run.rawOutput}</pre>
            </Section>
          )}

          {showMemorySection && (
            <Section title="Memory writes">
              {hasParseError && (
                <div className={styles.memoryError}>
                  ⚠ Couldn't parse JSON: {run.parseError}
                </div>
              )}
              {hasWrites && (
                <ul className={styles.writesList}>
                  {writes.map((w, i) => (
                    <li key={i}>
                      <span className={styles.writeDomain}>{formatDomain(w.domain)}</span>
                      <span className={styles.writeField}>{w.field}</span>
                      <span className={styles.writeEq}>=</span>
                      <span className={styles.writeValue}>{formatValue(w.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!hasWrites && !hasParseError && (
                <div className={styles.memoryNote}>Nothing extracted</div>
              )}
            </Section>
          )}

          {run.error && (
            <Section title="Error">
              <pre className={`${styles.pre} ${styles.preError}`}>
                {run.error.code}: {run.error.message}
              </pre>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
        {actions}
      </div>
      {children}
    </div>
  );
}
