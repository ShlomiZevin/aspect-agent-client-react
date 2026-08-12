/**
 * Client-side formula validation — mirrors the server's fences in
 * `aspect-agent-server/builder/runtime/formulaEval.js` so authors get
 * the same plain-language error at edit time (on blur) instead of at
 * runtime. The syntax check compiles with `new Function` (never
 * executes) after substituting `{{field}}` tokens with a dummy value.
 */

const FORBIDDEN: { re: RegExp; msg: string }[] = [
  { re: /\b(for|while|do)\b/,            msg: "loops aren't allowed — a formula is a single expression" },
  { re: /\b(function|class)\b/,          msg: "defining functions isn't allowed in a formula" },
  { re: /=>/,                            msg: "arrow functions aren't allowed in a formula" },
  { re: /\b(var|let|const|return)\b/,    msg: 'statements aren\'t allowed — write a single expression' },
  { re: /\b(require|process|globalThis|eval|Function|import)\b/, msg: "that isn't available in formulas" },
  { re: /;/,                             msg: 'a formula is a single expression — remove the ";"' },
  { re: /(^|[^=!<>+\-*/%&|^])=(?![=])/,  msg: 'assignment "=" isn\'t allowed — use "==" to compare' },
];

const TOKEN_RE = /\{\{\s*[A-Za-z0-9_.-]+\s*\}\}/g;

/** Returns a plain-language problem, or null when the formula is OK. */
export function lintFormula(expr: string): string | null {
  const text = (expr ?? '').trim();
  if (!text) return null; // empty is "not filled in yet", not an error to shout about
  for (const f of FORBIDDEN) {
    if (f.re.test(text)) return f.msg;
  }
  const substituted = text.replace(TOKEN_RE, '1');
  try {
    // Compile only — never executed.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(`return ( ${substituted} )`);
  } catch (e) {
    return `not valid JavaScript — ${(e as Error).message}`;
  }
  return null;
}
