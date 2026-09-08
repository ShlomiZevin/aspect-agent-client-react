import type { Session, SignInConfig } from '../api';
import { SignInMethods } from '../SignInMethods';
import styles from './SignInScreen.module.css';

/**
 * The full-page sign-in gate: shown in front of a surface that a 'gate' client
 * has closed until an invited person signs in. The credential form itself is
 * {@link SignInMethods}, shared with the in-chat dialog; this is only the page
 * around it.
 *
 * Rendered outside a LanguageProvider (the dashboard has none), so it keeps to
 * the English defaults — no `t` is passed down.
 */
interface Props {
  tenant: string;
  agentName: string;
  config: SignInConfig;
  onSignedIn: (session: Session) => void;
}

export function SignInScreen({ tenant, agentName, config, onSignedIn }: Props) {
  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>{agentName}</h1>
        <p className={styles.sub}>Sign in to continue</p>

        <SignInMethods tenant={tenant} config={config} onSignedIn={onSignedIn} />

        <p className={styles.foot}>
          Access is given ahead of time. If you cannot get in, ask whoever set this up
          to add your address.
        </p>
      </div>
    </div>
  );
}
