import { useCallback, useEffect, useRef, useState } from 'react';
import { authApi } from '../api';
import type { Invitation } from '../api';
import { intelligenceAdminService } from '../../services/intelligenceAdminService';
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

  // Every project an account can belong to — the Intelligence Center datasets.
  const [projects, setProjects] = useState<string[]>([]);
  useEffect(() => {
    intelligenceAdminService.listDatasets()
      .then(list => setProjects(list.map(d => d.id).sort()))
      .catch(() => { /* the select still offers this project and "all" */ });
  }, []);

  // The row whose password is being set by hand; empty value = generate one.
  const [pwFor, setPwFor] = useState<number | null>(null);
  const [pwValue, setPwValue] = useState('');

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
        // A user name (no @) cannot sign in with Google, so it always gets one.
        generatePassword: withPassword || !email.includes('@'),
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

  const savePassword = async (row: Invitation) => {
    setError(null);
    try {
      // Typed → that password; left empty → the server generates one.
      const res = await authApi.setPassword(row.id, pwValue ? { password: pwValue } : {});
      if (res.password) setIssued({ email: row.email, password: res.password });
      setPwFor(null);
      setPwValue('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const update = async (row: Invitation, body: { role?: 'user' | 'admin'; tenants?: string[] | null }) => {
    setError(null);
    try {
      await authApi.updateAccount(row.id, body);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const projectOptions = Array.from(new Set([tenant, ...projects, ...rows.flatMap(r => r.tenants ?? [])])).sort();

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
          Accounts that may sign in to <strong>{tenant}</strong> — the only way into its
          Intelligence Center and admin. One account can open several projects (Project
          column); adding a login that already exists adds this project to it. An email
          signs in with Google or a password; a user name such as{' '}
          <code>company.aspect.com</code> always gets a password.
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
          type="text"
          value={email}
          autoCapitalize="none"
          placeholder="name@company.com or company.aspect.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className={styles.select}
          value={role}
          onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
        >
          <option value="user">No admin access</option>
          <option value="admin">Admin access</option>
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
              <th className={styles.th}>Admin access</th>
              <th className={styles.th}>Project</th>
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
                  <select
                    className={styles.select}
                    value={row.role}
                    disabled={Boolean(row.revokedAt)}
                    onChange={(e) => update(row, { role: e.target.value as 'user' | 'admin' })}
                  >
                    <option value="user">No</option>
                    <option value="admin">Yes</option>
                  </select>
                </td>
                <td className={styles.td}>
                  <ProjectsPicker
                    value={row.tenants}
                    options={projectOptions}
                    current={tenant}
                    disabled={Boolean(row.revokedAt)}
                    onChange={(tenants) => update(row, { tenants })}
                  />
                </td>
                <td className={styles.td}>
                  {pwFor === row.id ? (
                    <span className={styles.pwEdit}>
                      <input
                        className={styles.input}
                        type="text"
                        autoFocus
                        value={pwValue}
                        placeholder="New password, or empty to generate"
                        onChange={(e) => setPwValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void savePassword(row); if (e.key === 'Escape') setPwFor(null); }}
                      />
                      <button type="button" className={styles.link} onClick={() => savePassword(row)}>Save</button>
                      <button type="button" className={styles.link} onClick={() => setPwFor(null)}>Cancel</button>
                    </span>
                  ) : row.hasPassword ? 'set' : <span className={styles.muted}>Google only</span>}
                </td>
                <td className={styles.td}>{row.note || <span className={styles.muted}>—</span>}</td>
                <td className={styles.td}>{new Date(row.createdAt).toLocaleDateString()}</td>
                <td className={styles.td}>
                  {row.revokedAt ? (
                    <span className={styles.muted}>revoked</span>
                  ) : (
                    <>
                      <button type="button" className={styles.link} onClick={() => { setPwFor(row.id); setPwValue(''); }}>
                        {row.hasPassword ? 'Change password' : 'Give password'}
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

/**
 * Which projects one account opens: "All projects" (us) or any set of them.
 * Saves on every tick. The last ticked project cannot be unticked — an
 * account with no project is a revoke, and that has its own button.
 */
function ProjectsPicker({ value, options, current, disabled, onChange }: {
  value: string[] | null;
  options: string[];
  /** The project whose page this is — what unticking "All" falls back to. */
  current: string;
  disabled: boolean;
  onChange: (tenants: string[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const all = value === null;
  const picked = value ?? [];
  const toggle = (p: string) => {
    const next = picked.includes(p) ? picked.filter(x => x !== p) : [...picked, p];
    if (next.length) onChange(next.sort());
  };

  return (
    <div className={styles.picker} ref={wrap}>
      <button type="button" className={styles.select} disabled={disabled} onClick={() => setOpen(v => !v)}>
        {all ? 'All projects' : picked.join(', ')}
      </button>
      {open && (
        <div className={styles.pickerMenu}>
          <label className={styles.pickerItem}>
            <input type="checkbox" checked={all} onChange={() => onChange(all ? [current] : null)} />
            <strong>All projects</strong>
          </label>
          {options.map(p => (
            <label key={p} className={`${styles.pickerItem} ${all ? styles.muted : ''}`}>
              <input
                type="checkbox"
                checked={all || picked.includes(p)}
                disabled={all || (picked.length === 1 && picked[0] === p)}
                onChange={() => toggle(p)}
              />
              {p}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
