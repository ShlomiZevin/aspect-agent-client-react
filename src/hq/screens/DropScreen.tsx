/**
 * HQ — Drop.
 *
 * Paste a link or some text; HQ works out what it is. Drop is the universal
 * fallback for every connector, so nothing downstream is ever on the critical
 * path (LYBI_HQ.md §4).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { drop, getStatus, inspectDrop } from '../services/hqApi';
import type { DropInspection } from '../types';
import styles from './DropScreen.module.css';

interface Props { onIngested?: () => void }

type Phase = 'idle' | 'inspecting' | 'importing' | 'done' | 'error';

/** Covers notion.so, notion.site and app.notion.com, plus a bare page id. */
const LOOKS_NOTION = /notion\.(so|site)|app\.notion\.com|[0-9a-f]{32}/i;

interface Outcome {
  headline: string;
  detail: string;
  atomId?: number;
  failures?: { title: string; error: string }[];
}

export function DropScreen({ onIngested }: Props) {
  const [input, setInput] = useState('');
  const [kind, setKind] = useState('auto');
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [inspection, setInspection] = useState<DropInspection | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, title: '' });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notionReady, setNotionReady] = useState<boolean | null>(null);
  const navigate = useNavigate();

  // The setup guide is one-time scaffolding — hide it once the token is live.
  useEffect(() => {
    getStatus().then(s => setNotionReady(s.notionConfigured)).catch(() => setNotionReady(null));
  }, []);

  const inspectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to the CSS max-height, so the box starts small
  // instead of sitting there as a large empty rectangle.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Debounced: as soon as a Notion link is recognised we show what it is and
  // how many rows it holds, so nobody imports 400 pages by surprise.
  const runInspection = useCallback((value: string) => {
    if (inspectTimer.current) clearTimeout(inspectTimer.current);
    if (!LOOKS_NOTION.test(value)) { setInspection(null); return; }

    inspectTimer.current = setTimeout(async () => {
      setPhase('inspecting');
      try {
        setInspection(await inspectDrop(value));
      } catch (err) {
        setInspection({ type: 'notion', error: err instanceof Error ? err.message : 'Could not read that link' });
      } finally {
        setPhase('idle');
      }
    }, 550);
  }, []);

  useEffect(() => () => { if (inspectTimer.current) clearTimeout(inspectTimer.current); }, []);

  function handleChange(value: string) {
    setInput(value);
    setOutcome(null);
    setError(null);
    runInspection(value);
  }

  async function submit() {
    const value = input.trim();
    if (!value) return;

    setPhase('importing');
    setError(null);
    setOutcome(null);
    setProgress({ done: 0, total: 0, title: '' });

    try {
      const result = await drop(value, kind, setProgress);

      if (result.type === 'notion') {
        setOutcome({
          headline: `Imported ${result.ingested} of ${result.total} from "${result.label}"`,
          detail: result.notionType === 'database'
            ? 'Every row is indexed and askable. Meetings are being summarised now.'
            : 'Indexed and askable.',
          failures: result.failures,
        });
      } else {
        setOutcome({
          headline: 'Saved to HQ',
          detail: `HQ has read "${result.atom?.title}" — you can ask about it now.`,
          atomId: result.atom?.id,
        });
      }

      setPhase('done');
      setInput('');
      setInspection(null);
      onIngested?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setPhase('error');
    }
  }

  const busy = phase === 'importing';
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <span className={`hqEyebrow ${styles.eyebrow}`}>Add to HQ</span>
          <h1 className={styles.title}>Add something</h1>
          <p className={styles.subtitle}>
            A Notion link, a URL, or just type. Paste a Notion <strong>database</strong> link and
            every row comes in at once.
          </p>
        </div>

        <div className={`${styles.box} ${focused ? styles.boxFocused : ''}`}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={input}
            disabled={busy}
            dir="auto"
            placeholder="Paste a Notion link, or write anything you want HQ to remember…"
            onChange={e => handleChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
            }}
          />
          <div className={styles.boxFoot}>
            <span className={styles.footHint}>⌘/Ctrl + Enter to save</span>
            <select
              className={styles.kindSelect}
              value={kind}
              disabled={busy}
              onChange={e => setKind(e.target.value)}
            >
              <option value="auto">Detect type</option>
              <option value="meeting">Meeting</option>
              <option value="doc">Document</option>
              <option value="note">Note</option>
            </select>
            <button className="hqPill" onClick={submit} disabled={busy || !input.trim()}>
              {busy ? 'Importing…' : 'Save to HQ'}
            </button>
          </div>
        </div>

        {inspection && !busy && (
          <div className={`${styles.inspect} ${inspection.error ? styles.inspectError : ''}`}>
            <span className={styles.inspectIcon}>
              {inspection.error ? '⚠' : inspection.notionType === 'database' ? '🗂' : '📄'}
            </span>
            <div className={styles.inspectBody}>
              {inspection.error ? (
                <>
                  <div className={styles.inspectTitle}>Can't read that link</div>
                  <div className={styles.inspectMeta}>{inspection.error}</div>
                </>
              ) : (
                <>
                  <div className={styles.inspectTitle}>{inspection.title}</div>
                  <div className={styles.inspectMeta}>
                    Notion {inspection.notionType}
                    {inspection.rowCount != null && ` · ${inspection.rowCount} pages will be imported`}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {busy && (
          <div className={styles.progress}>
            <div className={styles.progressHead}>
              <span className={styles.progressCurrent}>{progress.title || 'Starting…'}</span>
              <span className={styles.progressCount}>
                {progress.total ? `${progress.done} / ${progress.total}` : ''}
              </span>
            </div>
            <div className={styles.bar}>
              <div className={styles.barFill} style={{ width: `${pct || 4}%` }} />
            </div>
          </div>
        )}

        {outcome && (
          <div className={styles.result}>
            <div className={styles.resultTitle}>✓ {outcome.headline}</div>
            <div className={styles.resultMeta}>{outcome.detail}</div>
            {outcome.failures && outcome.failures.length > 0 && (
              <div className={styles.failures}>
                {outcome.failures.length} page{outcome.failures.length === 1 ? '' : 's'} couldn't be
                read — check they're shared with the integration.
              </div>
            )}
            <button
              className={styles.resultLink}
              onClick={() => navigate(outcome.atomId ? `../knowledge/${outcome.atomId}` : '../knowledge')}
            >
              {outcome.atomId ? 'Open it →' : 'Open the library →'}
            </button>
          </div>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        {notionReady === false && (
          <div className={styles.setup}>
            <span className={`hqEyebrow ${styles.setupTitle}`}>Connect Notion · once, ~10 min</span>
            <ol className={styles.setupList}>
              <li>Notion → Settings → Connections → <em>Develop or manage integrations</em> → New integration.</li>
              <li>Enable <strong>Read content</strong>, <strong>Read comments</strong> and <strong>Read user information</strong>.</li>
              <li>Copy the secret into the server as <code>NOTION_TOKEN</code>, then restart it.</li>
              <li>Open the page or database in Notion → <code>⋯</code> → <strong>Connections</strong> → add the integration. This cascades to everything beneath it.</li>
            </ol>
          </div>
        )}

        {notionReady === true && (
          <div className={styles.connected}>
            <span className={styles.connectedDot} />
            Notion is connected — paste any page or database link above.
          </div>
        )}

      </div>
    </div>
  );
}
