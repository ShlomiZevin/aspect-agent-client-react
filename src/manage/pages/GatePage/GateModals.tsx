/**
 * Lybi Gate — the page's windows: a field's action, policy versions, keys,
 * a file upload, a connection, and one record (with "ask the bank" /
 * "hand off"). Every change happens here, never inline (the management
 * center's rule).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  gateApi, GateApiError,
  type GateAction, type GateCallResult, type GateConnection, type GateData, type GateField, type GateKey, type GateRecord, type GateVersion,
} from './gateApi';
import { ACTIONS, ACTION_HE, ACTION_MEANING, CONVERTIBLE, G, TYPE_HE } from './gateCopy';
import { GateModal } from './GateModal';
import { ConfirmModal } from '../../components/ConfirmModal/ConfirmModal';
import { fmtTime, storedText } from './gateFormat';
import c from '../../components/ConfirmModal/ConfirmModal.module.css';
import g from './GatePage.module.css';

const fail = (err: unknown) => (err instanceof GateApiError && err.code === 'no_bank_key' ? G.uploadNoBank : G.failed);

/* ── A field's action ─────────────────────────────────────────────── */

export function FieldModal({ field, onSaved, onClose }: { field: GateField; onSaved: () => void; onClose: () => void }) {
  const [action, setAction] = useState<GateAction>(field.action);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try { await gateApi.updateDraft([{ field: field.field, action }]); onSaved(); } catch (err) { setError(fail(err)); setBusy(false); }
  };
  return (
    <GateModal title={G.fieldTitle(field.field)} sub={<span>{G.fieldDetected}: {TYPE_HE[field.detected] || field.detected}</span>} busy={busy} onClose={onClose}
      footer={<button type="button" className={c.confirm} onClick={save} disabled={busy}>{busy ? G.working : G.save}</button>}>
      <div className={g.choices} role="radiogroup">
        {ACTIONS.map(a => {
          const disabled = a === 'conv' && !CONVERTIBLE.has(field.detected);
          return (
            <label key={a} className={`${g.choice} ${action === a ? g.choiceOn : ''} ${disabled ? g.choiceOff : ''}`}>
              <input type="radio" name="gate-action" checked={action === a} disabled={disabled || busy} onChange={() => setAction(a)} />
              <span className={`${g.pill} ${g[`a_${a}`]}`}>{ACTION_HE[a]}</span>
              <span className={g.choiceText}>{ACTION_MEANING[a]}</span>
            </label>
          );
        })}
      </div>
      <p className={c.error} role="status">{error || ' '}</p>
    </GateModal>
  );
}

/* ── Versions ─────────────────────────────────────────────────────── */

