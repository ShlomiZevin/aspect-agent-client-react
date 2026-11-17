import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { pageCommentsService, type PageComment } from '../services/pageCommentsService';
import { PAGE, SECTIONS, type Item, type SectionKey } from './bankJerusalemContent';
import s from './LybiBankJerusalemEstimatePage.module.css';

// INTERNAL: Bank Jerusalem / EasyWay — the delta between what Lybi has and what
// the journey needs, for Noa & Hila's pricing. Not a price offer.
// Content: ./bankJerusalemContent.ts. Design 1B:
//   Downloads/bank-jerusalem-page-designs/old-concept/p1-needs-only--flare.jpg
// Comments: /api/doc-comments/bank-jerusalem (aspect-agent-server/page-comments).
//
// Rules (Shlomi): the page never changes layout while people talk. Every discussion
// opens in a MODAL (fixed size; its own scroll). The desktop side column is a
// fixed-height feed of current discussions — clicking one opens its modal.
// Each top-level comment is its own thread (replies via parentId), closed /
// reopened on its own. 'general' = the page-level discussion.

const PAGE_ID = 'bank-jerusalem';
const ME_KEY = 'lybiPageComments:me';
const RATE_KEY = 'lybiPageComments:bankJerusalemRate';
const OWNER = 'שלומי'; // only this identity can hide sections from everyone (internal tool)
const GENERAL = 'general';

const PEOPLE = [
  { name: 'נועה', role: 'מוצר', color: '#D58AC0' },
  { name: 'הילה', role: 'עסקית', color: '#A98BD8' },
  { name: 'שלומי', role: 'CTO', color: '#5B2A86' },
];
const colorOf = (name: string) => PEOPLE.find(p => p.name === name)?.color ?? '#A79EAD';

const ALL_ITEMS: Item[] = SECTIONS.flatMap(sec => sec.items);
const NUM = new Map<string, number>(ALL_ITEMS.map((it, i) => [it.id, i + 1]));
const sectionThreadId = (k: SectionKey) => `section:${k}`;
function titleOf(id: string): string {
  const it = ALL_ITEMS.find(i => i.id === id);
  if (it) return it.name;
  const sec = SECTIONS.find(x => sectionThreadId(x.key) === id);
  if (sec) return sec.title;
  return 'דיון כללי';
}

// ─── helpers ──────────────────────────────────────────────────────

