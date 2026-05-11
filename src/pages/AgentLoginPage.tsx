import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { ThemeToggle } from '../components/common';
import { useDocumentMeta, useAgentAuth } from '../hooks';
import { login, authStoragePrefix, getSession } from '../services/agentAuthService';
import { getAgentConfig } from '../agents/agentRegistry';
import { NotFoundPage } from './NotFoundPage';
import styles from './AgentLoginPage.module.css';

interface LoginFormProps {
  agentSlug: string;
  logoSrc: string;
  agentDisplayName: string;
}

function LoginForm({ agentSlug, logoSrc, agentDisplayName }: LoginFormProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAgentAuth(agentSlug);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate(`/${agentSlug}/chat`, { replace: true });
  }, [isAuthenticated, agentSlug, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phone.trim()) {
      setError('יש למלא שם ומספר נייד');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(agentSlug, name.trim(), phone.trim());
      navigate(`/${agentSlug}/chat`, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה';
      setError(msg === 'invalid_credentials' ? 'שם או מספר נייד לא נכונים' : 'שגיאה בכניסה. נסי שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.themeToggleWrap}>
        <ThemeToggle />
      </div>

      <div className={styles.card}>
        <img src={logoSrc} alt={agentDisplayName} className={styles.logo} />
        <h1 className={styles.title}>ברוכים הבאים</h1>
        <p className={styles.subtitle}>{`כניסה ל${agentDisplayName}`}</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>שם פרטי</span>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              dir="auto"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>מספר נייד</span>
            <input
              type="tel"
              className={styles.input}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              dir="ltr"
            />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? 'מתחברת...' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function AgentLoginPage() {
  const { agent } = useParams<{ agent: string }>();
  const config = getAgentConfig(agent);

  useDocumentMeta({
    title: config ? `${config.displayName || config.agentName} - כניסה` : 'כניסה',
    favicon: config?.favicon,
    description: config?.metaDescription,
  });

  if (!config || !agent) return <NotFoundPage />;

  // Skip the form if already authenticated (avoids flash).
  if (typeof window !== 'undefined' && getSession(agent)) {
    return <Navigate to={`/${agent}/chat`} replace />;
  }

  // Use the agent's logo alt text (typically the localized brand name) when present.
  const agentDisplayName = config.logo.alt || config.displayName || config.agentName;

  return (
    <ThemeProvider storagePrefix={authStoragePrefix(agent)}>
      <LoginForm agentSlug={agent} logoSrc={config.logo.src} agentDisplayName={agentDisplayName} />
    </ThemeProvider>
  );
}
