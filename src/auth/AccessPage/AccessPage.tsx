import { useCallback, useEffect, useState } from 'react';
import { authApi } from '../api';
import type { Invitation } from '../api';
import styles from './AccessPage.module.css';

/**
 * Who may sign in to this client, and how.
 *
 * Access is given ahead of time, one address at a time, which is how Shlomi
 * asked for it. Inviting someone does not create a user — that happens when
 * they first sign in — so this list is people who are allowed, not people who
 * have been.
 */
interface Props {
  tenant: string;
}

export function AccessPage({ tenant }: Props) {
  const [rows, setRows] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [note, setNote] = useState('');
  const [withPassword, setWithPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // Shown once, right after it is generated. The server stores only the hash,
  // so this is the single moment anyone can read it — which is why it sits in
  // its own banner rather than a toast that slides away.
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows(await authApi.listInvitations(tenant));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [tenant]);

  useEffect(() => {
    let cancelled = false;
    authApi.listInvitations(tenant)
      .then(list => { if (!cancelled) setRows(list); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenant]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.invite({
        email: email.trim(),
        tenant,
        role,
        note: note.trim() || undefined,
        generatePassword: withPassword,
      });
      if (res.password) setIssued({ email: res.allowed.email, password: res.password });
      setEmail('');
      setNote('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (row: Invitation) => {
    setError(null);
    try {
      const res = await authApi.setPassword(row.id, {});
      if (res.password) setIssued({ email: row.email, password: res.password });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const revoke = async (row: Invitation) => {
    setError(null);
    try {
      await authApi.revoke(row.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Access</h2>
      <p className={styles.sub}>
        Who may sign in to <strong>{tenant}</strong>. Someone becomes a user the first time
        they sign in; until then this is an invitation. Requires the Sign-In module to be
        switched on for this client.
      </p>

      {issued && (
        <div className={styles.issued}>
          <div>
            <strong>{issued.email}</strong> — password <code className={styles.code}>{issued.password}</code>
          </div>
          <div className={styles.issuedNote}>
            Shown once. Only the hash is stored, so copy it now.
          </div>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => { void navigator.clipboard.writeText(issued.password); }}
          >
            Copy
          </button>
          <button type="button" className={styles.ghost} onClick={() => setIssued(null)}>Done</button>
        </div>
      )}

      <form className={styles.inviteRow} onSubmit={invite}>
        <input
          className={styles.input}
          type="email"
          value={email}
          placeholder="name@company.com"
          onChange={e => setEmail(e.target.value)}
        />
        <select className={styles.select} value={role} onChange={e => setRole(e.target.value as 'user' | 'admin')}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <input
          className={styles.input}
          value={note}
          placeholder="Name or note (optional)"
          onChange={e => setNote(e.target.value)}
        />
        <label className={styles.checkbox}>
          <input type="checkbox" checked={withPassword} onChange={e => setWithPassword(e.target.checked)} />
          Give a password
        </label>
        <button type="submit" className={styles.primary} disabled={busy || !email.trim()}>
          {busy ? 'Inviting…' : 'Invite'}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? <p className={styles.empty}>Loading…</p> : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Email</th>
              <th className={styles.th}>Role</th>
              <th className={styles.th}>Scope</th>
              <th className={styles.th}>Password</th>
              <th className={styles.th}>Note</th>
              <th className={styles.th}>Invited</th>
              <th className={styles.th} />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className={row.revokedAt ? styles.revoked : undefined}>
                <td className={styles.td}>{row.email}</td>
                <td className={styles.td}>
                  <span className={`${styles.chip} ${row.role === 'admin' ? styles.admin : ''}`}>{row.role}</span>
                </td>
                <td className={styles.td}>
                  {/* A grant with no tenant works on every agent — worth saying
                      plainly, since revoking it here affects all of them. */}
                  {row.tenant ?? <span className={styles.chip}>all agents</span>}
                </td>
                <td className={styles.td}>
                  {row.hasPassword ? 'set' : <span className={styles.muted}>Google only</span>}
                </td>
                <td className={styles.td}>{row.note || <span className={styles.muted}>—</span>}</td>
                <td className={styles.td}>{new Date(row.createdAt).toLocaleDateString()}</td>
                <td className={styles.td}>
                  {row.revokedAt ? (
                    <span className={styles.muted}>revoked</span>
                  ) : (
                    <>
                      <button type="button" className={styles.link} onClick={() => resetPassword(row)}>
                        {row.hasPassword ? 'New password' : 'Give password'}
                      </button>
                      <button type="button" className={styles.linkDanger} onClick={() => revoke(row)}>
                        Revoke
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && rows.length === 0 && (
        <p className={styles.empty}>Nobody has been invited yet.</p>
      )}
    </div>
  );
}
