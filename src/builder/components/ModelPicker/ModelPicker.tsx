/**
 * ModelPicker — provider → model selector backed by the central
 * registry (server-owned, fetched once at app boot). Every dropdown
 * that picks an LLM reads the same list.
 */

import { useMemo } from 'react';
import { useModels } from '../../registry/useModels';
import type { ModelRef } from '../../types';
import styles from './ModelPicker.module.css';

interface Props {
  value: ModelRef;
  onChange: (next: ModelRef) => void;
  /** Optional label rendered above the controls. */
  label?: string;
}

export function ModelPicker({ value, onChange, label }: Props) {
  const { providers, loading, getProvider } = useModels();
  const provider = useMemo(() => getProvider(value.providerId), [value.providerId, getProvider, providers]);

  const handleProvider = (providerId: string) => {
    const next = getProvider(providerId);
    if (!next || next.models.length === 0) return;
    // When provider changes, snap to its first model.
    onChange({ providerId, modelId: next.models[0].id });
  };

  const handleModel = (modelId: string) => {
    onChange({ providerId: value.providerId, modelId });
  };

  if (loading) {
    return (
      <div className={styles.wrap}>
        {label && <span className={styles.label}>{label}</span>}
        <div className={styles.row}>
          <span className={styles.loading}>Loading models…</span>
        </div>
      </div>
    );
  }

  const selectedModel = provider?.models.find(m => m.id === value.modelId);

  return (
    <div className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.row}>
        <select
          className={styles.select}
          value={value.providerId}
          onChange={e => handleProvider(e.target.value)}
        >
          {providers.map(p => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <span className={styles.sep}>›</span>
        <select
          className={styles.select}
          value={value.modelId}
          onChange={e => handleModel(e.target.value)}
        >
          {(provider?.models ?? []).map(m => (
            // Option label is just the model name — clean, never
            // truncates. Notes render as a small caption below the
            // row when this model is selected.
            <option key={m.id} value={m.id} title={m.notes ?? ''}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {selectedModel?.notes && (
        <span className={styles.notes}>{selectedModel.notes}</span>
      )}
    </div>
  );
}
