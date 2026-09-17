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
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import INSTRUCTIONS from '@guides/AGENT_BUILDING_INSTRUCTIONS.md?raw';
import { useBuilder } from '../../state/BuilderContext';
import { fetchAiBundle, fetchAiBundleVersion } from '../../state/builderApi';
import {
  chooseFolder, isSupported, readBundleVersion, rememberedFolder, writeBundle,
} from '../../state/folderDrafts';
import { STARTING_PROMPT, STEPS, TOOLS, type WizardTool } from './aiSetupContent';
import styles from './FolderDraftsModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** The same key the Builder itself mints and reads. */
function ownerUserId(): string {
  try { return localStorage.getItem('builder:ownerUserId') || 'anon'; } catch { return 'anon'; }
}

export function FolderDraftsModal({ open, onClose }: Props) {
  const { doc } = useBuilder();
  const agent = doc.agents[0];
  const slug  = agent?.slug || '';

  const [folderName, setFolderName] = useState<string | null>(null);
  const [toolId, setToolId]   = useState(TOOLS[0].id);
  const [setupOpen, setSetup] = useState(false);
  const [localV, setLocalV]   = useState<string | null>(null);
  const [serverV, setServerV] = useState<string | null>(null);
  const [busy, setBusy]       = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);
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
      if (!/abort/i.test(msg)) setError(msg);   // closing the picker is not a failure
    }
    finally { setBusy(null); }
  }, []);

  const pick = () => run('folder', async () => {
    const handle = await chooseFolder();
    if (!handle) return;
    setFolderName(handle.name);
    setLocalV(await readBundleVersion(handle));
    setNote(`Your draft now saves into “${handle.name}”.`);
  });

  const download = () => run('files', async () => {
    const handle = await rememberedFolder() || await chooseFolder();
    if (!handle) return;
    setFolderName(handle.name);

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

  const stale   = !!(localV && serverV && localV !== serverV);
  const current = !!(localV && serverV && localV === serverV);

  const stepDone = (id: string) =>
    (id === 'folder' && !!folderName)
    || (id === 'files' && current)
    || (id === 'send'  && !!folderName);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your AI folder"
      badge={<span className={styles.badge}>{folderName || 'Not connected'}</span>}
      width={620}
    >
      {!isSupported() ? (
        <p className={styles.p}>
          This needs Chrome or Edge — they are the only browsers that let a page
          read a folder on your computer. Everything else in the Builder works
          the same either way.
        </p>
      ) : (
        <>
          <div className={folderName ? styles.status : styles.statusOff}>
            <span className={styles.dot} />
            <span className={styles.statusText}>
              {folderName ? (
                <>
                  <span className={styles.statusTitle}>Saving to “{folderName}”</span>
                  <span className={styles.statusDetail}>
                    Your draft of <strong>{agent?.name || slug}</strong> saves here every
                    time you change something. If your assistant edits the file, you will
                    be asked whether to load it.
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.statusTitle}>No folder connected</span>
                  <span className={styles.statusDetail}>
                    Pick a folder and your draft starts saving there, where an AI
                    assistant on this machine can read and edit it.
                  </span>
                </>
              )}
            </span>
          </div>

          <div className={styles.actions}>
            <button className={folderName ? styles.ghost : styles.primary} onClick={pick} disabled={!!busy}>
              {folderName ? 'Change folder' : 'Choose folder'}
            </button>
          </div>

          {note  && <p className={styles.note}>{note}</p>}
          {error && <p className={styles.error}>{error}</p>}

          {/* Setup lives here too — same subject, and stranding it behind
              a different button is what made this confusing. */}
          <div className={styles.setup}>
            <button className={styles.setupHead} onClick={() => setSetup(o => !o)}>
              <span className={styles.setupHeadText}>
                <span className={styles.setupTitle}>Set up your AI</span>
                <span className={styles.setupSub}>
                  Install Claude Code or Codex, download the platform files, and copy
                  the starting prompt for a new session.
                </span>
              </span>
              <span className={styles.chev}>{setupOpen ? '▾' : '▸'}</span>
            </button>

            {setupOpen && (
              <div className={styles.setupBody}>
                <span className={styles.toolsLabel}>Which AI are you using?</span>
                <div className={styles.toolRow}>
                  {TOOLS.map(t => (
                    <button
                      key={t.id}
                      className={t.id === toolId ? styles.toolOn : styles.tool}
                      onClick={() => setToolId(t.id)}
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
                          <>
                            <button className={styles.link} onClick={download} disabled={!!busy}>
                              {busy?.startsWith('files')
                                ? `Writing… ${busy.split(':')[1] ?? ''}`
                                : stale ? 'Update the files' : current ? 'Write them again' : 'Download the files'}
                            </button>
                            {stale && (
                              <p className={styles.stepP}>
                                Your copy is out of date — the platform changed since you
                                last downloaded.
                              </p>
                            )}
                            {current && <p className={styles.ok}>Up to date ({localV}).</p>}
                          </>
                        )}

                        {s.id === 'send' && folderName && (
                          <p className={styles.ok}>Saving into “{folderName}” automatically.</p>
                        )}

                        {s.id === 'prompt' && (
                          <div className={styles.codeWrap}>
                            <pre className={styles.code}>{startingPrompt}</pre>
                            <button className={styles.copy} onClick={copyPrompt}>
                              {copied ? 'Copied' : 'Copy'}
                            </button>
                          </div>
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