export function VersionsModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<GateVersion[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { gateApi.versions().then(r => setList(r.versions)).catch(() => setError(true)); }, []);
  return (
    <GateModal title={G.versionsTitle} onClose={onClose}>
      {error && <p className={g.muted}>{G.failed}</p>}
      {!list && !error && <p className={g.muted}>{G.working}</p>}
      {list && (
        <table className={g.table}>
          <tbody>
            {list.map(v => (
              <tr key={v.id}>
                <td className={g.cNarrow}><b>{v.version}</b></td>
                <td>{v.status === 'signed' ? G.vSigned : G.vDraft}</td>
                <td>{G.vFields(v.fields.length)}</td>
                <td className={g.muted}>{v.signedBy || '—'}</td>
                <td className={g.muted}>{fmtTime(v.signedAt || v.updatedAt)}</td>
                <td>{v.status === 'signed' && (v.valid ? <span className={`${g.pill} ${g.ok}`}>✓ {G.vValid}</span> : <span className={`${g.pill} ${g.bad}`}>{G.vInvalid}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </GateModal>
  );
}

/* ── Keys ─────────────────────────────────────────────────────────── */

export function KeysModal({ endpoint, onChanged, onClose }: { endpoint: string; onChanged: () => void; onClose: () => void }) {
  const [keys, setKeys] = useState<GateKey[] | null>(null);
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<GateKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<GateKey | null>(null);
  const load = () => gateApi.keys().then(r => setKeys(r.keys)).catch(() => setError(G.failed));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setError(null);
    try { const r = await gateApi.createKey(name.trim()); setFresh(r.key); setName(''); setCopied(false); await load(); onChanged(); } catch { setError(G.failed); }
    setBusy(false);
  };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* no clipboard */ } };
  const curl = `curl -X POST ${endpoint} \\\n  -H "Authorization: Bearer ${fresh?.key || 'gk_live_…'}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"records":[{"leadId":"EW-1","fullName":"…","passportNumber":"…"}]}'`;

  return (
    <GateModal title={G.keysTitle} sub={<span>{G.keysSub}</span>} wide busy={busy} onClose={onClose}>
      <div className={g.endpoint}><span className={g.method}>POST</span><code dir="ltr">{endpoint}</code></div>
      <div className={g.inlineForm}>
        <input className={g.input} value={name} onChange={e => setName(e.target.value)} placeholder={G.keyNamePh} aria-label={G.keyName} maxLength={80} disabled={busy} />
        <button type="button" className={c.confirm} onClick={create} disabled={busy || !name.trim()}>{busy ? G.working : G.createKey}</button>
      </div>
      <div className={g.freshSlot}>
        {fresh?.key && (
          <div className={g.freshKey}>
            <p>{G.keyOnce}</p>
            <div className={g.keyLine}><code dir="ltr">{fresh.key}</code><button type="button" className={g.linkBtn} onClick={() => copy(fresh.key!)}>{copied ? G.copied : G.copy}</button></div>
          </div>
        )}
      </div>
      <p className={c.error} role="status">{error || ' '}</p>
      <table className={g.table}>
        <tbody>
          {keys && keys.length === 0 && <tr><td className={g.muted}>{G.noKeys}</td></tr>}
          {keys?.map(k => (
            <tr key={k.id}>
              <td><b>{k.name}</b></td>
              <td><code dir="ltr">{k.prefix}</code></td>
              <td>{k.active ? <span className={`${g.pill} ${g.ok}`}>{G.keyActive}</span> : <span className={`${g.pill} ${g.grey}`}>{G.keyRevoked}</span>}</td>
              <td className={g.muted}>{k.lastUsedAt ? `${G.keyLastUsed}: ${fmtTime(k.lastUsedAt)}` : G.keyNever}</td>
              <td className={g.cAction}>{k.active && <button type="button" className={g.linkBtnDanger} onClick={() => setRevoking(k)}>{G.revoke}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className={g.example}>
        <summary>{G.example}</summary>
        <pre dir="ltr">{curl}</pre>
      </details>
      {revoking && (
        <ConfirmModal title={G.revokeTitle} body={G.revokeBody(revoking.name)} confirmLabel={G.revoke} danger
          onConfirm={async () => { await gateApi.revokeKey(revoking.id); setRevoking(null); await load(); onChanged(); }}
          onClose={() => setRevoking(null)} />
      )}
    </GateModal>
  );
}

/* ── Upload a file ───────────────────────────────────────────────── */

function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(new RegExp('^' + String.fromCharCode(0xfeff)), '');
  const rows: string[][] = []; let row: string[] = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(x => x.trim() !== ''));
  if (!head) return [];
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim() || `col${i + 1}`, r[i] ?? ''])));
}

export function UploadModal({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const read = async (file: File) => {
    setError(null); setMsg(null);
    try {
      const text = await file.text();
      let list: Record<string, unknown>[];
      if (/\.json$/i.test(file.name) || /^\s*[[{]/.test(text)) {
        const j = JSON.parse(text);
        list = (Array.isArray(j) ? j : (j.records || j.rows || [j])).filter((r: unknown) => r && typeof r === 'object');
      } else list = parseCsv(text);
      if (!list.length) throw new Error('empty');
      setRows(list.slice(0, 500)); setFileName(file.name);
    } catch { setError(G.uploadBad); setRows(null); }
  };
  const sample = async () => {
    setError(null); setMsg(null);
    try { const r = await gateApi.sample(); setRows(r.records); setFileName('sample-leads.json'); } catch { setError(G.failed); }
  };
  const send = async () => {
    if (!rows) return;
    setBusy(true); setError(null);
    try {
      const r = await gateApi.upload(fileName, rows);
      setMsg(`${G.uploadDone(r.records.length)}${r.newFields.length ? ` · ${G.uploadNew(r.newFields.length)}` : ''}`);
      setRows(null); onDone();
    } catch (err) { setError(fail(err)); }
    setBusy(false);
  };

  return (
    <GateModal title={G.uploadTitle} busy={busy} onClose={onClose}
      footer={<button type="button" className={c.confirm} onClick={send} disabled={busy || !rows}>{busy ? G.working : G.uploadSend}</button>}>
      <div className={`${g.drop} ${over ? g.dropOver : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) read(f); }}>
        <p>{G.uploadDrop}</p>
        <div className={g.dropBtns}>
          <button type="button" className={g.secondaryBtn} onClick={() => input.current?.click()} disabled={busy}>{G.uploadPick}</button>
          <button type="button" className={g.secondaryBtn} onClick={sample} disabled={busy}>{G.uploadSample}</button>
          <input ref={input} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ''; }} />
        </div>
        <span className={g.muted}>{G.uploadSampleNote}</span>
      </div>
      <p className={g.statusLine} role="status">{rows ? G.uploadReady(rows.length, fileName) : msg || ' '}</p>
      <p className={c.error}>{error || ' '}</p>
    </GateModal>
  );
}

/* ── A connection ───────────────────────────────────────────────── */

export function ConnectionModal({ conn, onSaved, onClose }: { conn: GateConnection | null; onSaved: () => void; onClose: () => void }) {
  const [name, setName] = useState(conn?.name || '');
  const [kind, setKind] = useState<'lookup' | 'handoff'>(conn?.kind || 'lookup');
  const [url, setUrl] = useState(conn?.url || 'https://');
  const [fields, setFields] = useState((conn?.sendFields || []).join(', '));
  const [authHeader, setAuthHeader] = useState(conn?.authHeader || 'Authorization');
  const [authSecret, setAuthSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    if (!name.trim() || !/^(https:\/\/\S+|http:\/\/(localhost|127\.0\.0\.1)[:/]\S*)$/.test(url.trim())) { setError(G.cBad); return; }
    setBusy(true); setError(null);
    const body = { name: name.trim(), kind, url: url.trim(), method: 'POST' as const, sendFields: fields.split(',').map(s => s.trim()).filter(Boolean), authHeader: authHeader.trim() || null, ...(authSecret ? { authSecret } : {}) };
    try {
      if (conn) await gateApi.updateConnection(conn.id, body); else await gateApi.createConnection(body);
      onSaved();
    } catch (err) { setError(err instanceof GateApiError && err.code === 'bad_connection' ? G.cBad : G.failed); setBusy(false); }
  };

  return (
    <GateModal title={conn ? G.connEditTitle : G.connNewTitle} busy={busy} onClose={onClose}
      footer={<>
        {conn && <button type="button" className={g.linkBtnDanger} onClick={() => setDeleting(true)} disabled={busy}>{G.cDelete}</button>}
        <button type="button" className={c.confirm} onClick={save} disabled={busy}>{busy ? G.working : G.save}</button>
      </>}>
      <label className={g.field}><span>{G.cName}</span><input className={g.input} value={name} onChange={e => setName(e.target.value)} maxLength={120} /></label>
      <label className={g.field}><span>{G.cKind}</span>
        <select className={g.input} value={kind} onChange={e => setKind(e.target.value as 'lookup' | 'handoff')} disabled={!!conn}>
          <option value="lookup">{G.kindLookup}</option>
          <option value="handoff">{G.kindHandoff}</option>
        </select>
      </label>
      <label className={g.field}><span>{G.cUrl}</span><input className={g.input} dir="ltr" value={url} onChange={e => setUrl(e.target.value)} /></label>
      <label className={g.field}><span>{G.cFields}</span><input className={g.input} dir="ltr" value={fields} onChange={e => setFields(e.target.value)} /><small className={g.muted}>{G.cFieldsHint}</small></label>
      <div className={g.fieldRow}>
        <label className={g.field}><span>{G.cAuthHeader}</span><input className={g.input} dir="ltr" value={authHeader} onChange={e => setAuthHeader(e.target.value)} /></label>
        <label className={g.field}><span>{G.cAuthSecret}</span><input className={g.input} dir="ltr" type="password" value={authSecret} onChange={e => setAuthSecret(e.target.value)} placeholder={conn?.hasSecret ? G.cAuthKeep : ''} autoComplete="off" /></label>
      </div>
      <p className={c.error} role="status">{error || ' '}</p>
      {deleting && conn && (
        <ConfirmModal title={G.cDeleteTitle} body={G.cDeleteBody(conn.name)} confirmLabel={G.cDelete} danger
          onConfirm={async () => { await gateApi.deleteConnection(conn.id); setDeleting(false); onSaved(); }}
          onClose={() => setDeleting(false)} />
      )}
    </GateModal>
  );
}

/* ── One record ─────────────────────────────────────────────────── */

function DataRows({ data, model }: { data: GateData; model: Record<string, string> }) {
  return (
    <table className={g.table}>
      <thead><tr><th>{G.colField}</th><th>{G.recStored}</th><th>{G.recModel}</th></tr></thead>
      <tbody>
        {Object.entries(data).map(([k, x]) => (
          <tr key={k}>
            <td><b dir="ltr">{k}</b> <span className={`${g.pill} ${g[`a_${x.a}`]}`}>{ACTION_HE[x.a]}</span></td>
            <td className={g.val} dir="auto">{storedText(x)}</td>
            <td className={`${g.val} ${k in model ? '' : g.absent}`} dir="auto">{k in model ? model[k] : G.absent}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RecordModal({ recordId, connections, onChanged, onClose }: { recordId: string; connections: GateConnection[]; onChanged: () => void; onClose: () => void }) {
  const [rec, setRec] = useState<GateRecord | null>(null);
  const [call, setCall] = useState<{ kind: 'lookup' | 'handoff'; r: GateCallResult } | null>(null);
  const [busy, setBusy] = useState<'lookup' | 'handoff' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => gateApi.record(recordId).then(r => setRec(r.record)).catch(() => setError(G.failed)), [recordId]);
  useEffect(() => { load(); }, [load]);

  const lookup = connections.find(x => x.kind === 'lookup' && x.enabled);
  const handoff = connections.find(x => x.kind === 'handoff' && x.enabled);
  const run = async (kind: 'lookup' | 'handoff') => {
    const conn = kind === 'lookup' ? lookup : handoff;
    if (!conn) return;
    setBusy(kind); setError(null); setCall(null);
    try { const r = await gateApi.call(conn.id, recordId); setCall({ kind, r }); await load(); onChanged(); } catch (err) { setError(fail(err)); }
    setBusy(null);
  };

  return (
    <GateModal title={`${G.recTitleOne} ${rec?.externalRef || ''}`} wide busy={!!busy} onClose={onClose}
      sub={rec && <span>{G.src[rec.source]} · {fmtTime(rec.createdAt)}{rec.policyVersion ? ` · ${G.kVersion(rec.policyVersion)}` : ''}</span>}
      footer={<>
        <button type="button" className={g.secondaryBtn} onClick={() => run('lookup')} disabled={!!busy || !lookup} title={lookup ? lookup.name : G.noLookup}>{busy === 'lookup' ? G.working : G.askBank}</button>
        <button type="button" className={c.confirm} onClick={() => run('handoff')} disabled={!!busy || !handoff} title={handoff ? handoff.name : G.noHandoff}>{busy === 'handoff' ? G.working : G.handoff}</button>
      </>}>
      {!rec && !error && <p className={g.muted}>{G.working}</p>}
      <p className={c.error} role="status">{error || ' '}</p>
      {call && (
        <div className={`${g.callBox} ${call.r.ok ? '' : g.callBad}`}>
          {!call.r.ok && <p><b>{G.callFailed}</b> {call.r.error ? `· ${call.r.error}` : ''}</p>}
          <p className={g.callHead}>{G.callSent} <span className={g.muted}>· {call.r.httpStatus} · {call.r.ms} מ״ש</span></p>
          <div className={g.chips}>
            {Object.entries(call.r.request.fields).map(([k, v]) => (
              <span key={k} className={g.sentChip} dir="ltr"><b>{k}</b>: {v.token || v.value || ''}{v.enc ? ' 🔒' : ''}</span>
            ))}
            {call.r.skipped.map(k => <span key={k} className={`${g.sentChip} ${g.absent}`} dir="ltr"><b>{k}</b>: {G.notSent}</span>)}
          </div>
          {call.kind === 'lookup' && call.r.answer?.modelView && (
            <>
              <p className={g.callHead}>{G.callAnswer}</p>
              {call.r.answer.newFields && call.r.answer.newFields.length > 0 && <p className={g.warnLine}>{G.callNew(call.r.answer.newFields.length)}</p>}
              <div className={g.chips}>
                {Object.entries(call.r.answer.stored || {}).map(([k, x]) => (
                  <span key={k} className={`${g.sentChip} ${k in call.r.answer!.modelView! ? '' : g.absent}`}><b dir="ltr">{k}</b>: {k in call.r.answer!.modelView! ? call.r.answer!.modelView![k] : ACTION_HE[x.a]}</span>
                ))}
              </div>
            </>
          )}
          {call.kind === 'handoff' && call.r.answer?.opened && (
            <p className={g.callHead}>{G.callHandoff} {call.r.answer.reference} · {G.callOpened(call.r.answer.opened.filter(o => o.ok).length, call.r.answer.received || 0)}</p>
          )}
        </div>
      )}
      {rec && <DataRows data={rec.data} model={rec.modelView} />}
      {rec?.answers && rec.answers.length > 0 && (
        <>
          <p className={g.callHead}>{G.answers}</p>
          {rec.answers.slice(0, 3).map(a => (
            <div key={a.id} className={g.answerBlock}>
              <span className={g.muted}>{fmtTime(a.createdAt)}</span>
              <DataRows data={a.data} model={a.modelView} />
            </div>
          ))}
        </>
      )}
    </GateModal>
  );
}
