/**
 * tableMarkdown tests — round-trip + edge-case coverage for the
 * pure helpers behind the TableEditorModal.
 *
 * Run via vitest if/when it gets added. Today this file is a pure
 * source check — `npx tsc --noEmit` validates it compiles, and the
 * standalone Node runner at the bottom (uncomment to use)
 * exercises the assertions.
 */

import {
  type TableModel,
  markdownToTable,
  parseDelimited,
  rowsToTsv,
  tableToMarkdown,
} from './tableMarkdown';

/* ─── Local assertion shim (no test framework dep) ───────────────── */
type TestFn = () => void;
const tests: Array<{ name: string; fn: TestFn }> = [];
function it(name: string, fn: TestFn) { tests.push({ name, fn }); }
function eq<T>(actual: T, expected: T, msg?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg ?? 'mismatch'}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

/* ─── tableToMarkdown ───────────────────────────────────────────── */

it('tableToMarkdown — emits a basic pipe table without caption', () => {
  const model: TableModel = {
    columns: [{ name: 'a' }, { name: 'b' }],
    rows: [['1', '2'], ['3', '4']],
  };
  const md = tableToMarkdown(model);
  eq(md, '| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |');
});

it('tableToMarkdown — prepends bold caption when set', () => {
  const md = tableToMarkdown({
    caption: 'Plans',
    columns: [{ name: 'plan' }],
    rows: [['basic']],
  });
  eq(md, '**Plans**\n\n| plan |\n| --- |\n| basic |');
});

it('tableToMarkdown — encodes alignment via the separator row', () => {
  const md = tableToMarkdown({
    columns: [
      { name: 'l', align: 'left' },
      { name: 'c', align: 'center' },
      { name: 'r', align: 'right' },
      { name: 'd' },
    ],
    rows: [],
  });
  eq(md.split('\n')[1], '| :--- | :---: | ---: | --- |');
});

it('tableToMarkdown — escapes pipes inside cell text', () => {
  const md = tableToMarkdown({
    columns: [{ name: 'k' }, { name: 'v' }],
    rows: [['weird|key', 'fine']],
  });
  eq(md.split('\n')[2], '| weird\\|key | fine |');
});

it('tableToMarkdown — converts cell newlines to <br>', () => {
  const md = tableToMarkdown({
    columns: [{ name: 'k' }],
    rows: [['line1\nline2']],
  });
  eq(md.split('\n')[2], '| line1<br>line2 |');
});

it('tableToMarkdown — pads short rows so every cell column is present', () => {
  const md = tableToMarkdown({
    columns: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    rows: [['1']],
  });
  eq(md.split('\n')[2], '| 1 |  |  |');
});

/* ─── markdownToTable ───────────────────────────────────────────── */

it('markdownToTable — round-trips a basic table', () => {
  const model: TableModel = {
    columns: [{ name: 'a' }, { name: 'b' }],
    rows: [['1', '2'], ['3', '4']],
  };
  const md = tableToMarkdown(model);
  const parsed = markdownToTable(md);
  eq(parsed?.columns.map(c => c.name), ['a', 'b']);
  eq(parsed?.rows, [['1', '2'], ['3', '4']]);
});

it('markdownToTable — picks up the caption', () => {
  const md = '**Plans**\n\n| a |\n| --- |\n| x |';
  const parsed = markdownToTable(md);
  eq(parsed?.caption, 'Plans');
});

it('markdownToTable — recovers alignment from the separator row', () => {
  const md = '| l | c | r | d |\n| :--- | :---: | ---: | --- |';
  const parsed = markdownToTable(md);
  eq(parsed?.columns.map(c => c.align ?? null), ['left', 'center', 'right', null]);
});

it('markdownToTable — returns null for non-table input', () => {
  eq(markdownToTable('just prose'), null);
  eq(markdownToTable(''), null);
});

it('markdownToTable — unescapes pipes in cell text', () => {
  const md = '| k | v |\n| --- | --- |\n| weird\\|key | fine |';
  const parsed = markdownToTable(md);
  eq(parsed?.rows[0], ['weird|key', 'fine']);
});

it('markdownToTable — converts <br> back to newlines in cells', () => {
  const md = '| k |\n| --- |\n| line1<br>line2 |';
  const parsed = markdownToTable(md);
  eq(parsed?.rows[0][0], 'line1\nline2');
});

/* ─── parseDelimited ────────────────────────────────────────────── */

it('parseDelimited — splits TSV (tabs win when both present)', () => {
  const grid = parseDelimited('a\tb\tc\n1\t2\t3');
  eq(grid, [['a', 'b', 'c'], ['1', '2', '3']]);
});

it('parseDelimited — splits CSV when no tabs present', () => {
  const grid = parseDelimited('a,b,c\n1,2,3');
  eq(grid, [['a', 'b', 'c'], ['1', '2', '3']]);
});

it('parseDelimited — handles quoted fields with embedded commas', () => {
  const grid = parseDelimited('a,"b,c",d');
  eq(grid, [['a', 'b,c', 'd']]);
});

it('parseDelimited — handles escaped quotes ("") inside a quoted field', () => {
  const grid = parseDelimited('a,"he said ""hi""",b');
  eq(grid, [['a', 'he said "hi"', 'b']]);
});

it('parseDelimited — strips trailing all-empty rows from terminal newlines', () => {
  const grid = parseDelimited('a,b\n1,2\n');
  eq(grid, [['a', 'b'], ['1', '2']]);
});

it('parseDelimited — returns null on empty input', () => {
  eq(parseDelimited(''), null);
  eq(parseDelimited('   '), null);
});

/* ─── rowsToTsv ─────────────────────────────────────────────────── */

it('rowsToTsv — concatenates rows tab-separated, newline-rowed', () => {
  eq(rowsToTsv([['a', 'b'], ['1', '2']]), 'a\tb\n1\t2');
});

it('rowsToTsv — quotes cells containing tabs / newlines / quotes', () => {
  eq(
    rowsToTsv([['plain', 'has\ttab', 'has\nnewline', 'has"quote']]),
    'plain\t"has\ttab"\t"has\nnewline"\t"has""quote"',
  );
});

/* ─── Runner (top-level — runs on import for local sanity, no-op
       in production because no module imports this file) ─────────── */

let pass = 0;
let fail = 0;
for (const t of tests) {
  try { t.fn(); pass += 1; }
  catch (err) {
    fail += 1;
    // eslint-disable-next-line no-console
    console.error(`✗ ${t.name}: ${(err as Error).message}`);
  }
}
// eslint-disable-next-line no-console
console.log(`tableMarkdown: ${pass} passed, ${fail} failed`);

// Force this to be a module so `import` semantics work.
export {};
