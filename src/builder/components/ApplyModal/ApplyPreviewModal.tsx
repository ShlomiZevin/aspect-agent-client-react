/**
 * ApplyPreviewModal — the "what will Alfred change?" review step.
 *
 * Flow:
 *   1. User clicks "Apply" in BuilderChat → modal opens, fires preview.
 *   2. Server runs the consolidator → returns { summary, description,
 *      targets[] }.
 *   3. User reviews. Description + reason are editable; targets are
 *      read-only (their `what_to_do` lines are what the patch generator
 *      will see).
 *   4. User clicks "Apply changes" → modal fires execute, shows
 *      "applying…" state, then either success (with a per-target tick)
 *      or an error chip with manual retry.
 *
 * The modal owns its own loading/error state; callers just need to
 * know `onSuccess` will fire so they can refetch the project.
 */

import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useBuilder, workingBodiesOf } from '../../state/BuilderContext';
import {
  applyGenerate,
  applyPreview,
  type ApplyGenerateResponse,
  type ApplyTarget,
} from '../../state/builderApi';
import styles from './ApplyPreviewModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  chatId: number;
  agentSlug: string;
  ownerUserId: string;
  /** Fired after the generated bodies land in the working copy. */
  onApplied?: (result: ApplyGenerateResponse) => void;
  /** The chat's pinned files — shown as chips in the loading state so
   *  it's visible up front what the plan will read. */
  chatPinnedFiles?: Array<{ id: string; name: string }>;
}

type Phase = 'loading' | 'review' | 'applying' | 'success' | 'error';

