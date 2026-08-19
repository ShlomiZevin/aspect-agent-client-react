/**
 * How a piece of knowledge names its origin.
 *
 * Read from the source joined onto the atom, never sniffed from its URL — a
 * Drive file was showing "Open in Notion" because that label was hardcoded and
 * nothing on the atom said otherwise. Where something came from is part of
 * what it is, so it travels with it from the database.
 */

import type { Atom } from './types';

export interface SourceFace {
  icon: string;
  name: string;
  /** Label for the "open the original" link. */
  open: string;
}

const FACES: Record<string, SourceFace> = {
  notion:       { icon: '🗂', name: 'Notion',       open: 'Open in Notion' },
  google_drive: { icon: '📁', name: 'Google Drive', open: 'Open in Drive' },
  meet:         { icon: '🎥', name: 'Google Meet',  open: 'Open recording' },
};

export function sourceOf(atom: Atom): SourceFace {
  const known = atom.source_kind ? FACES[atom.source_kind] : null;
  if (known) return known;

  // One-off drops and hand-typed notes have no connector behind them.
  if (atom.external_url) return { icon: '🔗', name: 'A link', open: 'Open the original' };
  return { icon: '✎', name: 'Typed into HQ', open: '' };
}
