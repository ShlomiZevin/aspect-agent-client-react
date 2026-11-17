/**
 * Base direction per text: anything with Hebrew in it reads right-to-left, and
 * is isolated (CSS unicode-bidi: isolate) so English words inside it stay in
 * place. First-strong-character detection (unicode-bidi: plaintext) would flip
 * Hebrew lines that open with an English word ("Claude: Sonnet 5.5 … מאושרים")
 * to left-to-right and scramble them.
 */
export function textDir(text: string): 'rtl' | 'ltr' {
  return /[֐-׿]/.test(text) ? 'rtl' : 'ltr';
}
