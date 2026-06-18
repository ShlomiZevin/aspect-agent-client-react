import type { Dict } from '../i18n';

interface Props {
  t: Dict;
  reason: 'missing' | 'no-active';
  slug: string;
  onOpenBuilder: () => void;
}

/**
 * Shown instead of the chat when the agent can't go live yet — detected
 * on load via the builder's own `fetchProject` gate:
 *   - 'missing'   → no builder project for this slug → create it
 *   - 'no-active' → exists but no active version pointer → publish it
 */
export function AgentNotReady({ t, reason, slug, onOpenBuilder }: Props) {
  const missing = reason === 'missing';
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="ge">{missing ? '🚧' : '🚀'}</div>
        <h2>{missing ? t.notReadyMissingTitle : t.notReadyNoActiveTitle}</h2>
        <p>{missing ? t.notReadyMissingSub : t.notReadyNoActiveSub}</p>
        <div className="gate-slug">/{slug}</div>
        <div>
          <button className="btn primary" onClick={onOpenBuilder}>
            {missing ? t.notReadyMissingCta : t.notReadyNoActiveCta}
          </button>
        </div>
      </div>
    </div>
  );
}
