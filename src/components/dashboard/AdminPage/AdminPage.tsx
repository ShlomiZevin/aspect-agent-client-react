import type { ReactNode } from 'react';
import styles from './AdminPage.module.css';

interface AdminPageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons/controls shown on the right of the title. */
  actions?: ReactNode;
}

/** Title + subtitle on the left, actions on the right — the same on every admin page. */
export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

interface AdminPageProps extends Partial<AdminPageHeaderProps> {
  /** The page's own class, for its internal layout only — never width or padding. */
  className?: string;
  children: ReactNode;
}

/**
 * The frame for a document-style admin page (see AdminPage.module.css). Full
 * workspace tools (Crew Editor, Playground, task boards) don't use it — they
 * fill the whole content area edge to edge on purpose.
 */
export function AdminPage({ title, subtitle, actions, className, children }: AdminPageProps) {
  return (
    <div className={className ? `${styles.page} ${className}` : styles.page}>
      {title && <AdminPageHeader title={title} subtitle={subtitle} actions={actions} />}
      {children}
    </div>
  );
}
