/* eslint-disable no-console */
/**
 * Sync the canonical Builder V2 TypeScript types from the server into
 * the client source tree.
 *
 * The server owns the file at:
 *   aspect-agent-server/builder/types/index.ts
 *
 * The client gets a mirrored copy at:
 *   aspect-react-client/src/builder/types/index.ts
 *
 * The mirror is gitignored — this script overwrites it. Wired into
 * the client's `postinstall`, `predev`, and `prebuild` npm hooks so
 * the file is always present and current when the client builds.
 *
 * Why server-owned: Alfred's patch generator + the runtime ship the
 * types as part of the Docker image. Cross-folder filesystem reads
 * don't work inside Cloud Run. So the file lives in the server's
 * tree (in the build context) and the client mirrors at build time.
 */

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.resolve(
  __dirname, '..', '..',
  'aspect-agent-server', 'builder', 'types', 'index.ts',
);
const DST = path.resolve(
  __dirname, '..',
  'src', 'builder', 'types', 'index.ts',
);

function fail(msg) {
  console.error(`[sync-builder-types] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(SRC)) {
  // Graceful exit on fresh clone where the server folder might not
  // exist yet (or in CI scenarios where the client is built in
  // isolation). Don't crash `npm install`; just warn loudly.
  console.warn(
    `[sync-builder-types] source not found: ${SRC}\n` +
    '  → leaving any existing client copy in place. ' +
    'Run again once the server folder is present.',
  );
  process.exit(0);
}

fs.mkdirSync(path.dirname(DST), { recursive: true });

const srcContent = fs.readFileSync(SRC, 'utf8');
let dstContent = '';
try { dstContent = fs.readFileSync(DST, 'utf8'); } catch { /* not yet present */ }

if (srcContent === dstContent) {
  console.log('[sync-builder-types] up-to-date');
  process.exit(0);
}

fs.writeFileSync(DST, srcContent);
console.log(`[sync-builder-types] synced → ${path.relative(process.cwd(), DST)}`);
