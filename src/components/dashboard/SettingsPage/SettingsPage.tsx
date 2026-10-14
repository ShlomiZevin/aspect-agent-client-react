import { useState, useEffect, useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { ApiKeysPage } from '../ApiKeysPage';
import { AdminPage, adminUi, useUrlTab } from '../AdminPage';
import styles from './SettingsPage.module.css';

interface Props {
  baseURL?: string;
  agentName: string;
}

function NotificationsTab({ baseURL = '', agentName }: Props) {
  const [emails, setEmails] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${baseURL}/api/admin/agents/${agentName}/settings`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw: string = data.contactEmail || '';
      setEmails(raw ? raw.split(',').map((e: string) => e.trim()).filter(Boolean) : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [baseURL, agentName]);

  useEffect(() => { load(); }, [load]);

  const addEmail = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed || emails.includes(trimmed)) return;
    setEmails(prev => [...prev, trimmed]);
  };

  const removeEmail = (index: number) => {
    setEmails(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(inputValue);
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      setEmails(prev => prev.slice(0, -1));
    }
  };

  const handleBlur = () => {
    setFocused(false);
    if (inputValue.trim()) {
      addEmail(inputValue);
      setInputValue('');
    }
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`${baseURL}/api/admin/agents/${agentName}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactEmail: emails.join(',') }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>Error notification recipients</p>
      <p className={styles.cardDesc}>
        When a chat error occurs, an email is sent to all addresses listed here.
        Leave empty to disable notifications for this agent.
      </p>

      <div
        className={`${styles.tagInput} ${focused ? styles.tagInputFocused : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email, i) => (
          <span key={email} className={styles.tag}>
            {email}
            <button className={styles.tagRemove} onClick={() => removeEmail(i)} type="button">×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className={styles.tagTextInput}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={emails.length === 0 ? 'Add email address…' : ''}
          type="email"
        />
      </div>
      <p className={styles.hint}>Press Enter or comma to add. Click × to remove.</p>

      <div className={styles.actions}>
        <button className={styles.saveBtn} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className={styles.savedMsg}>Saved</span>}
        {error && <span className={styles.errorMsg}>{error}</span>}
      </div>
    </div>
  );
}

// The data-loader Schedule used to be a third tab here; it now lives in the
// Data Loader itself (DataLoaderPage > Schedule).
const TABS = ['api-keys', 'notifications'] as const;

export function SettingsPage({ baseURL = '', agentName }: Props) {
  const [tab, setTab] = useUrlTab(TABS);

  return (
    <AdminPage title="Settings" subtitle="Agent configuration and notification settings.">
      <div className={adminUi.tabs}>
        <button
          className={`${adminUi.tab} ${tab === 'api-keys' ? adminUi.tabActive : ''}`}
          onClick={() => setTab('api-keys')}
        >
          API Keys
        </button>
        <button
          className={`${adminUi.tab} ${tab === 'notifications' ? adminUi.tabActive : ''}`}
          onClick={() => setTab('notifications')}
        >
          Notifications
        </button>
      </div>

      {tab === 'api-keys' && <ApiKeysPage baseURL={baseURL} embedded />}
      {tab === 'notifications' && <NotificationsTab baseURL={baseURL} agentName={agentName} />}
    </AdminPage>
  );
}
