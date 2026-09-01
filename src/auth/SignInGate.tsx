import type { ReactNode } from 'react';
import { SignInScreen } from './SignInScreen';
import { useSession } from './useSession';

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
  children: (signedInAs: { name: string; email: string } | null) => ReactNode;
}

export function SignInGate({ tenant, agentName, children }: Props) {
  const { session, config, loading, needsSignIn, signIn } = useSession(tenant);

  // Nothing is rendered while the answer is unknown. Showing the surface first
  // and the sign-in screen a moment later would flash the very content the gate
  // exists to withhold.
  if (loading) return null;

  if (needsSignIn && config) {
    return (
      <SignInScreen
        tenant={tenant}
        agentName={agentName}
        config={config}
        onSignedIn={signIn}
      />
    );
  }

  return <>{children(session ? { name: session.name, email: session.email } : null)}</>;
}
