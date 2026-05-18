import { useState, type FormEvent } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { UsersPage } from '../components/dashboard/UsersPage';
import { UserConversationsPage } from '../components/dashboard/UserConversationsPage';
import {
  isSuperAdminUnlocked,
  unlockSuperAdmin,
  lockSuperAdmin,
} from '../services/superAdminService';
import { getBaseURL } from '../services/api';
import { useDocumentMeta } from '../hooks';
import styles from './SuperAdminUsersPage.module.css';

// basePath is the parent that the inner pages append `/users/...` to.
// For super admin we're already at the root `/users` route, so the parent
// is the site root (empty string). Navigation becomes:
//   list → "/users"      conv → "/users/<id>"      msg → "/users/<id>/conversations/<convId>"
const SUPER_ADMIN_BASE_PATH = '';

function CodeGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (unlockSuperAdmin(code.trim())) {
      onUnlocked();
    } else {
      setError('Wrong code');
      setCode('');
    }
  };

  return (
    <div className={styles.gate}>
      <form className={styles.gateCard} onSubmit={handleSubmit}>
        <h1 className={styles.gateTitle}>Restricted</h1>
        <input
          type="password"
          className={styles.gateInput}
          value={code}
          onChange={e => { setCode(e.target.value); setError(null); }}
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          placeholder="Code"
        />
        {error && <div className={styles.gateError}>{error}</div>}
        <button type="submit" className={styles.gateSubmit}>Unlock</button>
      </form>
    </div>
  );
}

function SuperAdminContent() {
  const [unlocked, setUnlocked] = useState(isSuperAdminUnlocked());

  useDocumentMeta({ title: 'All users (super admin)' });

  if (!unlocked) {
    return <CodeGate onUnlocked={() => setUnlocked(true)} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <span className={styles.modeBadge}>SUPER ADMIN — ALL TENANTS</span>
        <button
          className={styles.lockBtn}
          onClick={() => { lockSuperAdmin(); setUnlocked(false); }}
        >
          Lock
        </button>
      </div>
      <div className={styles.content}>
        <Routes>
          <Route
            index
            element={<UsersPage baseURL={getBaseURL()} superAdmin basePath={SUPER_ADMIN_BASE_PATH} />}
          />
          <Route
            path=":userId"
            element={<UserConversationsPage baseURL={getBaseURL()} basePath={SUPER_ADMIN_BASE_PATH} />}
          />
          <Route
            path=":userId/conversations/:conversationId"
            element={<UserConversationsPage baseURL={getBaseURL()} basePath={SUPER_ADMIN_BASE_PATH} />}
          />
        </Routes>
      </div>
    </div>
  );
}

export function SuperAdminUsersPage() {
  return (
    <ThemeProvider>
      <SuperAdminContent />
    </ThemeProvider>
  );
}
