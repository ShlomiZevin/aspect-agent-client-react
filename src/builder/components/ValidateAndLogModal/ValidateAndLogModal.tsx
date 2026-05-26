/**
 * ValidateAndLogModal — manual change journalling with LLM diff check.
 *
 * Flow:
 *   1. User edits an agent or crew manually, saves.
 *   2. They open this modal (button next to Save in the title bar).
 *   3. They type "what I changed" and an optional reason.
 *   4. Server runs an LLM that compares the body-before / body-after
 *      and returns: yes / partial / no — with a one-line note.
 *   5. On yes/partial the user can Log; on no, they must re-edit the
 *      claim (the diff doesn't reflect what they say they did).
 *
 * The "before" body comes from the most recent log entry's bodyAfter
 * for this entity — or v1 of the version history if nothing's been
 * logged yet — so each log captures "everything since the last log".
 */

import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import {
  validateClaim,
  writeManualLog,
  type ValidateClaimResponse,
} from '../../state/builderApi';
import styles from './ValidateAndLogModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: string;
  agentSlug: string;
  ownerUserId: string;
  entity: 'agent' | 'crew';
  entityId: string;
  /** Display name used in the title; entity name is re-snapshotted at log time. */
  entityName: string;
  /** Optional callback after a successful log. */
  onLogged?: (logId: number) => void;
}

type Phase = 'edit' | 'validating' | 'result' | 'logging' | 'logged' | 'error';

const PRIOR_LABEL: Record<ValidateClaimResponse['priorSource'], string> = {
  'last-log': 'Comparing against the most recent log entry for this body.',
  'v1':       'Comparing against the initial version (no log entries yet).',
  'empty':    'No prior state on record — diff is against an empty body.',
};

export function ValidateAndLogModal({
  open, onClose, agentId, agentSlug, ownerUserId,
  entity, entityId, entityName, onLogged,
}: Props) {
  const [phase, setPhase]               = useState<Phase>('edit');
  const [claim, setClaim]               = useState('');
  const [reason, setReason]             = useState('');
  const [validation, setValidation]     = useState<ValidateClaimResponse | null>(null);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [loggedId, setLoggedId]         = useState<number | null>(null);

  // Reset whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setPhase('edit');
    setClaim('');
    setReason('');
    setValidation(null);
    setErrorMsg(null);
    setLoggedId(null);
  }, [open]);

  const runValidate = async () => {
    if (!claim.trim()) return;
    setPhase('validating');
    setErrorMsg(null);
    try {
      const v = await validateClaim({
        agentId,
        entity,
        entityId,
        claim:       claim.trim(),
        agentSlug,
        ownerUserId,
      });
      setValidation(v);
      setPhase('result');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Validation failed');
      setPhase('error');
    }
  };

  const runLog = async () => {
    if (!validation) return;
    setPhase('logging');
    setErrorMsg(null);
    try {
      const out = await writeManualLog({
        agentId,
        entity,
        entityId,
        entityName:  validation.entityName,
        reason:      reason.trim(),
        whatChanged: claim.trim(),
        bodyBefore:  validation.bodyBefore,
        bodyAfter:   validation.bodyAfter,
        ownerUserId,
      });
      setLoggedId(out.logId);
      setPhase('logged');
      onLogged?.(out.logId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Log write failed');
      setPhase('error');
    }
  };

  const backToEdit = () => {
    setPhase('edit');
    setErrorMsg(null);
  };

  // Footer composition per phase.
  let footer: React.ReactNode = null;
  if (phase === 'edit') {
    footer = (
      <>
        <button type="button" className={styles.btn} onClick={onClose}>Cancel</button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={runValidate}
          disabled={!claim.trim()}
        >
          Validate
        </button>
      </>
    );
  } else if (phase === 'validating' || phase === 'logging') {
    footer = (
      <button type="button" className={styles.btn} disabled>
        Working…
      </button>
    );
  } else if (phase === 'result' && validation) {
    const canLog = validation.matches === 'yes' || validation.matches === 'partial';
    footer = (
      <>
        <button type="button" className={styles.btn} onClick={backToEdit}>
          Edit claim
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={runLog}
          disabled={!canLog}
        >
          {validation.matches === 'no' ? 'Cannot log — diff mismatched' : 'Add to log'}
        </button>
      </>
    );
  } else if (phase === 'logged') {
    footer = (
      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>
        Done
      </button>
    );
  } else if (phase === 'error') {
    footer = (
      <>
        <button type="button" className={styles.btn} onClick={onClose}>Close</button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={backToEdit}>
          Try again
        </button>
      </>
    );
  }

  return (
    <Modal
      open={open}
      onClose={(phase === 'validating' || phase === 'logging') ? () => { /* block */ } : onClose}
      title="Validate & log change"
      badge={entityName ? `${entity}: ${entityName}` : entity}
      width={560}
      footer={footer}
    >
      {phase === 'edit' && (
        <>
          <p className={styles.intro}>
            Tell me what you changed in this {entity}. I'll diff the current saved
            state against the last logged state and confirm the change is actually
            there before adding a log entry.
          </p>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>What did you change?</span>
            <textarea
              className={styles.textarea}
              value={claim}
              onChange={e => setClaim(e.target.value)}
              placeholder="e.g. Renamed the Talker addon, updated the persona, added a customer_email field"
              autoFocus
            />
          </div>
          <div className={`${styles.field} ${styles.fieldGap}`}>
            <span className={styles.fieldLabel}>Reason (optional)</span>
            <textarea
              className={`${styles.textarea} ${styles.textareaShort}`}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why this change? Shown in the change log."
            />
          </div>
        </>
      )}

      {phase === 'validating' && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Comparing your edit to the saved JSON…</span>
        </div>
      )}

      {phase === 'result' && validation && (
        <>
          <div
            className={`${styles.result} ${
              validation.matches === 'yes'     ? styles.resultYes :
              validation.matches === 'partial' ? styles.resultPartial :
                                                 styles.resultNo
            }`}
          >
            <div className={styles.resultHeadline}>
              {validation.matches === 'yes'     && '✓ Match — change confirmed in the JSON'}
              {validation.matches === 'partial' && '⚠ Partial match — review before logging'}
              {validation.matches === 'no'      && '✗ No match — the diff doesn\'t show this change'}
            </div>
            {validation.note && (
              <div className={styles.resultNote}>{validation.note}</div>
            )}
          </div>
          <div className={styles.priorTag}>
            {PRIOR_LABEL[validation.priorSource]}
          </div>
          <div className={`${styles.field} ${styles.fieldGap}`}>
            <span className={styles.fieldLabel}>Reason (editable)</span>
            <textarea
              className={`${styles.textarea} ${styles.textareaShort}`}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why this change?"
            />
          </div>
        </>
      )}

      {phase === 'logging' && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Writing log entry…</span>
        </div>
      )}

      {phase === 'logged' && (
        <div className={`${styles.result} ${styles.resultYes}`}>
          <div className={styles.resultHeadline}>✓ Logged (#{loggedId})</div>
          <div className={styles.resultNote}>
            Your manual change is now part of this agent's history.
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className={styles.errorChip}>{errorMsg || 'Something went wrong.'}</div>
      )}
    </Modal>
  );
}
