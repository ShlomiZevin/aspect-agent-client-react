/**
 * FolderDraftsModal — "Your AI folder". One dialog for the whole feature.
 *
 * Setup and daily use were two dialogs behind two toolbar glyphs, which
 * produced the obvious question: what is the robot, and what is the
 * folder? They are the same subject — where your draft lives and what is
 * reading it — so they are one screen, status first and setup underneath.
 *
 * There are no sync actions here, and that is the point. Once a folder is
 * connected the draft is written into it on every change, exactly the way
 * the Builder already keeps one in the browser; and if the file changes
 * on disk, that draft is read back (see BuilderContext). The folder is
 * simply where the draft lives, so there is nothing to push, pull or
 * reconcile — only two states worth showing: connected, or not.
 *
 * Two rules this screen follows:
 *
 *   - ONE message line, always rendered. A confirmation or an error
 *     swaps in where the hint sits, so picking a folder never pushes the
 *     rest of the dialog down.
 *   - The browser's own permission prompt is not ours to style, so it is
 *     announced before it appears and answered for afterwards — the
 *     button says what is about to happen, and declining lands in our
 *     own message line rather than in silence.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import INSTRUCTIONS from '@guides/AGENT_BUILDING_INSTRUCTIONS.md?raw';
import { ensureFolderDraft, useBuilder } from '../../state/BuilderContext';
import { fetchAiBundle, fetchAiBundleVersion } from '../../state/builderApi';
import {
  chooseFolder, isSupported, readBundleVersion, rememberedFolder, writeBundle,
} from '../../state/folderDrafts';
import {
  chosenTool, MCP_NOTE, MCP_URL, rememberTool, STARTING_PROMPT, STEPS, TIPS, TOOLS,
  type WizardTool,
} from './aiSetupContent';
import styles from './FolderDraftsModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** The same key the Builder itself mints and reads. */
function ownerUserId(): string {
  try { return localStorage.getItem('builder:ownerUserId') || 'anon'; } catch { return 'anon'; }
}

/**
 * The browser's prompt has exactly one bad outcome worth explaining:
 * the person pressed "Don't Allow". Everything else is ours to report
 * verbatim.
 */
function readableError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || /not allowed|permission/i.test(msg)) {
    return 'Your browser did not get permission for that folder. Choose it again and press Allow.';
  }
  return msg;
}

/* Line icons in currentColor. The emoji they replace rendered as heavy
   black glyphs on Windows, and could not take the card's state colour —
   which is half of what the status icon is for. */
