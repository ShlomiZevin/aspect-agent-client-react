/** Bilingual label, as every module descriptor carries. */
export interface Localized {
  en: string;
  he: string;
}

/**
 * Icons the Apps page knows how to draw.
 *
 * A closed set on purpose: the server names the shape, the client owns the
 * artwork, and a new name should fail the build rather than render an empty
 * square in front of a client.
 */
export type AppIcon = 'procurement' | 'warehouse' | 'branches' | 'pricing';

/** The numbers under a live app's icon. Null when the app has none to give. */
export interface AppHeadline {
  orderNow: number;
  dueSoon: number;
  stockedOk: number;
  noDemand: number;
  estimatedTotalExVat: number;
  supplierCount: number;
  dataThrough: string | null;
  /** What the red badge shows. */
  badge: number;
}

export interface AppEntry {
  id: string;
  name: Localized;
  icon: AppIcon;
  blurb: Localized | null;
  /** When the nightly run last rebuilt what this app reads. */
  researchedAt: string | null;
  headline: AppHeadline | null;
}

/** Announced, not built — drawn greyed out, never installable. */
export interface PlannedApp {
  id: string;
  name: Localized;
  icon: AppIcon;
  blurb: Localized | null;
}

export interface AppsResponse {
  datasetId: string;
  apps: AppEntry[];
  planned: PlannedApp[];
  researchedAt: string | null;
}
