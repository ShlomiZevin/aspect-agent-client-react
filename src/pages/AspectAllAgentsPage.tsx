import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AGENT_REGISTRY } from '../agents/agentRegistry';
import { freedaNextConfig, oneZeroConfig } from '../agents';
import { getBaseURL } from '../services/api';
import type { AgentConfig } from '../types';
import styles from './AspectAllAgentsPage.module.css';

/**
 * /aspect/all — every agent on the platform on one page, for Shlomi only.
 * Unlinked from anywhere and marked noindex: the URL is the secret. Unlike
 * /aspect/agents (Itzik's hub, BI agents only) it also shows what each client
 * is, how far its data runs and whether Intelligence is on, so a name alone
 * ("what's Teva Naot?") is never the only clue.
 */

interface AgentEntry {
  slug: string;
  path: string;
  config: AgentConfig;
  about: string;
  /** Data agents: the schema whose loaded data range and Intelligence switch we show. */
  dataset?: string;
}

const LOGOS_WITH_OWN_FRAME = new Set(['thestock', 'hypertoy']);

const DATA_AGENTS: AgentEntry[] = [
  { slug: 'zolstock', path: '/zolstock', config: AGENT_REGISTRY.zolstock, dataset: 'zolstock',
    about: 'Discount retail chain. Sales, stock, items and stores.' },
  { slug: 'tevanaot', path: '/tevanaot', config: AGENT_REGISTRY.tevanaot, dataset: 'tevanaot',
    about: 'Footwear retailer (shoes). Sales, models, stores and inventory.' },
  { slug: 'thestock', path: '/thestock', config: AGENT_REGISTRY.thestock, dataset: 'thestock',
    about: 'Retail chain, sister brand of Hyper Toy. Customers, payments, products and stock.' },
  { slug: 'hypertoy', path: '/hypertoy', config: AGENT_REGISTRY.hypertoy, dataset: 'hypertoy',
    about: 'Toy retail chain. Sales, profit, inventory and customers.' },
  { slug: 'superhist', path: '/superhist', config: AGENT_REGISTRY.superhist, dataset: 'superhist',
    about: 'The Social Supermarket. Orders, products, members and subsidy.' },
  { slug: 'zer4u', path: '/zer4u', config: AGENT_REGISTRY.zer4u, dataset: 'zer4u',
    about: 'Flower shop chain. Sales, stock and branch performance.' },
  { slug: 'newdeli', path: '/newdeli', config: AGENT_REGISTRY.newdeli, dataset: 'newdeli',
    about: 'Fast-food chain. Orders, branches and revenue.' },
];

const DEMO_AGENTS: AgentEntry[] = [
  { slug: 'aspect', path: '/aspect', config: AGENT_REGISTRY.aspect, dataset: 'aspect',
    about: 'Demo with made-up data: TechZone electronics, an FMCG chain and a fashion chain.' },
  { slug: 'onezero', path: '/aspect/onezero', config: oneZeroConfig,
    about: 'Demo: churn prediction and prevention for a digital bank.' },
];

const OTHER_AGENTS: AgentEntry[] = [
  { slug: 'banking-v2', path: '/banking-v2', config: AGENT_REGISTRY['banking-v2'],
    about: 'Lybi: Hebrew bank account opening assistant.' },
  { slug: 'banking', path: '/banking', config: AGENT_REGISTRY.banking,
    about: 'First version of the bank account opening assistant.' },
  { slug: 'byline', path: '/byline', config: AGENT_REGISTRY.byline,
    about: 'Byline Bank risk due diligence questionnaire.' },
  { slug: 'freeda', path: '/freeda', config: AGENT_REGISTRY.freeda,
    about: 'Menopause wellness companion.' },
  { slug: 'freedanext', path: '/freedanext', config: freedaNextConfig,
    about: 'Web face for Freeda 1.0.' },
  { slug: 'compass', path: '/compass', config: AGENT_REGISTRY.compass,
    about: 'Career change navigator.' },
  { slug: 'foreman', path: '/foreman', config: AGENT_REGISTRY.foreman,
    about: 'ERP and master-data agent for infrastructure contractors.' },
  { slug: 'tiktok', path: '/tiktok', config: AGENT_REGISTRY.tiktok,
    about: 'Comedy brainstorming partner for TikTok content.' },
];

interface DataInfo { lastDataDate: string | null }

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function AspectAllAgentsPage() {
  const [dataInfo, setDataInfo] = useState<Record<string, DataInfo>>({});
  const [intelligenceOn, setIntelligenceOn] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = 'All agents';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => { robots.remove(); };
  }, []);

  useEffect(() => {
    const base = getBaseURL();
    const datasets = [...DATA_AGENTS, ...DEMO_AGENTS].map(a => a.dataset).filter((d): d is string => !!d);
    // Each card fills in on its own; one schema failing leaves only its own line
    // blank. One retry: eight lookups at once can trip a transient error.
    const loadInfo = (ds: string, retry: boolean) => {
      fetch(`${base}/api/admin/data-loader/${ds}/data-info`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(info => setDataInfo(prev => ({ ...prev, [ds]: { lastDataDate: info.lastDataDate ?? null } })))
        .catch(() => { if (retry) setTimeout(() => loadInfo(ds, false), 1500); });
    };
    for (const ds of datasets) loadInfo(ds, true);
    fetch(`${base}/api/admin/intelligence/datasets`)
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        const on = (body?.datasets ?? [])
          .filter((d: { config?: { enabled?: boolean } }) => d.config?.enabled)
          .map((d: { id: string }) => d.id);
        setIntelligenceOn(new Set(on));
      })
      .catch(() => {});
  }, []);

  const renderCard = (agent: AgentEntry) => {
    const { slug, path, config, about, dataset } = agent;
    const last = dataset ? dataInfo[dataset]?.lastDataDate : null;
    const hasIntelligence = !!dataset && intelligenceOn.has(dataset);
    return (
      <div key={slug} className={styles.card}>
        <Link to={path} className={styles.cardMain}>
          {LOGOS_WITH_OWN_FRAME.has(slug) ? (
            <img src={config.logo.src} alt={config.logo.alt} className={styles.logoFramed} />
          ) : (
            <div className={styles.logoTile}>
              <img src={config.logo.src} alt={config.logo.alt} className={styles.logo} />
            </div>
          )}
          <div className={styles.cardContent}>
            <h3>{config.displayName}</h3>
            <p className={styles.about}>{about}</p>
            {last && <p className={styles.dataLine}>Data through {formatDate(last)}</p>}
          </div>
        </Link>
        <div className={styles.actions}>
          <Link to={path} className={styles.action}>Chat</Link>
          {hasIntelligence && (
            <Link to={`/${dataset}/intelligence`} className={styles.action}>Intelligence</Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>All agents</h1>
        <p className={styles.subtitle}>Every agent on the platform, in one place.</p>
      </header>

      <section className={styles.section}>
        <h2>Client data agents</h2>
        <p className={styles.sectionNote}>Chat over the client's real data, loaded nightly.</p>
        <div className={styles.grid}>{DATA_AGENTS.map(renderCard)}</div>
      </section>

      <section className={styles.section}>
        <h2>Demos</h2>
        <div className={styles.grid}>{DEMO_AGENTS.map(renderCard)}</div>
      </section>

      <section className={styles.section}>
        <h2>Other agents</h2>
        <div className={styles.grid}>{OTHER_AGENTS.map(renderCard)}</div>
      </section>
    </div>
  );
}
