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
export const STEP_SCRIPT = [
  { labelKey: 'intel.step.understand', descKey: 'intel.step.understand.desc' },
  { labelKey: 'intel.step.read', descKey: 'intel.step.read.desc' },
  { labelKey: 'intel.step.patterns', descKey: 'intel.step.patterns.desc' },
  { labelKey: 'intel.step.doubleCheck', descKey: 'intel.step.doubleCheck.desc' },
  { labelKey: 'intel.step.write', descKey: 'intel.step.write.desc' },
];

export type StepState = 'done' | 'active' | 'pending';

export function stepStatus(progress: number, index: number): StepState {
  const threshold = (index + 1) * (100 / STEP_SCRIPT.length);
  const prevThreshold = index * (100 / STEP_SCRIPT.length);
  if (progress >= threshold) return 'done';
  if (progress >= prevThreshold) return 'active';
  return 'pending';
}

export function currentStepIndex(progress: number): number {
  return STEP_SCRIPT.findIndex((_, i) => stepStatus(progress, i) !== 'done');
}
