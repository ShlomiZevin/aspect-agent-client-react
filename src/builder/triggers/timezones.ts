/**
 * The timezone list, taken from the browser rather than hardcoded.
 *
 * `Intl.supportedValuesOf('timeZone')` is the runtime's own IANA list —
 * always current, no dependency, and nothing for us to maintain when the
 * tz database changes (which it does, several times a year: zones get
 * added, renamed and retired). A hand-written list would be wrong within
 * a year and nobody would notice until a customer got nudged at 3am.
 *
 * Two guarantees the raw call doesn't give you:
 *
 *  - **A saved value always appears.** If an agent was configured with a
 *    zone this browser doesn't list (an older engine, or a zone since
 *    renamed), it is added rather than dropped — otherwise the select
 *    would quietly re-point the trigger at whatever happened to be first.
 *  - **A fallback.** On an engine without `supportedValuesOf`, a short
 *    list of common zones keeps the control usable instead of empty.
 */

/** Enough to keep the control working on an engine without the Intl API. */
const FALLBACK = [
  'UTC',
  'Asia/Jerusalem',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

type SupportedValuesOf = (key: 'timeZone') => string[];

function allZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: SupportedValuesOf };
  try {
    const zones = intl.supportedValuesOf?.('timeZone');
    if (Array.isArray(zones) && zones.length > 0) return zones;
  } catch { /* fall through */ }
  return FALLBACK;
}

/** The viewer's own zone — offered first, since it's usually the answer. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Zones grouped by region for `<optgroup>`, with `current` guaranteed to
 * be present.
 *
 * Grouped because a flat list of ~400 entries is a scroll, not a choice.
 * The region prefix ("Europe", "Asia") is the first thing anyone knows
 * about their own zone.
 */
export function groupedTimezones(current?: string): { region: string; zones: string[] }[] {
  const zones = new Set(allZones());
  if (current) zones.add(current);

  const byRegion = new Map<string, string[]>();
  for (const zone of Array.from(zones).sort()) {
    // "Europe/Paris" → "Europe"; bare zones like "UTC" get their own slot.
    const region = zone.includes('/') ? zone.slice(0, zone.indexOf('/')) : 'Other';
    const list = byRegion.get(region);
    if (list) list.push(zone);
    else byRegion.set(region, [zone]);
  }

  return Array.from(byRegion.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, list]) => ({ region, zones: list }));
}

/** "Europe/Paris" → "Paris"; the group header already says the region. */
export function shortZoneLabel(zone: string): string {
  const tail = zone.includes('/') ? zone.slice(zone.indexOf('/') + 1) : zone;
  return tail.replace(/_/g, ' ');
}