const ICON = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};
const IconLink = () => (
  <svg {...ICON}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const IconFolder = () => (
  <svg {...ICON}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);
const IconAlert = () => (
  <svg {...ICON}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);
const IconTools = () => (
  <svg {...ICON}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

export function FolderDraftsModal({ open, onClose }: Props) {
  const { doc } = useBuilder();
  const agent = doc.agents[0];
  const slug  = agent?.slug || '';

  const [folderName, setFolderName] = useState<string | null>(null);
  const [toolId, setToolId]   = useState(() => chosenTool().id);
  const [setupOpen, setSetup] = useState(false);
  const [localV, setLocalV]   = useState<string | null>(null);
  const [serverV, setServerV] = useState<string | null>(null);
  const [busy, setBusy]       = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [note, setNote]       = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const owner = useMemo(ownerUserId, []);
  const tool: WizardTool = TOOLS.find(t => t.id === toolId) ?? TOOLS[0];

  useEffect(() => {
    if (!open || !isSupported()) return;
    let cancelled = false;
    void (async () => {
      const handle = await rememberedFolder();
      if (cancelled) return;
      setFolderName(handle?.name ?? null);
      if (handle) setLocalV(await readBundleVersion(handle));
    })();
    fetchAiBundleVersion().then(r => { if (!cancelled) setServerV(r.version); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(null); setNote(null);
    try { await fn(); }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/abort/i.test(msg)) setError(readableError(e));   // closing the picker is not a failure
    }
    finally { setBusy(null); }
  }, []);

  const pick = () => run('folder', async () => {
    const handle = await chooseFolder();
    if (!handle) return;
    setFolderName(handle.name);
    setLocalV(await readBundleVersion(handle));
    // Put the draft there immediately. Waiting for the next keystroke
    // means the assistant opens an empty folder and sends her back here.
    // This also covers CHANGING folders, which is how it was found: the
    // new folder inherited nothing and looked broken.
    const wrote = slug ? await ensureFolderDraft(handle, slug, doc) : false;
    // Settle the tool now, even if she never touched the chooser: from here
    // the toolbar button carries this name, and a default that was never
    // written down would leave it guessing on the next visit.
    rememberTool(toolId);
    setNote(wrote
      ? `Your draft of “${agent?.name || slug}” is now in “${handle.name}”.`
      : `Saving to “${handle.name}”. It already holds a draft of this agent — you will be asked before anything on your screen changes.`);
  });

  const download = () => run('files', async () => {
    const handle = await rememberedFolder() || await chooseFolder();
    if (!handle) return;
    setFolderName(handle.name);
    // Someone can reach this step having picked the folder in this same
    // dialog a moment ago, or having just picked one here. Either way the
    // folder must not be left without the agent it is for.
    if (slug) await ensureFolderDraft(handle, slug, doc);

    const bundle = await fetchAiBundle();
    const shipped = bundle.files.find(f => f.path.endsWith('AGENT_BUILDING_INSTRUCTIONS.md'));
    const files = [
      // Platform source keeps its repo path — the instructions refer to
      // files by exactly these names.
      ...bundle.files.map(f => ({ path: `aspect-agent-server/${f.path}`, content: f.content })),
      { path: tool.filename, content: shipped?.content ?? INSTRUCTIONS },
      { path: '.lybi/config.json', content: JSON.stringify({ ownerUserId: owner }, null, 2) },
    ];

    await writeBundle(handle, files, bundle.version,
      (n, total) => setBusy(`files:${n}/${total}`));
    setLocalV(bundle.version);
    setServerV(bundle.version);
    setNote('The platform files are in your folder and up to date.');
  });

  const startingPrompt = useMemo(
    () => STARTING_PROMPT
      .replace(/\{\{FILENAME\}\}/g, tool.filename)
      .replace(/\{\{AGENT\}\}/g, agent?.name || slug)
      .replace(/\{\{SLUG\}\}/g, slug)
      // A page can never read an absolute path out of a directory
      // handle. So rather than discover the location we DEFINE it: the
      // picker opens in Documents and the setup step says to make the
      // folder there, which makes this statement true by construction.
      .replace(/\{\{WHERE\}\}/g,
        // Addressed to the ASSISTANT throughout — this text gets pasted
        // into its session, so anything aimed at the person reads as
        // nonsense there and belongs in the wizard step instead.
        `Your working directory should be the folder "${folderName || 'the one I chose'}" in my Documents:\n`
        + `\n    Windows:  %USERPROFILE%\\Documents\\${folderName || '<folder>'}`
        + `\n    Mac:      ~/Documents/${folderName || '<folder>'}\n`
        + `\nEvery path below is relative to that folder.`),
    [tool.filename, agent?.name, slug, folderName],
  );

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(startingPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked; the text is selectable */ }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setUrlCopied(true);
      window.setTimeout(() => setUrlCopied(false), 1800);
    } catch { /* clipboard blocked; the URL is select-all on click */ }
  };

  const stale   = !!(localV && serverV && localV !== serverV);
  const current = !!(localV && serverV && localV === serverV);
  const picking = busy === 'folder';
  const writing = busy?.startsWith('files') ? busy.split(':')[1] : null;   // "12/90"
  const [wrote, total] = writing ? writing.split('/').map(Number) : [0, 0];

  const stepDone = (id: string) =>
    (id === 'folder' && !!folderName)
    || (id === 'files' && current)
    || (id === 'send'  && !!folderName);

  // The card answers one question — is my assistant seeing my work? —
  // and carries the action for it. Amber is for the one case that needs
  // a decision: the folder works, but its platform files are behind.
  const cardClass = !folderName ? styles.card
    : stale ? `${styles.card} ${styles.cardWarn}`
      : `${styles.card} ${styles.cardOk}`;
  const statusIcon = !folderName ? styles.iconIdle : stale ? styles.iconWarn : styles.iconOk;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Work with your AI"
      width={640}
    >
      {!isSupported() ? (
        <p className={styles.p}>
          This needs Chrome or Edge — they are the only browsers that let a page
          read a folder on your computer. Everything else in the Builder works
          the same either way.
        </p>
      ) : (
        <>
          {/* Two routes, in the order most people should try them. The link
              needs nothing installed, so it comes first; everything about
              the folder — its state, its message line, its setup — then
              follows as one uninterrupted group under a single "or", instead
              of the link card splitting the folder story in two. */}
          <section className={`${styles.card} ${styles.cardLink}`}>
            <span className={`${styles.cardIcon} ${styles.iconPrimary}`} aria-hidden="true">
              <IconLink />
            </span>
            <div className={styles.cardText}>
              <span className={styles.cardTitle}>No setup — just give it this link</span>
              <span className={styles.cardDetail}>{MCP_NOTE}</span>
              {/* URL and its Copy button are one control: the button sits on
                  the thing it copies, not floating mid-card. */}
              <div className={styles.linkRow}>
                <code className={styles.linkUrl}>{MCP_URL}</code>
                <button type="button" className={styles.linkCopy} onClick={copyUrl}>
                  {urlCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </section>

          <div className={styles.or}><span>or work from a folder on your computer</span></div>

          <section className={cardClass}>
            <span className={`${styles.cardIcon} ${statusIcon}`} aria-hidden="true">
              {stale ? <IconAlert /> : <IconFolder />}
            </span>
            <div className={styles.cardText}>
              <span className={styles.cardTitle}>
                {folderName
                  ? <>Saving to <span className={styles.folderName}>“{folderName}”</span></>
                  : 'No folder connected'}
              </span>
              <span className={styles.cardDetail}>
                {!folderName
                  ? 'Pick a folder and your draft starts saving there, where an AI assistant on this machine can read and edit it.'
                  : stale
                    ? 'The platform changed since you downloaded the files — your assistant is reading an old description of how it works.'
                    : <>Your draft of <strong>{agent?.name || slug}</strong> saves here on every change. If your assistant edits the file, you are asked whether to load it.</>}
              </span>
            </div>
            <button
              type="button"
              className={folderName ? styles.ghost : styles.primary}
              onClick={pick}
              disabled={!!busy}
            >
              {/* The label never changes while the picker is open. A longer
                  word ("Waiting for the browser…") widens the button, which
                  rewraps the description beside it — the panel visibly
                  reshuffles at the exact moment attention is on the browser's
                  own dialog. Dimmed-and-disabled says "busy" without moving
                  anything; the message line below says what is happening. */}
              {folderName ? 'Change folder' : 'Choose folder'}
            </button>
          </section>

          {/* One line, always here: hint → confirmation → error, in place. */}
          <div className={styles.msgSlot} role="status" aria-live="polite">
            {error ? (
              <span className={styles.msgError}>{error}</span>
            ) : note ? (
              <span className={styles.msgOk}>{note}</span>
            ) : (
              // Empty on purpose once a folder is connected: the card above
              // already says everything true at that moment, and a sentence
              // that exists only to fill the line gets read as if it meant
              // something. The slot keeps its height so the confirmation and
              // the error still arrive without moving the dialog.
              <span className={styles.msgHint}>
                {picking
                  ? 'Your browser is asking about the folder — press Allow to let the Builder save there.'
                  : folderName
                    ? ''
                    : 'Your browser will ask permission to edit files in the folder you choose.'}
              </span>
            )}
          </div>

          {/* Setup lives here too — same subject, and stranding it behind
              a different button is what made this confusing. */}
          <div className={styles.setup}>
            <button
              type="button"
              className={styles.setupHead}
              onClick={() => setSetup(o => !o)}
              aria-expanded={setupOpen}
            >
              <span className={`${styles.cardIcon} ${styles.iconPrimary}`} aria-hidden="true">
                <IconTools />
              </span>
              <span className={styles.setupHeadText}>
                <span className={styles.setupTitle}>Set up your AI</span>
                <span className={styles.setupSub}>
                  Install Claude Code or Codex, download the platform files, and copy
                  the starting prompt for a new session.
                </span>
              </span>
              <svg
                className={`${styles.chev} ${setupOpen ? styles.chevOpen : ''}`}
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            {setupOpen && (
              <div className={styles.setupBody}>
                <span className={styles.toolsLabel}>Which AI are you using?</span>
                <div className={styles.toolRow}>
                  {TOOLS.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={t.id === toolId ? styles.toolOn : styles.tool}
                      onClick={() => { setToolId(t.id); rememberTool(t.id); }}
                      aria-pressed={t.id === toolId}
                    >
                      <span className={styles.toolName}>{t.label}</span>
                      <span className={styles.toolAbout}>{t.about}</span>
                    </button>
                  ))}
                </div>

                <ol className={styles.steps}>
                  {STEPS.map((s, i) => (
                    <li key={s.id} className={stepDone(s.id) ? styles.stepDone : styles.step}>
                      <span className={styles.tick}>{stepDone(s.id) ? '✓' : i + 1}</span>
                      <div className={styles.stepBody}>
                        <h4 className={styles.stepTitle}>{s.title}</h4>
                        {s.body.map((p, n) => <p key={n} className={styles.stepP}>{p}</p>)}

                        {s.id === 'install' && (
                          <a className={styles.link} href={tool.installUrl} target="_blank" rel="noreferrer">
                            Download {tool.label} ↗
                          </a>
                        )}

                        {s.id === 'files' && (
                          writing ? (
                            <div className={styles.progress}>
                              <span className={styles.progressTrack}>
                                <span
                                  className={styles.progressBar}
                                  style={{ width: `${total ? Math.round((wrote / total) * 100) : 0}%` }}
                                />
                              </span>
                              <span className={styles.progressText}>{wrote}/{total}</span>
                            </div>
                          ) : (
                            <>
                              <button type="button" className={styles.link} onClick={download} disabled={!!busy}>
                                {stale ? 'Update the files' : current ? 'Write them again' : 'Download the files'}
                              </button>
                              {stale && (
                                <p className={styles.warn}>
                                  Your copy is out of date — the platform changed since you
                                  last downloaded.
                                </p>
                              )}
                              {current && <p className={styles.ok}>Up to date ({localV}).</p>}
                            </>
                          )
                        )}

                        {s.id === 'send' && folderName && (
                          <p className={styles.ok}>Saving into “{folderName}” automatically.</p>
                        )}

                        {s.id === 'prompt' && (
                          <div className={styles.codeWrap}>
                            <pre className={styles.code}>{startingPrompt}</pre>
                            <button type="button" className={styles.copy} onClick={copyPrompt}>
                              {copied ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        )}

                        {s.id === 'go' && (
                          <ul className={styles.tips}>
                            <li className={styles.tipsTitle}>What makes this work well</li>
                            {TIPS.map((t, n) => <li key={n} className={styles.tip}>{t}</li>)}
                          </ul>
                        )}

                        {s.note && <p className={styles.stepP}>{s.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <p className={styles.foot}>
            Your assistant edits your draft. Nothing reaches the server until you
            Save, and Revert undoes it.
          </p>
        </>
      )}
    </Modal>
  );
}
