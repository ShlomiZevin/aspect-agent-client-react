/** Build a field id → label map from a dataset model. */
import type { DatasetModel } from '../../types/bi';

export function buildLabels(model: DatasetModel): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const d of model.dimensions) labels[d.id] = d.label;
  for (const m of model.measures) labels[m.id] = m.label;
  return labels;
}
