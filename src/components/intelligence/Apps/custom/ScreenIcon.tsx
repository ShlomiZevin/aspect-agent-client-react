/**
 * Icons for custom screens — Otto's own closed set (the server validates
 * against the same list in spec.contract.js). Line icons, one stroke
 * weight, no emoji — carried over from v1, which got this part right.
 */

const PATHS: Record<string, string> = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  box: 'M3 8l9-4 9 4v8l-9 4-9-4zM3 8l9 4 9-4M12 12v8',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM17.5 19a2 2 0 100-4 2 2 0 000 4z',
  tag: 'M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01',
  alert: 'M12 3l9 16H3zM12 10v4M12 17h.01',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
};

export const SCREEN_ICONS = Object.keys(PATHS);

export function ScreenIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] || PATHS.grid} />
    </svg>
  );
}
