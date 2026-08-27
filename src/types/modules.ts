/**
 * Aspect Modules — client types.
 *
 * Mirrors the server's `describe()` shape in
 * aspect-agent-server/modules/services/module.service.js. Kept by hand (the
 * builder's generated-type sync is Builder-V2-specific), so a server-side
 * shape change means editing this file too.
 */

/** Every user-facing string a module descriptor carries is bilingual. */
export interface LocalizedText {
  en: string;
  he: string;
}

export type ModuleStatus =
  | 'not_initialized'
  | 'initializing'
  | 'ready'
  | 'failed'
  | 'degraded';

/** Where a resolved setting value came from — drives the "you set this / default" badge. */
export type SettingSource = 'module' | 'platform' | 'code' | null;

export interface ModuleSettingField {
  key: string;
  type?: 'number' | 'text' | 'boolean' | 'model' | 'emails';
  required?: boolean;
  default?: unknown;
  label: LocalizedText;
  hint?: LocalizedText;
}

/** One module, as the admin tab renders it. */
export interface ClientModule {
  id: string;
  name: LocalizedText;
  version: number;
  settingsSchema: ModuleSettingField[];
  notificationEvents: string[];

  /** The human on/off switch. Independent of `status`. */
  enabled: boolean;
  /** Owned by the init pipeline. Independent of `enabled`. */
  status: ModuleStatus;
  /** enabled AND status === 'ready'. The ONLY thing that makes surfaces appear. */
  live: boolean;

  settings: Record<string, unknown>;
  settingsSources: Record<string, SettingSource>;
  /** Required settings with no value at any level — init refuses while non-empty. */
  missingRequired: string[];

  binding: unknown | null;
  initModel: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface ModuleProbe {
  probe: string;
  passed: boolean;
  /** Carries the actual numbers, e.g. "61.9% < 95% threshold" — not just a flag. */
  detail?: string;
}

export interface ModuleRound {
  round: number;
  passed: boolean;
  probes: ModuleProbe[];
  binding: unknown;
  failedProbes: string[];
}

export interface ModuleRunReport {
  outcome?: 'ready' | 'failed';
  roundsUsed?: number;
  probesPassed?: number;
  reason?: string;
  failedProbesByRound?: { round: number; failed: string[] }[];
  audit?: unknown;
  log?: string[];
}

export interface ModuleRun {
  id: number;
  datasetId: string;
  moduleId: string;
  kind: 'init' | 'nightly' | 'verify';
  status: 'running' | 'succeeded' | 'failed';
  progressStage: string | null;
  rounds: ModuleRound[] | null;
  report: ModuleRunReport | null;
  startedAt: string;
  finishedAt: string | null;
}

/**
 * Computed server-side, never stored. `percent` is monotonic by construction
 * — see module-init.service.js stepIndex().
 */
export interface ModuleProgress {
  round: number;
  stage: string;
  label: string;
  percent: number;
}

export interface ModuleRunResponse {
  run: ModuleRun | null;
  progress?: ModuleProgress;
}
