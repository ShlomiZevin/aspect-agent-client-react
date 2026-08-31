import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { TaskBoardPage } from '../TaskBoardPage';

/**
 * Gate for `/:agent/taskboard`.
 *
 * The board is an Aspect Module now, so which clients have it is a decision
 * stored in `client_modules` rather than a route that exists for everyone who
 * knows the URL.
 *
 * The route always RESOLVES — a stale bookmark lands on a sentence, not a blank
 * page or a redirect that loses where you were trying to go. That is the same
 * rule the Purchasing screen follows for the Replenishment module.
 */
type Gate = 'checking' | 'on' | 'off';

export function TaskBoardRoute() {
  const { agent } = useParams<{ agent: string }>();
  const [gate, setGate] = useState<Gate>('checking');

  useEffect(() => {
    // No state set for the missing-agent case: it is a static property of the
    // URL, not something that becomes known later, and setting state from an
    // effect body to express it costs an extra render for no information.
    if (!agent) return;
    let cancelled = false;
    api.isEnabledFor(agent)
      .then(on => { if (!cancelled) setGate(on ? 'on' : 'off'); })
      // A failed check is treated as off. The alternative — showing the board
      // when the server could not be asked — would leak it to a client the
      // module was never switched on for.
      .catch(() => { if (!cancelled) setGate('off'); });
    return () => { cancelled = true; };
  }, [agent]);

  if (agent && gate === 'checking') return null;

  if (!agent || gate === 'off') {
    return (
      <div style={{ padding: '48px 24px', maxWidth: 560, margin: '0 auto', fontSize: 14, lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>Task board is not enabled here</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          It is an optional module. A super-admin can switch it on for{' '}
          <strong>{agent}</strong> from the Modules tab of this agent&apos;s dashboard.
        </p>
      </div>
    );
  }

  return <TaskBoardPage />;
}
