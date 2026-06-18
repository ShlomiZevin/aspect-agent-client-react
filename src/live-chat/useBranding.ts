import { useCallback, useState } from 'react';
import {
  loadActiveBrand, saveActiveBrand, loadPresets, savePresets,
  newBrandId, freshDefaultBrand, type Brand,
} from './branding';

export interface UseBranding {
  brand: Brand;
  presets: Brand[];
  update: (patch: Partial<Brand>) => void;
  savePreset: (name: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  reset: () => void;
}

/** Branding state: a live "working" brand (applied + persisted) plus a
 *  list of named presets. All client-side localStorage, no server. */
export function useBranding(): UseBranding {
  const [brand, setBrand] = useState<Brand>(loadActiveBrand);
  const [presets, setPresets] = useState<Brand[]>(loadPresets);

  const update = useCallback((patch: Partial<Brand>) => {
    setBrand(prev => {
      const next = { ...prev, ...patch, colors: { ...prev.colors, ...(patch.colors ?? {}) } };
      saveActiveBrand(next);
      return next;
    });
  }, []);

  const savePreset = useCallback((name: string) => {
    setBrand(curr => {
      setPresets(prev => {
        // Upsert by preset name so re-saving updates in place.
        const existing = prev.find(p => p.presetName === name);
        const snapshot: Brand = { ...curr, id: existing?.id ?? newBrandId(), presetName: name };
        const next = existing
          ? prev.map(p => (p.id === existing.id ? snapshot : p))
          : [...prev, snapshot];
        savePresets(next);
        return next;
      });
      const applied = { ...curr, presetName: name };
      saveActiveBrand(applied);
      return applied;
    });
  }, []);

  const loadPreset = useCallback((id: string) => {
    setPresets(prev => {
      const found = prev.find(p => p.id === id);
      if (found) {
        const applied = { ...found };
        setBrand(applied);
        saveActiveBrand(applied);
      }
      return prev;
    });
  }, []);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => {
      const next = prev.filter(p => p.id !== id);
      savePresets(next);
      return next;
    });
  }, []);

  // Restore the built-in system look — the escape hatch for reverting
  // unsaved edits when there's no preset to fall back to.
  const reset = useCallback(() => {
    const def = freshDefaultBrand();
    setBrand(def);
    saveActiveBrand(def);
  }, []);

  return { brand, presets, update, savePreset, loadPreset, deletePreset, reset };
}