function readLS(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function writeLS(key: string, value: string) {
  try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* ignore */ }
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
function daysText(days: number[]): string {
  return days.length === 2 ? `${fmt(days[0])}–${fmt(days[1])}` : fmt(days[0]);
}
const ils = (n: number) => '₪' + Math.round(n).toLocaleString('en-US');
function moneyText(days: number[], rate: number): string {
  return days.map(d => ils(d * rate)).join('–');
}
const sumDays = (items: Item[]) => items.reduce((a, it) => a + (it.inTotal && it.days ? it.days[0] : 0), 0);
function timeText(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    return d.toLocaleString('he-IL', today
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

interface Thread { root: PageComment; replies: PageComment[]; lastAt: string }
interface Status { open: number; closed: number }

// ─── icons ────────────────────────────────────────────────────────

const Svg = ({ children, size = 18 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const IconChat = ({ size = 15 }: { size?: number }) => <Svg size={size}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></Svg>;
const IconChevron = () => <Svg size={16}><path d="m15 18-6-6 6-6" /></Svg>;
const IconSend = () => <Svg size={20}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></Svg>;
const IconCheck = () => <Svg size={12}><path d="M20 6 9 17l-5-5" /></Svg>;
const IconPencil = () => <Svg size={16}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>;
const IconEyeOff = () => <Svg size={14}><path d="M17.9 17.9A10 10 0 0 1 12 20c-7 0-10-8-10-8a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2" /><path d="m2 2 20 20" /></Svg>;
const IconX = () => <Svg size={22}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
const IconCoins = () => (
  <svg width="56" height="56" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <ellipse cx="26" cy="10" rx="13" ry="5" /><path d="M13 10v6c0 2.8 5.8 5 13 5s13-2.2 13-5v-6" /><path d="M13 16v6c0 2.8 5.8 5 13 5s13-2.2 13-5v-6" />
    <path d="M13 22v6c0 2.8 5.8 5 13 5s13-2.2 13-5v-6" /><path d="M9 28c-2 .8-3 1.8-3 3v6c0 2.8 5.8 5 13 5 5 0 9.4-1.1 11.6-2.7" />
  </svg>
);
const IconPeople = () => <Svg size={30}><circle cx="12" cy="7.5" r="3.6" /><path d="M5 20c.6-3.8 3.4-6 7-6s6.4 2.2 7 6" /></Svg>;
const IconBank = () => <Svg size={30}><path d="M3 9.5 12 4l9 5.5" /><path d="M4.5 10h15M6 10v8M10 10v8M14 10v8M18 10v8M3.5 20.5h17" /></Svg>;

function Avatar({ name, size }: { name: string; size?: 'sm' }) {
  return <span className={`${s.avatar} ${size === 'sm' ? s.avatarSm : ''}`} style={{ background: colorOf(name) }}>{name.slice(0, 1)}</span>;
}

// ─── page ─────────────────────────────────────────────────────────

export function LybiBankJerusalemEstimatePage() {
  const [comments, setComments] = useState<PageComment[]>([]);
  const [loadError, setLoadError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null); // discussion modal
  const [feedTab, setFeedTab] = useState<'open' | 'closed'>('open');
  const [me, setMe] = useState<string>(() => readLS(ME_KEY));
  const [rateText, setRateText] = useState<string>(() => readLS(RATE_KEY));
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<PageComment | null>(null);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [askName, setAskName] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<PageComment | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isOwner = me === OWNER;
  const rate = Number(rateText) > 0 ? Number(rateText) : 0;

  useEffect(() => { document.title = 'בנק ירושלים – מה חסר | Lybi'; }, []);

  const load = useCallback(async () => {
    try {
      const [list, hiddenList] = await Promise.all([
        pageCommentsService.list(PAGE_ID),
        pageCommentsService.getSettings(PAGE_ID),
      ]);
      setComments(list);
      setHidden(hiddenList);
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'שגיאה בטעינת התגובות');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  // threads per item: each top-level comment + its replies
  const { threadsByItem, statusByItem, feed } = useMemo(() => {
    const byId = new Map(comments.map(c => [c.id, c]));
    const threads = new Map<string, Thread[]>();
    const rootOf = new Map<number, Thread>();
    const all: { itemId: string; t: Thread }[] = [];
    for (const c of comments) {
      if (c.parentId == null || !byId.has(c.parentId)) {
        const t: Thread = { root: c, replies: [], lastAt: c.createdAt };
        rootOf.set(c.id, t);
        const list = threads.get(c.itemId) ?? [];
        list.push(t);
        threads.set(c.itemId, list);
        all.push({ itemId: c.itemId, t });
      }
    }
    for (const c of comments) {
      if (c.parentId != null && rootOf.has(c.parentId)) {
        const t = rootOf.get(c.parentId)!;
        t.replies.push(c);
        if (c.createdAt > t.lastAt) t.lastAt = c.createdAt;
      }
    }
    const status = new Map<string, Status>();
    for (const [itemId, list] of threads) {
      status.set(itemId, { open: list.filter(t => !t.root.resolved).length, closed: list.filter(t => t.root.resolved).length });
    }
    all.sort((a, b) => (a.t.lastAt < b.t.lastAt ? 1 : -1));
    return { threadsByItem: threads, statusByItem: status, feed: all };
  }, [comments]);

  const openDiscussion = (id: string) => {
    setOpenId(id); setActionError(''); setReplyTo(null); setShowClosed(false); setDraft('');
  };
  const closeDiscussion = () => { setOpenId(null); setReplyTo(null); setActionError(''); };

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDelete && !askName) closeDiscussion();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, confirmDelete, askName]);

  const chooseMe = (name: string) => {
    const n = name.trim().slice(0, 40);
    if (!n) return;
    setMe(n); writeLS(ME_KEY, n); setAskName(false); setOtherName('');
  };

  const setRate = (v: string) => {
    const clean = v.replace(/[^\d]/g, '').slice(0, 7);
    setRateText(clean); writeLS(RATE_KEY, clean);
  };

  const threads = openId ? threadsByItem.get(openId) ?? [] : [];
  const openThreads = threads.filter(t => !t.root.resolved);
  const closedThreads = threads.filter(t => t.root.resolved);

  const send = async () => {
    const body = draft.trim();
    if (!body || !openId) return;
    if (!me) { setAskName(true); return; }
    setSending(true); setActionError('');
    try {
      await pageCommentsService.add(PAGE_ID, openId, me, body, replyTo?.id);
      setDraft(''); setReplyTo(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'לא נשמר');
    } finally { setSending(false); }
  };

  const setResolved = async (c: PageComment, resolved: boolean) => {
    if (!me) { setAskName(true); return; }
    try {
      await pageCommentsService.setResolved(PAGE_ID, c.id, resolved, me);
      if (replyTo?.id === c.id) setReplyTo(null);
      await load();
    } catch (e) { setActionError(e instanceof Error ? e.message : 'לא נשמר'); }
  };

  const doDelete = async () => {
    const c = confirmDelete;
    setConfirmDelete(null);
    if (!c) return;
    try { await pageCommentsService.remove(PAGE_ID, c.id); await load(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'לא נמחק'); }
  };

  const startReply = (c: PageComment) => {
    setReplyTo(c);
    inputRef.current?.focus();
  };

  const toggleHidden = async (k: SectionKey) => {
    const next = hidden.includes(k) ? hidden.filter(x => x !== k) : [...hidden, k];
    setHidden(next);
    try { setHidden(await pageCommentsService.saveSettings(PAGE_ID, next, me)); }
    catch { load(); }
  };
  const isHidden = (k: SectionKey) => hidden.includes(k);

  // what the modal is about
  const subject = useMemo(() => {
    if (!openId) return null;
    const item = ALL_ITEMS.find(i => i.id === openId);
    if (item) return { title: item.name, num: NUM.get(item.id), item };
    const sec = SECTIONS.find(x => sectionThreadId(x.key) === openId);
    if (sec) return { title: sec.title, sub: sec.sub };
    return { title: 'דיון כללי', sub: 'הערות על הדף כולו.' };
  }, [openId]);

  // totals (base = items marked inTotal; their-cloud figures are an alternative, not added)
  const totals = useMemo(() => {
    const by = (k: SectionKey) => sumDays(SECTIONS.find(x => x.key === k)!.items);
    const gaps = by('gaps'), bank = by('bank'), infra = by('infra');
    return { gaps, bank, infra, base: gaps + bank + infra };
  }, []);

  const feedOpen = feed.filter(f => !f.t.root.resolved);
  const feedClosed = feed.filter(f => f.t.root.resolved);
  const feedList = feedTab === 'open' ? feedOpen : feedClosed;

  // ─── small render helpers (plain functions — nothing with an input inside) ───

  const pill = (id: string) => {
    const st = statusByItem.get(id);
    const go = (e: React.SyntheticEvent) => { e.stopPropagation(); openDiscussion(id); };
    const common = { role: 'button', tabIndex: 0, onClick: go, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') go(e); } } as const;
    if (!st) return <span {...common} className={s.pill}>אין דיון</span>;
    if (st.open > 0) {
      return <span {...common} className={`${s.pill} ${s.pillOpen}`}><span className={s.dot} />יש דיון{st.open > 1 ? ` · ${st.open}` : ''}<IconChat /></span>;
    }
    return <span {...common} className={`${s.pill} ${s.pillDone}`}><IconCheck />נסגר</span>;
  };

  const comment = (c: PageComment, t: Thread, isReply?: boolean) => (
    <div key={c.id} className={`${s.msg} ${isReply ? s.msgReply : ''}`}>
      <Avatar name={c.author} size={isReply ? 'sm' : undefined} />
      <div className={s.msgMain}>
        <div className={s.msgHead}>
          <span className={s.msgName}>{c.author}</span>
          <span className={s.msgTime}>{timeText(c.createdAt)}</span>
        </div>
        <div className={s.msgBody}>{c.body}</div>
        <div className={s.msgActions}>
          {!isReply && !t.root.resolved && <button type="button" onClick={() => startReply(c)}>השב</button>}
          {!isReply && (t.root.resolved
            ? <button type="button" onClick={() => setResolved(c, false)}>פתח מחדש</button>
            : <button type="button" className={s.actGreen} onClick={() => setResolved(c, true)}>✓ סגור</button>)}
          {me && c.author === me && <button type="button" className={s.actDel} onClick={() => setConfirmDelete(c)}>מחק</button>}
        </div>
      </div>
    </div>
  );

  const threadView = (t: Thread) => (
    <div key={t.root.id} className={`${s.thread} ${t.root.resolved ? s.threadClosed : ''}`}>
      {comment(t.root, t)}
      {t.replies.map(r => comment(r, t, true))}
      {t.root.resolved && (
        <div className={s.resolvedLine}><span className={s.check}><IconCheck /></span>נסגר{t.root.resolvedBy ? ` · ${t.root.resolvedBy}` : ''}</div>
      )}
    </div>
  );

  // ─── render ───

  return (
    <div dir="rtl" lang="he" className={s.page}>
      <nav className={s.topbar}>
        <div className={s.topbarInner}>
          <div className={s.brand}>
            <Link to="/lybi/knowledge"><img className={s.logo} src="/img/lybi-logo-transparent.png" alt="Lybi" /></Link>
            <span className={s.brandSep} />
            <span className={s.brandNote}>עמוד פנימי</span>
          </div>
          <div className={s.people}>
            {PEOPLE.map(p => (
              <button key={p.name} type="button" className={`${s.person} ${me === p.name ? s.personMe : ''}`} onClick={() => chooseMe(p.name)} title={me === p.name ? 'זה אני' : 'אני ' + p.name}>
                <Avatar name={p.name} />
                <span className={s.personText}>
                  <span className={s.personName}>{p.name}</span>
                  <span className={s.personRole}>{me === p.name ? 'אני' : p.role}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className={s.wrap}>
        {/* header */}
        <header className={s.head}>
          <div className={s.headMain}>
            <div className={s.parties}>
              <span className={s.party}><IconPeople /><span>EasyWay</span></span>
              <span className={s.partyX}>×</span>
              <span className={s.party}><IconBank /><span>בנק ירושלים</span></span>
            </div>
            <div>
              <h1 className={s.title}>{PAGE.title}</h1>
              <p className={s.subtitle}>{PAGE.sub}</p>
            </div>
          </div>
          <button type="button" className={`${s.pill} ${s.pillGeneral}`} onClick={() => openDiscussion(GENERAL)}>
            <IconChat size={18} />דיון כללי
            <span className={`${s.pillCount} ${(statusByItem.get(GENERAL)?.open ?? 0) > 0 ? '' : s.pillCountEmpty}`}>{statusByItem.get(GENERAL)?.open ?? 0}</span>
          </button>
        </header>

        {/* summary band */}
        <section className={s.summary}>
          <span className={s.coins}><IconCoins /></span>
          <div className={s.sumParts}>
            {[
              { label: PAGE.sumGaps, d: totals.gaps },
              { label: PAGE.sumBank, d: totals.bank },
              { label: PAGE.sumInfra, d: totals.infra },
            ].map((p, i) => (
              <div key={p.label} className={s.sumPartWrap}>
                {i > 0 && <span className={s.plus}>+</span>}
                <div className={s.sumPart}>
                  <span className={s.sumLabel}>{p.label}</span>
                  <span className={s.sumDays}>{fmt(p.d)} ימים</span>
                  <span className={s.sumMoney}>{rate > 0 ? `≈ ${ils(p.d * rate)}` : ' '}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={s.sumBase}>
            <div className={s.sumBaseLine}>
              {PAGE.sumBase}: {fmt(totals.base)} ימי פיתוח{rate > 0 && <> ≈ {ils(totals.base * rate)}</>}
            </div>
            <div className={s.sumBaseSub}>{PAGE.sumNote}</div>
          </div>
          <label className={s.rate}>
            <span className={s.rateLabel}>{PAGE.rateLabel}</span>
            <span className={s.rateBox}>
              <span className={s.rateIls}>₪</span>
              <input className={s.rateInput} inputMode="numeric" placeholder={PAGE.rateHint} value={rateText} onChange={e => setRate(e.target.value)} aria-label={PAGE.rateLabel} />
              <IconPencil />
            </span>
          </label>
        </section>

        <div className={s.layout}>
          {/* desktop: feed of current discussions (fixed height, own scroll). First in DOM = right side in RTL. */}
          <aside className={s.side} aria-label="דיונים">
            <div className={s.feedHead}>
              <h3 className={s.feedTitle}><IconChat size={18} />דיונים</h3>
              <div className={s.seg} role="tablist">
                <button type="button" role="tab" aria-selected={feedTab === 'open'} className={feedTab === 'open' ? s.segOn : ''} onClick={() => setFeedTab('open')}>פתוחים · {feedOpen.length}</button>
                <button type="button" role="tab" aria-selected={feedTab === 'closed'} className={feedTab === 'closed' ? s.segOn : ''} onClick={() => setFeedTab('closed')}>נסגרו · {feedClosed.length}</button>
              </div>
            </div>
            <div className={s.feedBody}>
              {feedList.length === 0 && (
                <div className={s.empty}>{feedTab === 'open' ? 'אין דיונים פתוחים. לחצו על "אין דיון" בשורה כדי להתחיל.' : 'עוד לא נסגרו דיונים.'}</div>
              )}
              {feedList.map(({ itemId, t }) => (
                <button key={t.root.id} type="button" className={s.feedItem} onClick={() => openDiscussion(itemId)}>
                  <span className={s.feedSubject}>
                    {NUM.get(itemId) && <span className={s.numSm}>{NUM.get(itemId)}</span>}
                    {titleOf(itemId)}
                  </span>
                  <span className={s.feedLine}>
                    <Avatar name={t.root.author} size="sm" />
                    <span className={s.feedAuthor}>{t.root.author}</span>
                    <span className={s.msgTime}>{timeText(t.lastAt)}</span>
                  </span>
                  <span className={s.feedText}>{t.root.body}</span>
                  <span className={s.feedMeta}>{t.replies.length > 0 ? `${t.replies.length} תשובות` : 'אין תשובות'}</span>
                </button>
              ))}
            </div>
            <div className={s.feedFoot}>
              {me ? <>מגיב/ה בתור <b>{me}</b> · <button type="button" onClick={() => setAskName(true)}>החלפה</button></> : <button type="button" onClick={() => setAskName(true)}>מי מגיב/ה?</button>}
            </div>
          </aside>

          <main className={s.main}>
            {SECTIONS.map(sec => {
              const hiddenNow = isHidden(sec.key);
              if (hiddenNow && !isOwner) return null;
              let lastGroup: string | undefined;
              return (
                <section key={sec.key} className={`${s.card} ${hiddenNow ? s.cardHidden : ''}`}>
                  <div className={s.cardHead}>
                    <div>
                      <h2 className={s.cardTitle}>{sec.title}</h2>
                      {!hiddenNow && <p className={s.cardSub}>{sec.sub}</p>}
                    </div>
                    <div className={s.headActions}>
                      {isOwner && hiddenNow && <span className={s.hiddenTag}><IconEyeOff />מוסתר</span>}
                      {isOwner && (
                        <button type="button" className={s.hideBtn} onClick={() => toggleHidden(sec.key)}>
                          {hiddenNow ? 'הצג' : 'הסתר'}
                        </button>
                      )}
                      {!hiddenNow && pill(sectionThreadId(sec.key))}
                    </div>
                  </div>

                  {!hiddenNow && (
                    <>
                      <div className={s.table}>
                        <div className={s.thead}>
                          <span>רכיב</span>
                          <span>ימים</span>
                          <span>עלות שוטפת</span>
                          <span>הסבר קצר</span>
                          <span>סטטוס דיון</span>
                        </div>
                        {sec.items.map(it => {
                          const groupRow = it.group && it.group !== lastGroup ? it.group : undefined;
                          lastGroup = it.group;
                          return (
                            <div key={it.id}>
                              {groupRow && <div className={s.groupRow}>{groupRow}</div>}
                              <div
                                role="button" tabIndex={0}
                                className={`${s.row} ${openId === it.id ? s.rowActive : ''}`}
                                onClick={() => openDiscussion(it.id)}
                                onKeyDown={e => { if (e.key === 'Enter') openDiscussion(it.id); }}
                              >
                                <span className={s.nameCell}>
                                  <span className={s.chev}><IconChevron /></span>
                                  <span className={s.num}>{NUM.get(it.id)}</span>
                                  <span className={s.name}>{it.name}</span>
                                </span>
                                <span className={s.days}>
                                  <span className={s.cellLabel}>ימים: </span>
                                  {it.days ? daysText(it.days) : '—'}
                                  <span className={s.money}>{it.days && rate > 0 ? `≈ ${moneyText(it.days, rate)}` : ' '}</span>
                                </span>
                                <span className={s.run}><span className={s.cellLabel}>עלות שוטפת: </span>{it.run}</span>
                                <span className={s.short}>
                                  {it.short}
                                  {it.dep && <span className={s.depTag}><span className={s.depIcon}>!</span>{it.dep}</span>}
                                </span>
                                <span className={s.pillCell}>{pill(it.id)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>
              );
            })}
            {loadError && <div className={s.err}>לא הצלחתי לטעון תגובות: {loadError}</div>}
          </main>
        </div>
      </div>

      {/* discussion modal — fixed size, own scroll; the page behind never moves */}
      {openId && subject && (
        <div className={s.dlgOverlay} onClick={closeDiscussion}>
          <div className={s.dlg} role="dialog" aria-modal="true" aria-label={subject.title} onClick={e => e.stopPropagation()}>
            <div className={s.dlgHead}>
              <div className={s.handle} />
              <div className={s.dlgTop}>
                <h3 className={s.dlgTitle}>
                  {subject.num && <span className={s.num}>{subject.num}</span>}
                  {subject.title}
                </h3>
                <button type="button" className={s.close} onClick={closeDiscussion} aria-label="סגור"><IconX /></button>
              </div>
              {subject.item ? (
                <div className={s.dlgMeta}>
                  {subject.item.days && <span>{daysText(subject.item.days)} ימי פיתוח</span>}
                  {subject.item.days && rate > 0 && <><span className={s.metaSep}>|</span><span>{moneyText(subject.item.days, rate)}</span></>}
                  {subject.item.run !== 'אין' && <><span className={s.metaSep}>|</span><span>עלות שוטפת: {subject.item.run}</span></>}
                </div>
              ) : (
                subject.sub && <div className={s.dlgSub}>{subject.sub}</div>
              )}
            </div>

            <div className={s.dlgBody}>
              {subject.item && (
                <div className={s.panelBox}>
                  <div>{subject.item.short}</div>
                  {subject.item.details?.map(d => (
                    <div key={d.label} className={s.detail}><b>{d.label}: </b>{d.text}</div>
                  ))}
                  {subject.item.dep && <div className={s.dep}><span className={s.depIcon}>!</span>{subject.item.dep}</div>}
                </div>
              )}
              <h4 className={s.threadTitle}>דיון בנושא <IconChat size={18} /></h4>
              {threads.length === 0 && <div className={s.empty}>עוד אין תגובות. אפשר לכתוב למטה.</div>}
              {openThreads.map(threadView)}
              {closedThreads.length > 0 && (
                <>
                  <button type="button" className={s.closedToggle} onClick={() => setShowClosed(v => !v)}>
                    <span className={s.check}><IconCheck /></span>
                    {closedThreads.length === 1 ? 'תגובה אחת נסגרה' : `${closedThreads.length} תגובות נסגרו`}
                    <span className={s.closedToggleAct}>{showClosed ? 'הסתר' : 'הצג'}</span>
                  </button>
                  {showClosed && closedThreads.map(threadView)}
                </>
              )}
            </div>

            <div className={s.composer}>
              {/* fixed-height line: who I answer / new comment — never appears or disappears */}
              <div className={`${s.replyBar} ${replyTo ? s.replyBarOn : ''}`}>
                {replyTo ? (
                  <>
                    משיב/ה ל{replyTo.author}: <span className={s.replyQuote}>{replyTo.body}</span>
                    <button type="button" onClick={() => setReplyTo(null)} aria-label="בטל תשובה">×</button>
                  </>
                ) : 'תגובה חדשה'}
              </div>
              <div className={s.composerBox}>
                <textarea
                  ref={inputRef}
                  className={s.textarea} placeholder={replyTo ? 'כתבו תשובה…' : 'הוסיפו תגובה…'} value={draft} maxLength={4000}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}
                />
                <button type="button" className={s.sendBtn} disabled={!draft.trim() || sending} onClick={send} aria-label="שלח"><IconSend /></button>
              </div>
              {/* fixed-height status line: identity, or the error in the same place */}
              <div className={`${s.composerMeta} ${actionError ? s.composerErr : ''}`}>
                {actionError
                  ? <>לא נשמר: {actionError}</>
                  : me
                    ? <>מגיב/ה בתור <b>{me}</b> · <button type="button" onClick={() => setAskName(true)}>החלפה</button> · Ctrl+Enter לשליחה</>
                    : <button type="button" onClick={() => setAskName(true)}>מי מגיב/ה?</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {askName && (
        <div className={s.overlay} onClick={() => setAskName(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h3 className={s.modalTitle}>מי מגיב/ה?</h3>
            <div className={s.modalPeople}>
              {PEOPLE.map(p => (
                <button key={p.name} type="button" className={s.modalPerson} onClick={() => chooseMe(p.name)}>
                  <Avatar name={p.name} />{p.name}
                </button>
              ))}
            </div>
            <input className={s.modalInput} placeholder="שם אחר" value={otherName} maxLength={40} onChange={e => setOtherName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') chooseMe(otherName); }} />
            <div className={s.modalActions}>
              <button type="button" className={s.btn} disabled={!otherName.trim()} onClick={() => chooseMe(otherName)}>שמור</button>
              <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setAskName(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className={s.overlay} onClick={() => setConfirmDelete(null)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h3 className={s.modalTitle}>למחוק את התגובה?</h3>
            <div className={s.modalActions}>
              <button type="button" className={s.btn} onClick={doDelete}>מחק</button>
              <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setConfirmDelete(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
