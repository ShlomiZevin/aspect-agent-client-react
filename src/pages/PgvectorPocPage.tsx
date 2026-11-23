/**
 * pgvector proof of concept — /:agent/pgvector-poc.
 *
 * One query, the agent's KB searched two ways side by side: Pinecone (today's
 * path) and pgvector in this environment's own Postgres. Same query vector on
 * both sides; results that appear in both lists are marked, with an overlap
 * figure on top. Server: aspect-agent-server/kb-pgvector/.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { kbPgvectorService, type PocHit, type PocInfo, type PocSearch } from '../services/kbPgvectorService';
import styles from './PgvectorPocPage.module.css';

const TOP_K_OPTIONS = [5, 10, 20];

function ResultColumn({ title, where, side, otherRanks, loading }: {
  title: string;
  where: string;
  side: { ms: number; results: PocHit[] } | null;
  otherRanks: Map<string, number>;
  loading: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className={styles.column}>
      <header className={styles.columnHead}>
        <div>
          <h2 className={styles.columnTitle}>{title}</h2>
          <span className={styles.where}>{where}</span>
        </div>
        <span className={styles.ms}>{side ? `${side.ms} ms` : loading ? '…' : '—'}</span>
      </header>
      <ol className={styles.list}>
        {(side?.results || []).map(hit => {
          const there = otherRanks.get(hit.key);
          const isOpen = open === hit.key;
          return (
            <li key={hit.key} className={`${styles.hit} ${there ? styles.inBoth : styles.onlyHere}`}>
              <button type="button" className={styles.hitButton} onClick={() => setOpen(isOpen ? null : hit.key)}>
                <div className={styles.hitTop}>
                  <span className={styles.rank}>#{hit.rank}</span>
                  <span className={styles.score}>{hit.score.toFixed(4)}</span>
                  <span className={there ? styles.badgeBoth : styles.badgeOnly}
                    title={there ? `Also in the other list, at #${there}` : 'Not in the other list'}>
                    {there ? (there === hit.rank ? 'both · same rank' : `both · #${there} there`) : 'only here'}
                  </span>
                </div>
                <div className={styles.source} dir="auto">{hit.fileName} · chunk {hit.chunkIndex ?? '—'}</div>
                <p className={isOpen ? styles.textOpen : styles.text} dir="auto">{hit.text}</p>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function PgvectorPocPage() {
  const { agent = '' } = useParams<{ agent: string }>();
  const [info, setInfo] = useState<PocInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(10);
  const [result, setResult] = useState<PocSearch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState(0); // remounts the columns (closes expanded hits) per search

  useEffect(() => {
    let cancelled = false;
    kbPgvectorService.info(agent)
      .then(i => { if (!cancelled) setInfo(i); })
      .catch(err => { if (!cancelled) setInfoError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [agent]);

  const ranks = useMemo(() => {
    const of = (hits: PocHit[] = []) => new Map(hits.map(h => [h.key, h.rank]));
    return { pinecone: of(result?.pinecone.results), pgvector: of(result?.pgvector.results) };
  }, [result]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await kbPgvectorService.search(agent, q, topK));
      setSearchId(n => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.title}>Pinecone vs pgvector</h1>
          <p className={styles.meta}>
            {info
              ? <>KB <b>{info.namespace}</b> · {info.chunks} chunks in pgvector · {info.pineconeChunks ?? '?'} in Pinecone · {info.embeddingModel} ({info.dimensions}d) · agent {info.agent}</>
              : infoError ? <span className={styles.error}>{infoError}</span> : 'Loading…'}
          </p>
        </header>

        <form className={styles.bar} onSubmit={onSubmit}>
          <input
            className={styles.input}
            dir="auto"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask what a customer would ask — Hebrew or English"
            disabled={!info}
          />
          <label className={styles.topK}>
            Top
            <select value={topK} onChange={e => setTopK(Number(e.target.value))} disabled={!info}>
              {TOP_K_OPTIONS.filter(k => !info || k <= info.maxTopK).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <button className={styles.search} type="submit" disabled={!info || loading || !query.trim()}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        <div className={styles.summary}>
          {error
            ? <span className={styles.error}>{error}</span>
            : result
              ? <>
                  <b className={result.overlap.same === result.overlap.of ? styles.overlap : styles.overlapPartial}>
                    {result.overlap.same}/{result.overlap.of} same results
                  </b>
                  <span title="Pinecone's scores are approximate (about ±0.001), so near-ties can swap places. pgvector's are exact cosine.">
                    {result.overlap.sameOrder ? 'same order' : 'order differs ⓘ'}
                  </span>
                  <span className={styles.dim}>query embedded once ({result.embedMs} ms), both sides rank the same vector · raw top {result.topK}, no min-score cut</span>
                </>
              : <span className={styles.dim}>Results that appear in both lists are marked green.</span>}
        </div>

        <div className={styles.columns}>
          <ResultColumn key={`pc-${searchId}`} title="Pinecone" where="today · AWS us-east-1" side={result?.pinecone ?? null} otherRanks={ranks.pgvector} loading={loading} />
          <ResultColumn key={`pg-${searchId}`} title="pgvector" where="Cloud SQL · Tel Aviv" side={result?.pgvector ?? null} otherRanks={ranks.pinecone} loading={loading} />
        </div>
      </div>
    </div>
  );
}