export function ApplyPreviewModal({
  open, onClose, chatId, agentSlug, ownerUserId, onApplied, chatPinnedFiles,
}: Props) {
  const { doc, applyAlfredBodies } = useBuilder();

  const [phase, setPhase]             = useState<Phase>('loading');
  const [summary, setSummary]         = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason]           = useState('');
  const [targets, setTargets]         = useState<ApplyTarget[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<Array<{ name: string; delivery: string }>>([]);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [result, setResult]           = useState<ApplyGenerateResponse | null>(null);

  // On open: fire the preview. Re-run every time the modal opens so
  // the user always sees the latest conversation state, not a stale
  // plan from a previous open.
  useEffect(() => {
    if (!open) return;
    setPhase('loading');
    setSummary('');
    setDescription('');
    setReason('');
    setTargets([]);
    setAlreadyApplied(false);
    setErrorMsg(null);
    setErrorDetails([]);
    setResult(null);

    let cancelled = false;
    (async () => {
      try {
        // The plan is built against the DRAFT the user sees.
        const plan = await applyPreview({
          chatId, agentSlug, ownerUserId,
          workingBodies: workingBodiesOf(doc, agentSlug),
        });
        if (cancelled) return;
        setSummary(plan.summary);
        setDescription(plan.description);
        setTargets(plan.targets);
        setPinnedFiles(plan.pinnedFiles ?? []);
        setAlreadyApplied(plan.alreadyApplied === true);
        setPhase('review');
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Preview failed');
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [open, chatId, agentSlug, ownerUserId]);

  const execute = async () => {
    setPhase('applying');
    setErrorMsg(null);
    setErrorDetails([]);
    try {
      // Alfred works on the VISIBLE version — send the working copies
      // so generation bases on exactly what's on screen (chained
      // applies stack; unsaved edits are respected). The server falls
      // back to the saved viewing version if this is absent.
      const workingBodies = workingBodiesOf(doc, agentSlug);

      const out = await applyGenerate({
        chatId,
        agentSlug,
        ownerUserId,
        targets,
        workingBodies,
      });

      // Drop the generated bodies into the working copy. The
      // BuilderContext stashes the Apply metadata so the eventual
      // Save(s) write the log row(s) — Apply itself does NOT save.
      // Nothing generated (everything already in place) → skip the
      // working-copy write entirely; success still shows the skipped
      // list so the user knows why nothing changed.
      if (out.generated.length > 0) applyAlfredBodies({
        applyGroupId: out.applyGroupId,
        chatId,
        summary,
        description,
        reason: reason.trim(),
        bodies: out.generated.map(g => ({
          entity:     g.entity,
          entityId:   g.entityId,
          entityName: g.entityName,
          what_to_do: g.what_to_do,
          bodyBefore: g.bodyBefore,
          newBody:    g.newBody,
        })),
      });

      setResult(out);
      setPhase('success');
      onApplied?.(out);
    } catch (err) {
      // Try to extract structured server-side validation errors from
      // the message (the http() helper concatenates status + text).
      const raw = err instanceof Error ? err.message : 'Apply failed';
      setErrorMsg(raw);
      try {
        const m = raw.match(/\{.*\}$/s);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (Array.isArray(parsed.errors)) setErrorDetails(parsed.errors);
        }
      } catch { /* ignore */ }
      setPhase('error');
    }
  };

  const retry = () => {
    setPhase('review');
    setErrorMsg(null);
    setErrorDetails([]);
  };

  const canApply = phase === 'review' && targets.length > 0;
  const isBusy   = phase === 'loading' || phase === 'applying';

  // Decide which footer to show. Each phase has different actions.
  let footer: React.ReactNode = null;
  if (phase === 'success') {
    footer = (
      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>
        Done
      </button>
    );
  } else if (phase === 'error') {
    footer = (
      <>
        <button type="button" className={styles.btn} onClick={onClose}>Close</button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={retry}>
          Back to review
        </button>
      </>
    );
  } else {
    footer = (
      <>
        {phase === 'review' && targets.length > 0 && (
          <span className={styles.footerLeft}>
            {targets.length} {targets.length === 1 ? 'change' : 'changes'} ready to apply
          </span>
        )}
        <button
          type="button"
          className={styles.btn}
          onClick={onClose}
          disabled={isBusy}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={execute}
          disabled={!canApply || isBusy}
        >
          {phase === 'applying' ? 'Applying…' : 'Apply changes'}
        </button>
      </>
    );
  }

  return (
    <Modal
      open={open}
      onClose={isBusy ? () => { /* block close while in-flight */ } : onClose}
      title="Apply Alfred's plan"
      width={620}
      footer={footer}
    >
      {phase === 'loading' && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>
            {chatPinnedFiles && chatPinnedFiles.length > 0
              ? 'Reading the conversation and the attached files…'
              : 'Reading the conversation…'}
          </span>
          {chatPinnedFiles && chatPinnedFiles.length > 0 && (
            // Bare chips — the framed strip belongs to the review page;
            // inside the centered loading state it read as a boxed island.
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {chatPinnedFiles.map(f => (
                <span key={f.id} className={styles.basedOnChip}>📎 {f.name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'applying' && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Generating the new bodies — 10–30 seconds per target.</span>
        </div>
      )}

      {phase === 'review' && (
        <>
          {summary && <p className={styles.summary}>{summary}</p>}

          {pinnedFiles.length > 0 && (
            <div className={styles.basedOnRow}>
              <span className={styles.basedOnLabel}>Based on</span>
              {pinnedFiles.map((f, i) => (
                <span
                  key={f.name + i}
                  className={styles.basedOnChip}
                  title={f.delivery === 'chat-only'
                    ? 'Image — seen in the chat only; generation reads the conversation about it'
                    : 'The generator receives this file — it is the source of truth for the plan'}
                >
                  📎 {f.name}
                  {f.delivery === 'chat-only' && <em className={styles.basedOnNote}>chat-only</em>}
                </span>
              ))}
            </div>
          )}

          {targets.length === 0 ? (
            <div className={styles.empty}>
              {alreadyApplied ? (
                <>
                  ✅ All caught up — everything in this conversation was already
                  applied. Keep chatting with Alfred about the next change, or
                  remove the "Applied" marker in the chat (✕ on hover) if you
                  want to re-collect earlier changes.
                </>
              ) : (
                <>
                  I couldn't pin down anything concrete to apply from this conversation yet.
                  Keep brainstorming with me, or click Cancel and come back when you've
                  agreed on something specific.
                </>
              )}
              {description && (
                <>
                  <br /><br />
                  <em>{description}</em>
                </>
              )}
            </div>
          ) : (
            <>
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Changes</div>
                <ul className={styles.targetList}>
                  {targets.map((t, i) => (
                    <li key={`${t.entity}_${t.entityId}_${i}`} className={styles.target}>
                      <span className={styles.targetBadge}>
                        {t.entity === 'agent' ? 'AGENT' : 'CREW'}
                      </span>
                      <div className={styles.targetBody}>
                        <span className={styles.targetName}>{t.entityName}</span>
                        <span className={styles.targetDesc}>{t.what_to_do}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Plan (editable)</div>
                <textarea
                  className={styles.textarea}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="The English plan Alfred will send to the patch generator. Edit if you want to clarify."
                />
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Reason for the log (optional)</div>
                <textarea
                  className={`${styles.textarea} ${styles.textareaShort}`}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Why this change? Shown in the agent's change log."
                />
              </div>
            </>
          )}
        </>
      )}

      {phase === 'success' && result && (
        <div className={styles.successWrap}>
          <div className={styles.successHeadline}>
            {result.generated.length > 0
              ? '✓ Applied to your draft'
              : '✓ Everything is already in place'}
          </div>
          <ul className={styles.appliedList}>
            {result.generated.map(g => (
              <li key={`${g.entity}_${g.entityId}`} className={styles.appliedRow}>
                <span className={styles.targetBadge}>
                  {g.entity === 'agent' ? 'AGENT' : 'CREW'}
                </span>
                <span>{g.entityName}</span>
              </li>
            ))}
            {(result.skipped ?? []).map(s => (
              <li key={`skip_${s.entity}_${s.entityId}`} className={styles.appliedRow}>
                <span className={styles.targetBadge}>
                  {s.entity === 'agent' ? 'AGENT' : 'CREW'}
                </span>
                <span>{s.entityName} — already in place, nothing to change</span>
              </li>
            ))}
          </ul>
          {result.generated.length > 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
              The new bodies are in your working copy. Review them in the canvas,
              then <strong>Save</strong> (or <strong>Save as…</strong>) to commit —
              the change log entry is written on Save. Nothing is committed yet.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
              Alfred verified the requested changes already exist in your draft —
              nothing was modified.
            </p>
          )}
        </div>
      )}

      {phase === 'error' && (
        <div className={styles.errorChip}>
          {errorMsg || 'Apply failed.'}
          {errorDetails.length > 0 && (
            <ul className={styles.errorList}>
              {errorDetails.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
