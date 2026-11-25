/** Lybi Gate's menu icon — a shield with a gate line, drawn like src/manage/icons.tsx (stroke = currentColor). */

export function IconGate({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5l7 2.6v5.2c0 4.3-2.9 7.8-7 9.2-4.1-1.4-7-4.9-7-9.2V6.1z" />
      <path d="M9.2 9.5v6M14.8 9.5v6M9.2 12.5h5.6" />
    </svg>
  );
}
