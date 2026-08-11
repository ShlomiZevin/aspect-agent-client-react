/**
 * The 5-step script shown while a report is being built — shared between the
 * in-process sidebar (JobSidebar, design turn 4b) and the Home page's inline
 * "report in progress" card (design turn 10a) so both always describe the
 * same steps. Kept dataset-agnostic (no "stock"/"inventory" wording) since
 * this product spans several datasets, not just Hyper Toy — see project
 * memory "Aspect BI generalization".
 */
// Translation keys, not literal text — see i18n/translations.ts 'intel.step.*'.
// Both consumers (JobSidebar's side panel, HomePage's inline progress card)
// call useLanguage().t() on these at render time.
// Order matches the REAL server pipeline (plan -> query -> aggregate ->
// synthesize -> verify). "Write" and "Double-check" used to be listed the
// other way round, which described a pipeline that doesn't exist: the model
// writes the finding first, and an independent pass fact-checks it afterwards.
export const STEP_SCRIPT = [
  { labelKey: 'intel.step.understand', descKey: 'intel.step.understand.desc', stage: 'plan' },
  { labelKey: 'intel.step.read', descKey: 'intel.step.read.desc', stage: 'query' },
  { labelKey: 'intel.step.patterns', descKey: 'intel.step.patterns.desc', stage: 'aggregate' },
  { labelKey: 'intel.step.write', descKey: 'intel.step.write.desc', stage: 'synthesize' },
  { labelKey: 'intel.step.doubleCheck', descKey: 'intel.step.doubleCheck.desc', stage: 'verify' },
];

export type StepState = 'done' | 'active' | 'pending';

const STAGE_INDEX: Record<string, number> = Object.fromEntries(STEP_SCRIPT.map((s, i) => [s.stage, i]));

/**
 * Which step is running right now. Prefers the REAL server-reported stage;
 * falls back to inferring from the percentage only when no stage is available
 * (job resumed after a reload, or an older server revision). Previously this
 * was always inferred from a percentage driven by a hardcoded 8-second timer,
 * so the UI routinely showed the last two steps as complete while the SQL
 * query was still running.
 */
export function activeStepIndex(progress: number, stage?: string): number {
  if (stage && stage in STAGE_INDEX) return STAGE_INDEX[stage];
  if (stage === 'done') return STEP_SCRIPT.length;
  const inferred = STEP_SCRIPT.findIndex((_, i) => progress < (i + 1) * (100 / STEP_SCRIPT.length));
  return inferred === -1 ? STEP_SCRIPT.length - 1 : inferred;
}

export function stepStatus(progress: number, index: number, stage?: string): StepState {
  if (stage === 'done') return 'done';
  const active = activeStepIndex(progress, stage);
  if (index < active) return 'done';
  if (index === active) return 'active';
  return 'pending';
}

export function currentStepIndex(progress: number, stage?: string): number {
  return activeStepIndex(progress, stage);
}
