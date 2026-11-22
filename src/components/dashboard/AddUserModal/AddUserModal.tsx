import { useState } from 'react';
import { createUser } from '../../../services/adminService';
import type { AdminUser, AutoSuspendHours, CreateUserPayload, UserRole, UserSubscription } from '../../../types/admin';
import styles from './AddUserModal.module.css';

interface AddUserModalProps {
  baseURL: string;
  /** Tenant the new user is created under (always supplied from URL context). */
  tenant?: string;
  onClose: () => void;
  onUserAdded: (user: AdminUser) => void;
}

export function AddUserModal({ baseURL, tenant, onClose, onUserAdded }: AddUserModalProps) {
  const [formData, setFormData] = useState<CreateUserPayload>({
    phone: '',
    name: '',
    email: '',
    subscription: 'demo',
    role: 'user',
  });
  // Auto-suspend (#1002): the user is suspended by itself this long after
  // creation. 48 h by default; Off is one pick away.
  const [autoSuspendHours, setAutoSuspendHours] = useState<AutoSuspendHours>(48);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof CreateUserPayload, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreateUserPayload = {
        phone: formData.phone.trim(),
        name: formData.name.trim(),
        email: formData.email?.trim() || undefined,
        tenant: tenant || undefined,
        subscription: formData.subscription,
        role: formData.role,
        autoSuspendHours,
      };

      const newUser = await createUser(payload, baseURL);
      onUserAdded({ ...newUser, conversationCount: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Add User</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>
              Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder="User's name"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Phone Number <span className={styles.required}>*</span>
            </label>
            <input
              type="tel"
              className={styles.input}
              placeholder="e.g., 972501234567"
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
            />
            <span className={styles.hint}>Used as the user's login password</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              className={styles.input}
              placeholder="user@example.com"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Subscription</label>
              <select
                className={styles.select}
                value={formData.subscription}
                onChange={e => handleChange('subscription', e.target.value as UserSubscription)}
              >
                <option value="demo">Demo</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Role</label>
              <select
                className={styles.select}
                value={formData.role}
                onChange={e => handleChange('role', e.target.value as UserRole)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="add-user-auto-suspend">Auto-suspend</label>
            <select
              id="add-user-auto-suspend"
              className={styles.select}
              value={autoSuspendHours === null ? '' : String(autoSuspendHours)}
              onChange={e => setAutoSuspendHours(e.target.value === '' ? null : (Number(e.target.value) as 24 | 48))}
              title="The user is suspended automatically when the time is up — they can't chat, nothing is deleted"
            >
              <option value="">Off</option>
              <option value="24">After 24 h</option>
              <option value="48">After 48 h</option>
            </select>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
