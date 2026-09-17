/**
 * Folder drafts — the handover point between an AI assistant running on
 * the user's own machine and the Builder.
 *
 * The assistant never touches the database. It reads an agent over the
 * API, writes its changes to `drafts/<slug>.json` in a folder on this
 * computer, and the Builder loads that file into the working copy for
 * review. Nothing becomes real until the user presses Save, which is
 * what makes the whole arrangement safe to hand to someone non-technical:
 * the worst outcome is a draft they decline to save.
 *
 * ── The file ───────────────────────────────────────────────────────
 *
 *   { "_meta": { agentSlug, pulledFromVersion, pulledAt }, "doc": { ... } }
 *
 * `doc` is the projects endpoint's response VERBATIM — the same
 * `ProjectDoc` the Builder already holds. Deliberately not a bespoke
 * shape: the assistant fetches it, edits it in place, and we load it
 * straight back, so there is no transformation to get wrong at either
 * end. `_meta` is what lets the Builder say which version the draft came
 * from rather than presenting it as if it were current.
 *
 * ── Why the handle is remembered ───────────────────────────────────
 *
 * A directory handle survives a reload if it is kept in IndexedDB, but
 * the permission does not — the browser re-asks. Both are handled here,
 * so the user picks their folder once rather than on every visit.
 *
 * Chromium-only (File System Access). `isSupported()` gates the UI, and
 * everything else in the Builder works exactly as before without it.
 */

import type { ProjectDoc } from '../types';

const DB_NAME    = 'builder-folder-drafts';
const STORE      = 'handles';
const HANDLE_KEY = 'draftsFolder';
const DRAFTS_DIR = 'drafts';

export interface DraftMeta {
  agentSlug?: string;
  pulledFromVersion?: number;
  pulledAt?: string;
}

export interface FolderDraft {
  meta: DraftMeta;
  doc: ProjectDoc;
}

/** Feature detection — the caller hides the entire feature when false. */
export function isSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

// ── Remembering the folder ──────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut(value: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  const out = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror   = () => reject(req.error);
  });
  db.close();
  return out;
}

/**
 * Re-establish permission on a remembered handle. The handle survives a
 * reload; the grant does not, so this may show the browser's own prompt.
 */
async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

/** Ask the user for their folder and remember it for next time. */
export async function chooseFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!window.showDirectoryPicker) return null;
  // `startIn: 'documents'` is what makes the path knowable. A page can
  // never read an absolute path from a directory handle, so instead of
  // trying to discover where the folder is, we steer where it gets made
  // — then the prompt can state the location with confidence.
  // `id` makes the browser reopen in the same place on later visits.
  const handle = await window.showDirectoryPicker({
    id: 'lybi-drafts', mode: 'readwrite', startIn: 'documents',
  });
  await idbPut(handle);
  return handle;
}

/**
 * The remembered folder, or null when there is none or permission was
 * declined. Never prompts for a NEW folder — that is `chooseFolder`.
 */
export async function rememberedFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await idbGet();
    if (!handle) return null;
    return (await ensurePermission(handle)) ? handle : null;
  } catch {
    return null;
  }
}

// ── Reading and writing drafts ──────────────────────────────────────

function looksLikeProjectDoc(value: unknown): value is ProjectDoc {
  if (!value || typeof value !== 'object') return false;
  const d = value as Partial<ProjectDoc>;
  return typeof d.id === 'string' && Array.isArray(d.agents);
}

/**
 * Read `drafts/<slug>.json`. Returns null when there is simply no draft
 * for this agent — the common case, and not an error.
 *
 * A file that exists but is malformed DOES throw: silently ignoring it
 * would leave the user staring at an unchanged screen wondering why
 * their assistant's work vanished.
 */
export async function readDraft(
  folder: FileSystemDirectoryHandle,
  agentSlug: string,
): Promise<FolderDraft | null> {
  let text: string;
  try {
    const dir  = await folder.getDirectoryHandle(DRAFTS_DIR);
    const file = await dir.getFileHandle(`${agentSlug}.json`);
    text = await (await file.getFile()).text();
  } catch {
    return null; // no drafts folder, or no draft for this agent
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`drafts/${agentSlug}.json is not valid JSON — the file may still be being written.`);
  }

  const wrapper = parsed as { _meta?: DraftMeta; doc?: unknown };
  const doc = wrapper?.doc;
  if (!looksLikeProjectDoc(doc)) {
    throw new Error(
      `drafts/${agentSlug}.json does not hold an agent. Expected { "_meta": ..., "doc": ... } where doc is what the projects endpoint returned.`,
    );
  }

  return { meta: wrapper._meta || {}, doc };
}

/**
 * Write the current working copy out for the assistant to edit.
 *
 * The round trip matters: without this the assistant is either editing
 * blind or the user is copy-pasting JSON by hand.
 */
