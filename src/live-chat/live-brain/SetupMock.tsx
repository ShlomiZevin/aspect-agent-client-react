/**
 * SetupMock — a static demonstration of the Live Brain authoring surface
 * (the future `/:agent/builder/live-brain` screen). Shows the panel list +
 * the design-time generate/iterate flow for a rich-HTML panel: describe →
 * template + value-schema + fill-prompt, plus the addon envelope. Presentation
 * only; no real generation wired.
 */

import { useState } from 'react';
import type { LiveBrainConfig, BrainPanel } from './types';

function chipFor(p: BrainPanel): string {
  if (p.source.kind === 'bind') return 'bind';
  return p.source.output === 'html' ? 'html' : 'text';
}

export function SetupMock({ config }: { config: LiveBrainConfig }) {
  const htmlPanel = config.panels.find((p) => p.render === 'html') ?? config.panels[0];
  const [selectedId, setSelectedId] = useState(htmlPanel.id);
  const selected = config.panels.find((p) => p.id === selectedId) ?? htmlPanel;
  const isHtml = selected.source.kind === 'addon' && selected.source.output === 'html';
  const env = selected.source.kind === 'addon' ? selected.source : null;

  return (
    <div className="lb-setup">
      {/* panel list */}
      <div className="lb-list">
        <h4>Panels</h4>
        {config.panels.map((p) => (
          <button
            key={p.id}
            className={`lb-pitem ${p.id === selectedId ? 'sel' : ''}`}
            onClick={() => setSelectedId(p.id)}
          >
            <span className="lb-grip" aria-hidden="true">⠿</span>
            <span className="lb-emoji">{p.emoji}</span>
            <span className="lb-nm">{p.title}</span>
            <span className="lb-kind">{chipFor(p)}</span>
          </button>
        ))}
        <button className="lb-add">+ Add panel</button>
      </div>

      {/* editor */}
      <div className="lb-editor">
        <div className="lb-card">
          <h3>{selected.emoji} {selected.title}</h3>
          <p className="lb-hint">
            {isHtml
              ? 'Rich panel — describe it once, Claude builds the template, value schema & fill-prompt together. Iterate until it looks right.'
              : selected.source.kind === 'bind'
                ? 'Bound panel — renders an existing brain value. No compute; it reuses what an addon already wrote.'
                : 'Text panel — a dedicated addon writes the text fresh each time it fires.'}
          </p>

          {selected.source.kind === 'bind' ? (
            <>
              <div className="lb-lab">Reads</div>
              <div className="lb-field lb-mono">{selected.source.token}</div>
            </>
          ) : (
            <>
              <div className="lb-lab">Describe this panel</div>
              <div className="lb-field lb-desc">{selected.description ?? '—'}</div>
              {isHtml && (
                <div className="lb-refine">
                  <div className="lb-field lb-ph">Make the bars thicker and add a small ↑/↓ trend arrow…</div>
                  <button className="lb-btn pri">Regenerate</button>
                </div>
              )}
            </>
          )}
        </div>

        {isHtml && (
          <div className="lb-three">
            <div className="lb-card">
              <div className="lb-lab">Generated template</div>
              <pre className="lb-mono lb-scroll">{selected.template}</pre>
            </div>
            <div className="lb-card">
              <div className="lb-lab">Value schema · the contract</div>
              <div className="lb-schema">
                {(selected.schema ?? []).map((s) => (
                  <div className="lb-slot" key={s.name}>
                    <code>{s.name}</code>
                    <span className="lb-ty">{s.type} · fallback “{s.fallback}”</span>
                  </div>
                ))}
              </div>
              <div className="lb-lab" style={{ marginTop: 14 }}>Runtime fill-prompt</div>
              <div className="lb-field lb-muted">{selected.fillPrompt}</div>
            </div>
          </div>
        )}

        {env && (
          <div className="lb-card">
            <div className="lb-lab">It’s an addon — reuses the whole envelope</div>
            <div className="lb-env">
              <span className="lb-e">🧩 <b>Model</b> · {env.model ?? 'default'}</span>
              <span className="lb-e">✏️ <b>Prompt</b> · / tokens + preview</span>
              <span className="lb-e">🕘 <b>History</b> · {env.historyLabel ?? 'last 5'}</span>
              {env.reads?.length ? <span className="lb-e">🧠 <b>Reads</b> · {env.reads.join(', ')}</span> : null}
              <span className="lb-e">⚡ <b>Lane</b> · non-blocking</span>
              <span className="lb-e">⏱ <b>When</b> · {env.trigger}</span>
            </div>
            <div className="lb-actions">
              <button className="lb-btn pri">Save panel</button>
              <button className="lb-btn ghost">Preview with sample data</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
