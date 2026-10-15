import type { AppIcon as AppIconName } from '../../../types/apps';

/**
 * The app glyphs, drawn from the design's own paths.
 *
 * Inline rather than an icon font or sprite: there are a handful, they never change
 * independently of this page, and a missing glyph would show a client an empty
 * square. The `size` and stroke come from the mockup at both sizes it uses —
 * 32px on the shelf, 19px in the page header.
 */
const PATHS: Record<AppIconName, React.ReactNode> = {
  procurement: (
    <>
      <path d="M6 6h15l-1.5 8.5H7.6L5.2 3H2" />
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="18" cy="20" r="1.6" />
    </>
  ),
  warehouse: (
    <>
      <path d="M3 9l9-6 9 6v11H3z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  branches: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V7l4-4h6l4 4v14" />
      <path d="M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1" />
    </>
  ),
  pricing: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />,
  // A statement: a sheet of paper with its lines and a total rule.
  finance: (
    <>
      <path d="M6 3h12v18H6z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
};

export function AppGlyph({ icon, size = 32, color = '#ffffff' }: {
  icon: AppIconName;
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[icon]}
    </svg>
  );
}
