import { useState, useEffect, useCallback } from 'react';
import { getUsers, getStats, getTenants, updateUser } from '../../../services/adminService';
import type { AdminUser, AdminUserFilters, AdminStats, UserSource, UserSubscription } from '../../../types/admin';
import { AddUserModal } from '../AddUserModal';
import { LinkWhatsAppModal } from '../LinkWhatsAppModal';
import styles from './UsersPage.module.css';

interface UsersPageProps {
  baseURL: string;
}

export function UsersPage({ baseURL }: UsersPageProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tenants, setTenants] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [filters, setFilters] = useState<AdminUserFilters>({});
  const [searchText, setSearchText] = useState('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [linkModalUser, setLinkModalUser] = useState<AdminUser | null>(null);

  // Editing state
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersResponse, statsResponse, tenantsResponse] = await Promise.all([
        getUsers({ ...filters, search: searchText || undefined }, baseURL),
        getStats(baseURL),
        getTenants(baseURL),
      ]);
      setUsers(usersResponse.users);
      setTotal(usersResponse.total);
      setStats(statsResponse);
      setTenants(tenantsResponse);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [baseURL, filters, searchText]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Handle filter change
  const handleFilterChange = (key: keyof AdminUserFilters, value: string | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
  };

  // Handle inline edit
  const startEdit = (user: AdminUser, field: string) => {
    setEditingCell({ id: user.id, field });
    setEditValue((user[field as keyof AdminUser] as string) || '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    try {
      const updated = await updateUser(
        editingCell.id,
        { [editingCell.field]: editValue || null },
        baseURL
      );
      setUsers(prev => prev.map(u => (u.id === updated.id ? { ...u, ...updated } : u)));
      cancelEdit();
    } catch (err) {
      console.error('Error updating user:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Handle user added
  const handleUserAdded = (newUser: AdminUser) => {
    setUsers(prev => [newUser, ...prev]);
    setTotal(prev => prev + 1);
    setShowAddModal(false);
  };

  // Handle WhatsApp linked
  const handleWhatsAppLinked = (updatedUser: AdminUser) => {
    setUsers(prev => prev.map(u => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u)));
    setLinkModalUser(null);
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Render editable cell
  const renderEditableCell = (user: AdminUser, field: string, value: string | null, options?: string[]) => {
    const isEditing = editingCell?.id === user.id && editingCell?.field === field;

    if (isEditing) {
      if (options) {
        return (
          <select
            className={styles.editSelect}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
          >
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      return (
        <input
          type="text"
          className={styles.editInput}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      );
    }

    return (
      <span
        className={styles.editableValue}
        onClick={() => startEdit(user, field)}
        title="Click to edit"
      >
        {value || '-'}
      </span>
    );
  };

  if (isLoading && users.length === 0) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        Loading users...
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>Users</h1>
            <p className={styles.subtitle}>Manage and configure platform users</p>
          </div>
          <button className={styles.addButton} onClick={() => setShowAddModal(true)}>
            + Add User
          </button>
        </div>

        {stats && (
          <div className={styles.statsBar}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.totalUsers}</span>
              <span className={styles.statLabel}>Total Users</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.webUsers}</span>
              <span className={styles.statLabel}>Web</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.whatsappUsers}</span>
              <span className={styles.statLabel}>WhatsApp</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.proUsers}</span>
              <span className={styles.statLabel}>Pro</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.totalConversations}</span>
              <span className={styles.statLabel}>Conversations</span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.filters}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by phone, email, name, or ID..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />

        <select
          className={styles.filterSelect}
          value={filters.source || ''}
          onChange={e => handleFilterChange('source', e.target.value as UserSource)}
        >
          <option value="">All Sources</option>
          <option value="web">Web</option>
          <option value="whatsapp">WhatsApp</option>
        </select>

        <select
          className={styles.filterSelect}
          value={filters.subscription || ''}
          onChange={e => handleFilterChange('subscription', e.target.value as UserSubscription)}
        >
          <option value="">All Subscriptions</option>
          <option value="demo">Demo</option>
          <option value="pro">Pro</option>
        </select>

        <select
          className={styles.filterSelect}
          value={filters.tenant || ''}
          onChange={e => handleFilterChange('tenant', e.target.value)}
        >
          <option value="">All Tenants</option>
          {tenants.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {(searchText || filters.source || filters.subscription || filters.tenant) && (
          <button
            className={styles.clearButton}
            onClick={() => {
              setSearchText('');
              setFilters({});
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Source</th>
              <th>External ID</th>
              <th>Phone</th>
              <th>Name</th>
              <th>Role</th>
              <th>Subscription</th>
              <th>Tenant</th>
              <th>Conversations</th>
              <th>Created</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <span className={`${styles.badge} ${styles[user.source]}`}>
                    {user.source}
                  </span>
                </td>
                <td className={styles.externalId} title={user.externalId}>
                  {user.externalId.length > 20
                    ? `${user.externalId.slice(0, 20)}...`
                    : user.externalId}
                </td>
                <td>{renderEditableCell(user, 'phone', user.phone)}</td>
                <td>{renderEditableCell(user, 'name', user.name)}</td>
                <td>{renderEditableCell(user, 'role', user.role, ['user', 'admin'])}</td>
                <td>{renderEditableCell(user, 'subscription', user.subscription, ['demo', 'pro'])}</td>
                <td>{renderEditableCell(user, 'tenant', user.tenant)}</td>
                <td className={styles.centered}>{user.conversationCount}</td>
                <td>{formatDate(user.createdAt)}</td>
                <td>{formatDate(user.lastActiveAt)}</td>
                <td>
                  <div className={styles.actions}>
                    {user.source === 'web' && !user.whatsappConversationId && (
                      <button
                        className={styles.actionButton}
                        onClick={() => setLinkModalUser(user)}
                        title="Link WhatsApp"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                        </svg>
                      </button>
                    )}
                    {user.whatsappConversationId && (
                      <span className={styles.linkedBadge} title="WhatsApp linked">
                        WA
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className={styles.empty}>
            <p>No users found matching your filters.</p>
            {(searchText || filters.source || filters.subscription || filters.tenant) && (
              <button
                className={styles.clearFiltersButton}
                onClick={() => {
                  setSearchText('');
                  setFilters({});
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.pagination}>
        <span className={styles.totalCount}>
          Showing {users.length} of {total} users
        </span>
      </div>

      {showAddModal && (
        <AddUserModal
          baseURL={baseURL}
          onClose={() => setShowAddModal(false)}
          onUserAdded={handleUserAdded}
        />
      )}

      {linkModalUser && (
        <LinkWhatsAppModal
          baseURL={baseURL}
          user={linkModalUser}
          onClose={() => setLinkModalUser(null)}
          onLinked={handleWhatsAppLinked}
        />
      )}
    </div>
  );
}
