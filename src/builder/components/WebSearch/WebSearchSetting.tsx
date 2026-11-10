/**
 * WebSearchSetting — the "Web search" switch on the Talker and Thinker
 * settings (task #967). One row: switch · one-line summary · Edit. The row
 * never changes size: the summary and the Edit button are always there
 * (Edit is disabled while the switch is off), and the sites list + the
 * per-turn cap are edited in a small modal.
 *
 * The switch only makes the tool available: the agent searches ONLY where
 * its prompt allows it (Noa's review — the runtime appends a built-in rule,
 * services/webSearch.js WEB_SEARCH_RULE). The row's "Prompt must allow" pill
 * carries a one-line example in its tooltip; the modal shows it as one line.
 *
 * On a model whose provider has no built-in search (Gemini) the switch is
 * disabled with a one-line tooltip. Config shape: WebSearchConfig in
 * builder/types (server: services/webSearch.js).
 */

import { useState } from 'react';
import { InlineField } from '../AddonModal/InlineField';
import { Modal } from '../Modal/Modal';
import { providerSupportsWebSearch } from '../../registry/providerModels';
import type { ModelRef, WebSearchConfig } from '../../types';
import styles from './WebSearchSetting.module.css';

const DEFAULT_MAX = 3;
const MAX_MAX = 10;
const MAX_SITES = 20;

const EXAMPLE_LINE = 'Search the web for current exchange rates when asked.';
const ROW_TIP = 'Searches the web only where the prompt allows it. About $0.01 per search, plus the pages read.';
const PILL_TIP = `Searches only where the prompt allows it. Add a line like:\n"${EXAMPLE_LINE}"`;
const UNSUPPORTED_TIP = 'Web search works with OpenAI and Anthropic models only.';

/** "https://www.gov.il/he/x" → "gov.il"; junk → null. Mirrors the server. */
function cleanDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
  s = s.split(/[/?#\s]/)[0].replace(/:\d+$/, '').replace(/\.+$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

interface Props {
  value: WebSearchConfig | undefined;
  model: ModelRef | undefined;
  onChange: (next: WebSearchConfig | undefined) => void;
}

export function WebSearchSetting({ value, model, onChange }: Props) {
  const supported = providerSupportsWebSearch(model?.providerId);
  const on = !!value?.enabled;
  const sites = value?.allowedDomains ?? [];
  const max = value?.maxSearches ?? DEFAULT_MAX;
  const [editing, setEditing] = useState(false);

  const summary = !supported
    ? (on ? 'Ignored on this model' : 'Not available on this model')
    : !on
      ? 'Off'
      : `${sites.length === 0 ? 'Any site' : sites.length === 1 ? sites[0] : `${sites.length} sites`} · up to ${max} per turn`;

  const toggle = (next: boolean) => {
    // Turning it off keeps the sites and the cap, so turning it back on
    // brings them back.
    onChange({ ...(value ?? {}), enabled: next });
  };

  return (
    <InlineField label="Web search" hint={ROW_TIP}>
      <div className={styles.row} title={supported ? undefined : UNSUPPORTED_TIP}>
        <span
          className={`${styles.toggle} ${on ? styles.toggleOn : ''} ${supported ? '' : styles.toggleDisabled}`}
          role="switch"
          aria-checked={on}
          aria-disabled={!supported}
        >
          <input
            type="checkbox"
            className={styles.toggleInput}
            checked={on}
            disabled={!supported}
            onChange={e => toggle(e.target.checked)}
            aria-label="Web search"
          />
          <span className={styles.toggleKnob} />
        </span>
        <span className={`${styles.summary} ${on && supported ? '' : styles.summaryOff}`} title={on && sites.length > 1 ? sites.join(', ') : undefined}>
          {summary}
        </span>
        {/* Always rendered (dimmed when off) so the row never changes size. */}
        <span className={`${styles.permPill} ${on && supported ? '' : styles.permPillOff}`} title={PILL_TIP}>
          Prompt must allow
        </span>
        <button
          type="button"
          className={styles.editBtn}
          disabled={!on || !supported}
          onClick={() => setEditing(true)}
          title="Which sites, and how many searches per turn"
        >
          Edit
        </button>
      </div>
      {editing && (
        <WebSearchModal
          value={value ?? { enabled: true }}
          onClose={() => setEditing(false)}
          onSave={next => { onChange(next); setEditing(false); }}
        />
      )}
    </InlineField>
  );
}

function WebSearchModal({ value, onClose, onSave }: {
  value: WebSearchConfig;
  onClose: () => void;
  onSave: (next: WebSearchConfig) => void;
}) {
  const [text, setText] = useState((value.allowedDomains ?? []).join('\n'));
  const [max, setMax] = useState(value.maxSearches ?? DEFAULT_MAX);

  const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
  const cleaned: string[] = [];
  const bad: string[] = [];
  for (const l of lines) {
    const d = cleanDomain(l);
    if (!d) bad.push(l);
    else if (!cleaned.includes(d)) cleaned.push(d);
  }
  const tooMany = cleaned.length > MAX_SITES;

  const save = () => {
    const next: WebSearchConfig = { ...value, enabled: true };
    if (cleaned.length) next.allowedDomains = cleaned.slice(0, MAX_SITES);
    else delete next.allowedDomains;
    if (max !== DEFAULT_MAX) next.maxSearches = max;
    else delete next.maxSearches;
    onSave(next);
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={440}
      title="Web search"
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <span className={styles.footerSpacer} />
          <button type="button" className={styles.saveBtn} onClick={save} disabled={bad.length > 0 || tooMany}>
            Save
          </button>
        </div>
      }
    >
      <div className={styles.body}>
        <p className={styles.permLine} title="Without a line like this in the prompt, the agent never searches.">
          Allow it in the prompt, e.g. <q>{EXAMPLE_LINE}</q>
        </p>
        <label className={styles.field}>
          <span className={styles.label} title="Subdomains are included. Leave empty to search the whole web.">
            Only these sites
          </span>
          <textarea
            className={styles.textarea}
            rows={5}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'Leave empty for the whole web\ngov.il\nbankofisrael.org.il'}
            spellCheck={false}
            dir="ltr"
          />
          {/* Fixed-height slot — the modal never resizes as the note changes. */}
          <span className={`${styles.note} ${bad.length || tooMany ? styles.noteBad : ''}`}>
            {bad.length
              ? `Not a site: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}`
              : tooMany
                ? `Up to ${MAX_SITES} sites (${cleaned.length} now)`
                : cleaned.length
                  ? `${cleaned.length} site${cleaned.length === 1 ? '' : 's'}, subdomains included`
                  : 'Whole web'}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label} title="A cap — it may search fewer times. Each search is about $0.01.">
            Most searches per turn
          </span>
          <select className={styles.select} value={max} onChange={e => setMax(Number(e.target.value))}>
            {Array.from({ length: MAX_MAX }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}{n === DEFAULT_MAX ? ' (default)' : ''}</option>
            ))}
          </select>
        </label>
      </div>
    </Modal>
  );
}
