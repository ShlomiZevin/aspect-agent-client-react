/**
 * FromCrewSelect — the "from which crew" half of an `On crew transition`
 * trigger (#921). Empty = a transition out of any crew (the old behaviour);
 * a crew = only when the conversation leaves THAT crew. Shared by offline
 * add-ons, Profiler panels and Live Brain panels. "To which crew" may join
 * later; today any target counts.
 */

import { useBuilder } from '../../state/BuilderContext';
import type { ID } from '../../types';

export function FromCrewSelect({ value, onChange, className }: {
  value: ID | null | undefined;
  onChange: (crewId: ID | null) => void;
  className?: string;
}) {
  const { doc } = useBuilder();
  const crews = doc.agents[0]?.crews ?? [];
  const missing = !!value && !crews.some(c => c.id === value);
  return (
    <select className={className} value={value ?? ''} onChange={e => onChange(e.target.value || null)}
      title="Fire only when the conversation leaves this crew" aria-label="From crew">
      <option value="">From any crew</option>
      {crews.map(c => <option key={c.id} value={c.id}>From {c.name || 'Untitled crew'}</option>)}
      {missing && <option value={value}>From a deleted crew</option>}
    </select>
  );
}
