interface Props {
  message: string | null;
}

/** Bottom-center toast. Render with a message to show; null to hide. */
export function Toast({ message }: Props) {
  return (
    <div className={`toast ${message ? 'show' : ''}`}>
      <span className="td" />
      <span>{message ?? ''}</span>
    </div>
  );
}