export async function writeDraft(
  folder: FileSystemDirectoryHandle,
  agentSlug: string,
  doc: ProjectDoc,
  version?: number,
): Promise<void> {
  const dir  = await folder.getDirectoryHandle(DRAFTS_DIR, { create: true });
  const file = await dir.getFileHandle(`${agentSlug}.json`, { create: true });
  const body = {
    _meta: {
      agentSlug,
      pulledFromVersion: version,
      pulledAt: new Date().toISOString(),
    },
    doc,
  };
  const stream = await file.createWritable();
  await stream.write(JSON.stringify(body, null, 2));
  await stream.close();
}

// ── The reference bundle ────────────────────────────────────────────

/**
 * Where the stamp lives. Beside `config.json`, so everything the machine
 * needs is in one place the user never has to open.
 */
const LYBI_DIR    = '.lybi';
const STAMP_FILE  = 'bundle.json';

export interface BundleFile { path: string; content: string }

/** Walk/create a nested path, returning the directory handle for it. */
async function dirFor(root: FileSystemDirectoryHandle, segments: string[]): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const seg of segments) dir = await dir.getDirectoryHandle(seg, { create: true });
  return dir;
}

async function writeFileAt(
  root: FileSystemDirectoryHandle,
  relPath: string,
  content: string,
): Promise<void> {
  const parts = relPath.split('/').filter(Boolean);
  const name  = parts.pop();
  if (!name) return;
  const dir    = await dirFor(root, parts);
  const handle = await dir.getFileHandle(name, { create: true });
  const stream = await handle.createWritable();
  await stream.write(content);
  await stream.close();
}

/**
 * Write files into the user's folder, keeping their paths.
 *
 * Every `path` is FOLDER-RELATIVE and complete — this adds no prefix of
 * its own. That is deliberate: the caller mixes platform source (which
 * must keep its repo path, because the instructions file refers to files
 * by exactly those names) with things that belong at the folder root.
 * A prefix applied here would force callers to escape it with `..`, and
 * `..` is not a parent reference in the File System Access API — it is an
 * invalid directory name that throws.
 *
 * `onProgress` exists because this is ~80 files — silence for several
 * seconds reads as a hang.
 */
export async function writeBundle(
  folder: FileSystemDirectoryHandle,
  files: BundleFile[],
  version: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let done = 0;
  for (const f of files) {
    await writeFileAt(folder, f.path, f.content);
    done += 1;
    onProgress?.(done, files.length);
  }
  // Stamp LAST: a half-written bundle must never look current. If the
  // writes above fail partway, there is simply no stamp and the Builder
  // reports the copy as out of date, which is the truth.
  await writeFileAt(
    folder,
    `${LYBI_DIR}/${STAMP_FILE}`,
    JSON.stringify({ version, writtenAt: new Date().toISOString(), fileCount: files.length }, null, 2),
  );
}

/**
 * Remove the folder's draft for one agent.
 *
 * Required by Reset, not merely tidy: Reset wipes the local draft and
 * hard-reloads the page. If the folder copy survived that, the Builder
 * would read it straight back in on the next mount and resurrect exactly
 * the work Reset was asked to destroy.
 *
 * A missing file is success — the caller wants it gone, and it is.
 */
export async function deleteDraft(
  folder: FileSystemDirectoryHandle,
  agentSlug: string,
): Promise<void> {
  try {
    const dir = await folder.getDirectoryHandle(DRAFTS_DIR);
    await (dir as unknown as {
      removeEntry: (name: string) => Promise<void>;
    }).removeEntry(`${agentSlug}.json`);
  } catch {
    /* no drafts folder, no such file, or permission withdrawn */
  }
}

/**
 * When `drafts/<slug>.json` was last written, or null when there is none.
 *
 * Metadata only. This is polled while the Builder is open, so it must not
 * read or parse the file — `getFile()` hands back `lastModified` without
 * touching the contents, whereas `.text()` would pull a few hundred KB
 * every few seconds to answer a question about a timestamp.
 */
export async function draftModifiedAt(
  folder: FileSystemDirectoryHandle,
  agentSlug: string,
): Promise<number | null> {
  try {
    const dir  = await folder.getDirectoryHandle(DRAFTS_DIR);
    const file = await dir.getFileHandle(`${agentSlug}.json`);
    return (await file.getFile()).lastModified;
  } catch {
    return null;
  }
}

/** The version currently on disk, or null when there is no bundle. */
export async function readBundleVersion(folder: FileSystemDirectoryHandle): Promise<string | null> {
  try {
    const dir  = await folder.getDirectoryHandle(LYBI_DIR);
    const file = await dir.getFileHandle(STAMP_FILE);
    const text = await (await file.getFile()).text();
    const v = (JSON.parse(text) as { version?: string }).version;
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}
