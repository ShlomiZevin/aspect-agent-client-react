/** Small header/menu glyphs for the sign-in control. Stroke follows currentColor. */

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function PersonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/** A laptop and a phone — "your history on every device", not a refresh symbol. */
export function DevicesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <rect x="2" y="4" width="14" height="9" rx="1" />
      <path d="M1 17h16" />
      <rect x="16" y="10" width="6" height="11" rx="1" />
    </svg>
  );
}

export function CaretIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" {...stroke} strokeWidth={2.5}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
