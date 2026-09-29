/**
 * Notes & files on a Targeted KB (task #871) — the author's knowledge map:
 * where each piece of knowledge came from, what overlaps with what.
 *
 * NEVER sent to the running agent. Stored outside the agent's versioned
 * body, so typing here saves on its own and never makes the agent
 * "unsaved". Alfred and outside assistants can read it.
 */

import { useEffect, useRef, useState } from 'react';
import { getTkbExtras, saveTkbNotes } from '../../state/builderApi';
import { SpecFiles } from '../SpecModal/SpecFiles';

interface Props {
  agentId: string;
  enumId: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function TkbNotes({ agentId, enumId }: Props) {
  const [notes, setNotes] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const savedRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    getTkbExtras(agentId, enumId)
      .then(x => { if (!cancelled) { setNotes(x.notes); savedRef.current = x.notes; } })
      .catch(() => { if (!cancelled) { setNotes(''); setState('error'); } });
    return () => { cancelled = true; };
  }, [agentId, enumId]);

  // Saves itself a moment after typing stops — one request per pause.
  useEffect(() => {
    if (notes === null || notes === savedRef.current) return;
    const id = window.setTimeout(() => {
      setState('saving');
      saveTkbNotes(agentId, enumId, notes)
        .then(() => { savedRef.current = notes; setState('saved'); })
        .catch(() => setState('error'));
    }, 800);
    return () => window.clearTimeout(id);
  }, [agentId, enumId, notes]);

  const status = state === 'saving' ? 'Saving…'
    : state === 'saved' ? 'Saved'
      : state === 'error' ? 'Could not save — check the connection'
        : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: '#6b7280',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>📝 Notes &amp; files</span>
        <span style={{ flex: 1, fontSize: 11.5, color: '#9ca3af' }}>
          For you and your AI — never sent to the agent
        </span>
        {/* Fixed width so the status appearing never moves the title. */}
        <span style={{
          minWidth: 60, textAlign: 'right', fontSize: 11.5, fontWeight: 600,
          color: state === 'error' ? '#dc2626' : '#9ca3af',
        }} role="status" aria-live="polite">{status}</span>
      </div>
      <textarea
        value={notes ?? ''}
        disabled={notes === null}
        onChange={e => setNotes(e.target.value)}
        placeholder="Where this knowledge came from, what overlaps with other KBs, what's still missing…"
        rows={6}
        style={{
          padding: '9px 11px', border: '1px solid #e5e7eb', borderRadius: 8,
          fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.55, color: '#374151',
          resize: 'vertical', background: notes === null ? '#f9fafb' : '#fff',
        }}
      />
      <SpecFiles agentId={agentId} enumId={enumId} />
    </div>
  );
}
