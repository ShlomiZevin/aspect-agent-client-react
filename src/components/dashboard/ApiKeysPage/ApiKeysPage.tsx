import { useState, useEffect, useCallback } from 'react';
import styles from './ApiKeysPage.module.css';

interface Props {
  baseURL?: string;
}

interface ConfigEntry {
  key: string;
  source: 'db' | 'env' | 'not_set';
  isSet: boolean;
  maskedValue: string | null;
}

const KEY_LABELS: Record<string, string> = {
  openai_api_key: 'OpenAI API Key',
  openai_org_id: 'OpenAI Org ID',
  openai_project_id: 'OpenAI Project ID',
  anthropic_api_key: 'Anthropic API Key',
  anthropic_admin_api_key: 'Anthropic Admin API Key',
  gemini_api_key: 'Gemini API Key',
  gcp_billing_project_id: 'GCP Billing Project ID',
  gcp_billing_dataset: 'GCP Billing Dataset',
  gcp_billing_service_account_json: 'GCP Service Account JSON',
};

const KEY_GROUPS = [
  { label: 'OpenAI', keys: ['openai_api_key', 'openai_org_id', 'openai_project_id'] },
  { label: 'Anthropic', keys: ['anthropic_api_key', 'anthropic_admin_api_key'] },
  { label: 'Google', keys: ['gemini_api_key', 'gcp_billing_project_id', 'gcp_billing_dataset', 'gcp_billing_service_account_json'] },
];

const GROUP_COLOR: Record<string, string> = {
  OpenAI: '#10a37f',
  Anthropic: '#d97706',
  Google: '#4285f4',
};

export function ApiKeysPage({ baseURL = '' }: Props) {
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseURL}/api/admin/provider-config`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfigs(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [baseURL]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (key: string) => {
    setEditingKey(key);
    setEditValue('');
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
    setSaveError(null);
  };

  const save = async (key: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${baseURL}/api/admin/provider-config/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setEditingKey(null);
      setEditValue('');
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteOverride = async (key: string) => {
    if (!confirm(`Remove DB override for "${KEY_LABELS[key] || key}"? Will fall back to env var.`)) return;
    try {
      const res = await fetch(`${baseURL}/api/admin/provider-config/${key}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const configMap = Object.fromEntries(configs.map(c => [c.key, c]));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>API Keys</h1>
          <p className={styles.subtitle}>Override environment variables with database values. Changes take effect immediately.</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className={styles.globalError}>{error}</div>}

      {loading && !configs.length ? (
        <div className={styles.loadingState}>Loading…</div>
      ) : (
        <div className={styles.groups}>
          {KEY_GROUPS.map(group => (
            <div key={group.label} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.groupBadge} style={{ background: GROUP_COLOR[group.label] }}>{group.label}</span>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Source</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {group.keys.map(key => {
                    const entry = configMap[key];
                    const isEditing = editingKey === key;
                    const isJson = key === 'gcp_billing_service_account_json';

                    return (
                      <tr key={key}>
                        <td className={styles.keyName}>{KEY_LABELS[key] || key}</td>
                        <td className={styles.valueCell}>
                          {isEditing ? (
                            <div className={styles.editRow}>
                              {isJson ? (
                                <textarea
                                  className={styles.textarea}
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  placeholder="Paste JSON key contents…"
                                  rows={4}
                                  autoFocus
                                />
                              ) : (
                                <input
                                  className={styles.input}
                                  type="password"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  placeholder="Enter new value…"
                                  autoFocus
                                />
                              )}
                              {saveError && <div className={styles.saveError}>{saveError}</div>}
                              <div className={styles.editActions}>
                                <button className={styles.saveBtn} onClick={() => save(key)} disabled={saving || !editValue.trim()}>
                                  {saving ? 'Saving…' : 'Save'}
                                </button>
                                <button className={styles.cancelBtn} onClick={cancelEdit} disabled={saving}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <span className={styles.maskedValue}>
                              {entry?.maskedValue || <span className={styles.notSet}>not set</span>}
                            </span>
                          )}
                        </td>
                        <td>
                          {entry && (
                            <span className={`${styles.sourceBadge} ${styles[`source_${entry.source}`]}`}>
                              {entry.source === 'db' ? 'DB override' : entry.source === 'env' ? 'env' : 'not set'}
                            </span>
                          )}
                        </td>
                        <td className={styles.actions}>
                          {!isEditing && (
                            <>
                              <button className={styles.editBtn} onClick={() => startEdit(key)}>
                                {entry?.source === 'db' ? 'Update' : 'Set'}
                              </button>
                              {entry?.source === 'db' && (
                                <button className={styles.deleteBtn} onClick={() => deleteOverride(key)}>Reset</button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
