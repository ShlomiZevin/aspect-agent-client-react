/**
 * PromptGuideModal — the beginner-proof prompt reference, EN + HE.
 *
 * Opened from the TopBar 📖 button. Task-oriented groups ("use a
 * value", "ask the model to fill a field", …), one plain sentence per
 * token, tiny examples, click-to-copy chips, and a search box that
 * filters across both languages. Language toggle persists; Hebrew
 * renders RTL.
 *
 * Content lives in promptGuideContent.ts — keep it in sync with
 * `aspect-agent-server/builder/promptPlaceholders.json`.
 */

import { useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import {
  GUIDE_GROUPS,
  GUIDE_SCENARIO,
  GUIDE_SIGILS,
  GUIDE_UI,
  type GuideLang,
} from './promptGuideContent';
import styles from './PromptGuideModal.module.css';

const LANG_KEY = 'builder:promptGuideLang';

function loadLang(): GuideLang {
  try { return localStorage.getItem(LANG_KEY) === 'he' ? 'he' : 'en'; } catch { return 'en'; }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PromptGuideModal({ open, onClose }: Props) {
  const [lang, setLang] = useState<GuideLang>(loadLang);
  const [query, setQuery] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const pickLang = (l: GuideLang) => {
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(t => (t === token ? null : t)), 1200);
    } catch { /* clipboard blocked — nothing to do */ }
  };

  // Filter groups by the query across token text + BOTH languages, so
  // a Hebrew user typing an English token (or vice versa) still hits.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDE_GROUPS;
    return GUIDE_GROUPS
      .map(g => ({
        ...g,
        entries: g.entries.filter(e =>
          e.token.toLowerCase().includes(q)
          || e.what.en.toLowerCase().includes(q)
          || e.what.he.includes(q)
          || (e.example ?? '').toLowerCase().includes(q)),
      }))
      .filter(g => g.entries.length > 0);
  }, [query]);

  const he = lang === 'he';

  return (
    <Modal open={open} onClose={onClose} width={720} title={<>📖 {GUIDE_UI.title[lang]}</>}>
      <div className={styles.body} dir={he ? 'rtl' : 'ltr'}>
        <div className={styles.headRow}>
          <p className={styles.subtitle}>{GUIDE_UI.subtitle[lang]}</p>
          <div className={styles.langToggle} dir="ltr">
            <button
              type="button"
              className={`${styles.langBtn} ${!he ? styles.langBtnActive : ''}`}
              onClick={() => pickLang('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`${styles.langBtn} ${he ? styles.langBtnActive : ''}`}
              onClick={() => pickLang('he')}
            >
              עברית
            </button>
          </div>
        </div>

        <div className={styles.golden}>💡 {GUIDE_UI.golden[lang]}</div>

        <input
          className={styles.search}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={GUIDE_UI.search[lang]}
        />

        {!query.trim() && (
          <div className={styles.sigils}>
            <div className={styles.sigilsTitle}>{GUIDE_UI.shortcuts[lang]}</div>
            <div className={styles.sigilsIntro}>{GUIDE_UI.shortcutsIntro[lang]}</div>
            <div className={styles.sigilGrid}>
              {GUIDE_SIGILS.map(s => (
                <div key={s.sigil} className={styles.sigilRow}>
                  <span className={styles.sigilKey} dir="ltr">{s.sigil}</span>
                  <span className={styles.sigilWhat}>{s.what[lang]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* The running example every entry below refers back to. */}
        {!query.trim() && (
          <div className={styles.scenario}>
            <div className={styles.scenarioTitle}>🛍️ {GUIDE_UI.scenarioTitle[lang]}</div>
            <ul className={styles.scenarioList}>
              {GUIDE_SCENARIO.map((line, i) => (
                <li key={i}>{line[lang]}</li>
              ))}
            </ul>
          </div>
        )}

        {groups.length === 0 && (
          <div className={styles.noResults}>{GUIDE_UI.noResults[lang]}</div>
        )}

        {groups.map(group => (
          <section key={group.title.en} className={styles.group}>
            <h3 className={styles.groupTitle}>
              <span aria-hidden>{group.icon}</span> {group.title[lang]}
            </h3>
            {group.intro && <p className={styles.groupIntro}>{group.intro[lang]}</p>}
            {group.walkthrough && !query.trim() && (
              <ol className={styles.walkthrough}>
                {group.walkthrough.map((step, i) => (
                  <li key={i}>{step[lang]}</li>
                ))}
              </ol>
            )}
            <div className={styles.entries}>
              {group.entries.map(entry => (
                <div key={entry.token} className={styles.entry}>
                  <div className={styles.entryHead}>
                    <button
                      type="button"
                      className={styles.tokenChip}
                      dir="ltr"
                      onClick={() => copy(entry.token)}
                      title={GUIDE_UI.copyTip[lang]}
                    >
                      {copiedToken === entry.token ? `✓ ${GUIDE_UI.copied[lang]}` : entry.token}
                    </button>
                    {entry.sigil && (
                      <span className={styles.sigilBadge} dir="ltr" title={GUIDE_UI.shortcuts[lang]}>
                        {entry.sigil}
                      </span>
                    )}
                    {entry.badge && (
                      <span className={styles.entryBadge}>{entry.badge[lang]}</span>
                    )}
                  </div>
                  <p className={styles.entryWhat}>{entry.what[lang]}</p>
                  {entry.example && (
                    <div className={styles.exampleRow}>
                      <pre className={styles.example} dir="ltr">
                        <span className={styles.exampleLabel}>✏️ {GUIDE_UI.youWrite[lang]}</span>
                        {entry.example}
                      </pre>
                      {entry.renders && (
                        <pre className={`${styles.example} ${styles.exampleOut}`} dir="ltr">
                          <span className={styles.exampleLabel}>🤖 {GUIDE_UI.modelGets[lang]}</span>
                          {entry.renders}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
