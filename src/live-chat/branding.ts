/**
 * Branding model + localStorage persistence (client-only, no server).
 *
 * A "brand" bundles the agent's display name, logo (data URL) and a
 * three-colour palette that re-themes the whole Live surface. Brands can
 * be saved as named presets and reloaded. The currently-applied brand is
 * persisted separately so a reload keeps the look.
 */

export interface BrandColors {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface Brand {
  id: string;
  /** Preset label (what the user types when saving). */
  presetName: string;
  /** Agent display name (shown in the brand mark when there's no logo). */
  agentName: string;
  /** Logo as a data URL, or null to fall back to the client/Lybi logo. */
  logo: string | null;
  colors: BrandColors;
}

export const DEFAULT_COLORS: BrandColors = {
  primary: '#E0198A',
  secondary: '#8A2290',
  tertiary: '#5B1E8A',
};

/** The built-in "system" look. Starts empty (no name / no logo) so the
 *  branding editor shows nothing until the user configures something —
 *  also the target of the Reset button. */
export const DEFAULT_BRAND: Brand = {
  id: 'default',
  presetName: '',
  agentName: '',
  logo: null,
  colors: { ...DEFAULT_COLORS },
};

export function freshDefaultBrand(): Brand {
  return { id: 'default', presetName: '', agentName: '', logo: null, colors: { ...DEFAULT_COLORS } };
}

const PRESETS_KEY = 'lybi-live:brands';
const ACTIVE_KEY = 'lybi-live:activeBrand';

export function newBrandId(): string {
  return `brand_${Math.random().toString(36).slice(2, 9)}`;
}

export function gradientOf(c: BrandColors): string {
  return `linear-gradient(135deg, ${c.primary} 0%, ${c.secondary} 55%, ${c.tertiary} 100%)`;
}

/** CSS custom properties to spread onto the `.lybi-chat` root. */
export function brandCssVars(c: BrandColors): Record<string, string> {
  return {
    '--mag': c.primary,
    '--pur2': c.secondary,
    '--pur': c.tertiary,
    '--grad': gradientOf(c),
  };
}

/** A loose `#rgb` / `#rrggbb` validator for the hex inputs. */
export function isHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

export function loadPresets(): Brand[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? (JSON.parse(raw) as Brand[]) : [];
  } catch {
    return [];
  }
}

export function savePresets(list: Brand[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    // ignore (quota / private mode)
  }
}

export function loadActiveBrand(): Brand {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return { ...DEFAULT_BRAND };
    return { ...DEFAULT_BRAND, ...(JSON.parse(raw) as Partial<Brand>) };
  } catch {
    return { ...DEFAULT_BRAND };
  }
}

export function saveActiveBrand(brand: Brand): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(brand));
  } catch {
    // ignore
  }
}
