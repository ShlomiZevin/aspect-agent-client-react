/**
 * The management center's page registry (task #985). The panel's
 * "בתצוגה הזו" menu and the routes are both built from this list — a new
 * page is one entry here plus its component. No placeholders: an entry is
 * a real page. Every page exists in both worlds (all agents / one agent).
 */

import type { ComponentType } from 'react';
import { CustomerProblemsPage } from './pages/CustomerProblemsPage/CustomerProblemsPage';
import { IconPage } from './icons';
import { COPY } from './copy';

export interface ManagePageProps {
  /** 'agent' = /manage/<slug> · 'all' = /manage/all (internal). */
  scope: 'agent' | 'all';
  /** The agent of a per-agent page; null on "all". */
  agentSlug: string | null;
}

export interface ManagePageDef {
  /** Path under /manage/<world>/ */
  path: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  Component: ComponentType<ManagePageProps>;
}

export const MANAGE_PAGES: ManagePageDef[] = [
  { path: 'customer-problems', label: COPY.problemsMenu, Icon: IconPage, Component: CustomerProblemsPage },
];
