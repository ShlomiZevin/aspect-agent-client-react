import { useCallback, useEffect, useState } from 'react';
import { authApi } from '../api';
import type { Invitation } from '../api';
import styles from './SignInAccounts.module.css';

/**
 * Who may sign in to this agent — the accounts side of the Sign-In module,
 * shown as a section on the Users admin page (there is no separate page).
 *
 * An account here is permission to sign in, not a user: the platform user row
 * appears the first time the person actually signs in. Add an address, choose
 * whether it also gets a password (Google-only otherwise), and it can sign in
 * from then on. Revoking stops it even mid-session.
 *
 * Rendered by the dashboard, which has no LanguageProvider — English only, like
 * the rest of the admin.
 */
interface Props {
  tenant: string;
}

export function SignInAccounts({ tenant }: Props) {
  const [rows, setRows] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [note, setNote] = useState('');
  const [withPassword, setWithPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // The generated password is shown here once and never again — the server
  // keeps only the hash — so it sits in a persistent banner, not a toast.
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
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
      .then((list) => { if (!cancelled) setRows(list); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenant]);

  const add = async (e: React.FormEvent) => {
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
      setWithPassword(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const newPassword = async (row: Invitation) => {
    setError(null);
    try {
      const res = await authApi.setPassword(row.id, {});
      if (res.password) setIssued({ email: row.email, password: res.password });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const revoke = async (row: Invitation) => {
    setError(null);
    try {
      await authApi.revoke(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.title}>Sign-in accounts</h2>
        <p className={styles.sub}>
          Addresses that may sign in to <strong>{tenant}</strong>, with Google or — if you
          give one — a password. A platform user appears when they first sign in.
        </p>
      </header>

      {issued && (
        <div className={styles.issued}>
          <span>
            <strong>{issued.email}</strong> — password{' '}
            <code className={styles.code}>{issued.password}</code>
          </span>
          <span className={styles.issuedNote}>Shown once — copy it now.</span>
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

      <form className={styles.addRow} onSubmit={add}>
        <input
          className={styles.input}
          type="email"
          value={email}
          placeholder="name@company.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className={styles.select}
          value={role}
          onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <input
          className={styles.input}
          value={note}
          placeholder="Name or note (optional)"
          onChange={(e) => setNote(e.target.value)}
        />
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={withPassword}
            onChange={(e) => setWithPassword(e.target.checked)}
          />
          Give a password
        </label>
        <button type="submit" className={styles.primary} disabled={busy || !email.trim()}>
          {busy ? 'Adding…' : 'Add account'}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>No accounts yet — add an address above.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Email</th>
              <th className={styles.th}>Role</th>
              <th className={styles.th}>Scope</th>
              <th className={styles.th}>Password</th>
              <th className={styles.th}>Note</th>
              <th className={styles.th}>Added</th>
              <th className={styles.th} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.revokedAt ? styles.revoked : undefined}>
                <td className={styles.td}>{row.email}</td>
                <td className={styles.td}>
                  <span className={`${styles.chip} ${row.role === 'admin' ? styles.admin : ''}`}>
                    {row.role}
                  </span>
                </td>
                <td className={styles.td}>
                  {/* A grant with no tenant works on every agent — say so plainly,
                      since revoking it here affects all of them. */}
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
                      <button type="button" className={styles.link} onClick={() => newPassword(row)}>
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
    </section>
  );
}
