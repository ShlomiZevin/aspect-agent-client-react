/**
 * Field name validation — shared across every field-name input in the
 * builder (Add field, Declare field, Edit field, Wire-or-create).
 *
 * Why constrain names: field names are JSON keys in extractor output,
 * memory bucket keys, and `{{field:NAME}}` token segments. Allowing
 * arbitrary characters lets the runtime drift on small mistakes — a
 * field declared as `Motive Signals` round-trips through a 4o-class
 * model as `motive_signals` (the model "fixes" the name) and the
 * extractor write silently misses the declared slot. Same trap with
 * accented chars / non-Latin alphabets / capital letters.
 *
 * Rule: lowercase a-z, digits, underscores. First char must be a
 * letter or underscore (matches identifier conventions in every
 * downstream consumer — Python, JS, JSON Schema name suggestions).
 *
 * Names are NOT auto-sanitized at submit time — that hides intent.
 * The modal surfaces the error and the user fixes it themselves.
 */

const FIELD_NAME_REGEX = /^[a-z_][a-z0-9_]*$/;
const MAX_LEN = 64;

/**
 * Strip characters that BREAK the toolchain — currently just
 * whitespace. Whitespace splits the `@field:NAME` mention parser
 * (and the `{{field:NAME}}` token resolver) at the first space, so a
 * field named "my name" silently becomes the token `{{field:my}}` —
 * truly broken, no recovery.
 *
 * Other invalid characters (capitals, accents, non-Latin) only
 * confuse the LLM at extraction time; they're handled by the warning
 * surface (`validateFieldName`) and the user can choose to ignore it.
 *
 * Use as an input filter:
 *   <input onChange={e => setName(stripInvalid(e.target.value))} />
 */
export function stripInvalid(raw: string): string {
  return (raw || '').replace(/\s+/g, '');
}

/** Message shown when the user attempted to type a space that we
 *  silently dropped. Surfaces in the same slot as the shape
 *  warning so the user understands their keystroke wasn't ignored
 *  by a broken keyboard — it was intentionally blocked. */
export const SPACE_BLOCKED_MESSAGE =
  'Spaces aren\'t allowed in field names — use underscores instead.';

/** True if the raw input string contains any whitespace that
 *  `stripInvalid` will drop. Callers use this to flag the "tried
 *  to type a space" state and surface SPACE_BLOCKED_MESSAGE. */
export function hadInvalidStripped(raw: string): boolean {
  return /\s/.test(raw || '');
}

export interface FieldNameValidation {
  ok: boolean;
  /** Short human-readable reason when ok=false. Empty when ok=true. */
  reason: string;
}

export function validateFieldName(raw: string): FieldNameValidation {
  const name = (raw || '').trim();
  if (name.length === 0) {
    return { ok: false, reason: 'Field name is required.' };
  }
  if (name.length > MAX_LEN) {
    return { ok: false, reason: `Field name must be ${MAX_LEN} characters or fewer.` };
  }
  if (!FIELD_NAME_REGEX.test(name)) {
    return {
      ok: false,
      reason: 'Lowercase English letters, digits, and underscores only — other characters may break extraction.',
    };
  }
  return { ok: true, reason: '' };
}
