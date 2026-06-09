/**
 * Text-direction helpers — shared across prompt editors and the
 * task-board surfaces.
 *
 * The Hebrew Unicode block U+0590–U+05FF covers letters + niqqud +
 * punctuation that any Hebrew-typing user will produce. We don't try
 * to detect every RTL script (Arabic etc.) because the product is
 * scoped to Hebrew + English today; extend the regex when that
 * changes.
 *
 * Two predicates because they answer different questions:
 *   - `containsHebrew` — "is there ANY Hebrew here" (cheap, used by
 *     short labels like task titles where one Hebrew character
 *     usually means the whole label is Hebrew).
 *   - `isMostlyHebrew`  — "is more than half of the alpha content
 *     Hebrew" (used by free-form text — prompts, comments — where
 *     mixed English+Hebrew is common and we only want to flip
 *     direction when Hebrew dominates).
 */

const HEBREW_RANGE = /[֐-׿]/;
const HEBREW_LETTERS_G = /[֐-׿]/g;
// Latin letters only — digits and punctuation aren't a useful signal
// for choosing between LTR and RTL text direction.
const LATIN_LETTERS_G = /[A-Za-z]/g;

export function containsHebrew(text: string): boolean {
  return HEBREW_RANGE.test(text);
}

export function isMostlyHebrew(text: string): boolean {
  if (!text) return false;
  const hebrew = text.match(HEBREW_LETTERS_G)?.length ?? 0;
  if (hebrew === 0) return false;
  const latin  = text.match(LATIN_LETTERS_G)?.length ?? 0;
  return hebrew > latin;
}

/** Convenience: "rtl" when text is mostly Hebrew, else "ltr". Use as
 *  a `dir` attribute on an input/textarea so the browser handles
 *  caret behavior, alignment, and bidi resolution. */
export function autoDir(text: string): 'rtl' | 'ltr' {
  return isMostlyHebrew(text) ? 'rtl' : 'ltr';
}
