/**
 * The management center's page registry (task #985). The side menu and the
 * routes are both built from this list — a new page is one entry here plus
 * its component. No placeholders: an entry is a real page. Every page
 * exists in every scope (all agents / one agent).
 */

import type { ComponentType } from 'react';
import { CustomerProblemsPage } from './pages/CustomerProblemsPage/CustomerProblemsPage';
import { IconAlert } from './icons';
import { COPY } from './copy';
import type { ManageMe } from '../types/manage';

export interface ManagePageProps {
  /** 'agent' = /manage/<slug> · 'all' = /manage/all (every-agent grant only). */
  scope: 'agent' | 'all';
  /** The agent of a per-agent page; null on "all". */
  agentSlug: string | null;
  /** Who is signed in — `me.all` = the Lybi team (sees the Builder links). */
  me: ManageMe;
}

export interface ManagePageDef {
  /** Path under /manage/<scope>/ */
  path: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  Component: ComponentType<ManagePageProps>;
}

export const MANAGE_PAGES: ManagePageDef[] = [
  { path: 'customer-problems', label: COPY.problemsMenu, Icon: IconAlert, Component: CustomerProblemsPage },
];
