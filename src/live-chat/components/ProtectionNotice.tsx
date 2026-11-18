/**
 * ProtectionNotice — what the customer sees when data protection stopped
 * their message (task #986). Design D (data-protection-designs/
 * b2-sunburst.jpg, picked by Shlomi): a warm "a short moment to keep you
 * safe" card with the shield, the agent's own explanation, a reassurance
 * line, and two actions — edit the message (the text is already back in the
 * composer) and the one-tap "blocked by mistake". The mockup's "continue in
 * a secure channel" button is out of scope.
 *
 * The mistake button turns into the thanks line IN PLACE (same box), so
 * nothing moves when it is tapped.
 */

import type { Dict, Lang } from '../i18n';
import type { LiveProtection } from '../useLiveChat';
import { detectorNames } from '../protection';

interface Props {
  protection: LiveProtection;
  t: Dict;
  lang: Lang;
  onEdit: () => void;
  onMistake: () => void;
}

export function ProtectionNotice({ protection, t, lang, onEdit, onMistake }: Props) {
  const names = detectorNames(protection.detectors, lang);
  const canReport = protection.blockId !== null;
  return (
    <div className="protect-card" role="status" aria-live="polite">
      <div className="protect-head">
        <div className="protect-title">
          {t.protectTitle}<HeartIcon />
        </div>
        <ShieldArt />
      </div>

      <p className="protect-msg" dir="auto">{protection.message}</p>
      {names && (
        <p className="protect-detected">
          <span className="protect-detected-label">{t.protectDetected}</span> {names}
        </p>
      )}

      <div className="protect-kept">
        <ShieldCheckIcon />
        <span>{t.protectKept}</span>
      </div>

      <div className="protect-actions">
        <button type="button" className="protect-btn" onClick={onEdit}>
          <PencilIcon />
          <span>{t.protectEdit}</span>
        </button>
        {protection.mistake === 'thanks' ? (
          <div className="protect-btn protect-thanks" aria-live="polite">
            <HeartIcon small />
            <span>{t.protectThanks}</span>
          </div>
        ) : (
          <button
            type="button"
            className="protect-btn"
            onClick={onMistake}
            disabled={!canReport || protection.mistake === 'sending'}
          >
            <FlagIcon />
            <span>{t.protectMistake}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Art (inline SVG, brand colours from the chat's own tokens) ───────

function ShieldArt() {
  return (
    <svg className="protect-art" viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <linearGradient id="protectShieldFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--protect-soft-1, #EBDDFB)" />
          <stop offset="1" stopColor="var(--protect-soft-2, #C9A9F0)" />
        </linearGradient>
      </defs>
      {/* sparkle strokes */}
      <g stroke="var(--pur2)" strokeWidth="3.2" strokeLinecap="round" opacity=".75">
        <line x1="14" y1="20" x2="21" y2="27" />
        <line x1="26" y1="10" x2="28" y2="19" />
        <line x1="8" y1="34" x2="17" y2="35" />
      </g>
      {/* ring around the shield */}
      <ellipse cx="52" cy="66" rx="34" ry="12" fill="none" stroke="var(--protect-ring, #B48BE6)" strokeWidth="5" opacity=".8" />
      <path
        d="M52 14 L76 23 V45 C76 61 66 73 52 79 C38 73 28 61 28 45 V23 Z"
        fill="url(#protectShieldFill)"
        stroke="var(--pur2)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* lock */}
      <rect x="43" y="43" width="18" height="15" rx="3.5" fill="#fff" stroke="var(--pur)" strokeWidth="2" />
      <path d="M46.5 43 V38.5 A5.5 5.5 0 0 1 57.5 38.5 V43" fill="none" stroke="var(--pur)" strokeWidth="2.2" />
      <circle cx="52" cy="50.5" r="1.9" fill="var(--pur)" />
    </svg>
  );
}

function HeartIcon({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? 'protect-heart small' : 'protect-heart'} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.5 1.1 4.8 2.8 1.3-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg className="protect-kept-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 19.5 5.3V11c0 5-3.2 8.6-7.5 10.5C7.7 19.6 4.5 16 4.5 11V5.3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m8.5 11.8 2.4 2.4 4.6-4.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="protect-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg className="protect-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
