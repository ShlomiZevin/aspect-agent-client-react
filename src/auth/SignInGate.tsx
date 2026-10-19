import type { ReactNode } from 'react';
import { SignInScreen } from './SignInScreen';
import { useSession } from './useSession';
import type { SignInConfig } from './api';

/**
 * Puts a sign-in screen in front of a surface, but only where the Sign-In
 * module is switched on for that client.
 *
 * Where it is off, this renders its children and nothing else happens — which
 * is what makes it safe to wrap surfaces that most clients reach without any
 * sign-in at all.
 *
 * `children` is a function so the signed-in person can be handed down. A
 * surface that has been gated should use that identity rather than asking for a
 * name again, which is the whole point of gating it.
 */
interface Props {
  tenant: string;
  agentName: string;
  /**
   * Closed to anonymous visitors whatever the module says — the Intelligence
   * Center (task #113). Without it the gate follows the module's `purpose`.
   */
  required?: boolean;
  children: (signedInAs: { name: string; email: string } | null) => ReactNode;
}

// Used when the config cannot be fetched on a `required` gate: it stays shut
// and offers the password form rather than falling open.
const FALLBACK: SignInConfig = { enabled: true, purpose: 'gate', google: false, password: true, clientId: '' };

export function SignInGate({ tenant, agentName, required = false, children }: Props) {
  const { session, config, loading, needsSignIn, signIn } = useSession(tenant);

  // Nothing is rendered while the answer is unknown. Showing the surface first
  // and the sign-in screen a moment later would flash the very content the gate
  // exists to withhold.
  if (loading) return null;

  if (required ? !session : needsSignIn && config) {
    return (
      <SignInScreen
        tenant={tenant}
        agentName={agentName}
        config={config ?? FALLBACK}
        onSignedIn={signIn}
      />
    );
  }

  return <>{children(session ? { name: session.name, email: session.email } : null)}</>;
}
