/**
 * Per-message text-direction detection — ported from V1's
 * `Message.tsx` so a Hebrew message right-aligns and an English
 * message left-aligns *regardless* of the UI language.
 *
 * Rule: look at the first real letter of the string; if it's in the
 * Hebrew / Arabic / Syriac ranges the message is RTL.
 */

const RTL_RE = /[֐-׿؀-ۿ܀-ݏ]/;

export function isRTL(text: string): boolean {
  const firstLetter = text.match(/\p{L}/u);
  return firstLetter ? RTL_RE.test(firstLetter[0]) : false;
}

export function msgDir(text: string): 'rtl' | 'ltr' {
  return isRTL(text) ? 'rtl' : 'ltr';
}
