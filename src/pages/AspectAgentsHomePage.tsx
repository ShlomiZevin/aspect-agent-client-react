import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AGENT_REGISTRY } from '../agents/agentRegistry';
import styles from './AspectAgentsHomePage.module.css';

const DATA_AGENT_SLUGS = ['zer4u', 'newdeli', 'thestock', 'hypertoy', 'zolstock', 'tevanaot'] as const;

// Some logos are already self-contained square icons (full-bleed color
// background + rounded corners baked into the asset) — boxing those in
// another white tile just doubles the frame. Everything else (wordmarks,
// flat rectangular images) gets the neutral tile for contrast/consistency.
const LOGOS_WITH_OWN_FRAME = new Set(['thestock', 'hypertoy']);

export function AspectAgentsHomePage() {
  useEffect(() => {
    document.title = 'Aspect Data Agents';
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Aspect Data Agents</h1>
        <p className={styles.subtitle}>Choose a BI assistant to get started</p>
      </header>

      <div className={styles.grid}>
        {DATA_AGENT_SLUGS.map((slug) => {
          const config = AGENT_REGISTRY[slug];
          return (
            <Link key={slug} to={`/${slug}`} className={styles.card}>
              {LOGOS_WITH_OWN_FRAME.has(slug) ? (
                <img
                  src={config.logo.src}
                  alt={config.logo.alt}
                  className={styles.logoFramed}
                />
              ) : (
                <div className={styles.logoTile}>
                  <img
                    src={config.logo.src}
                    alt={config.logo.alt}
                    className={styles.logo}
                  />
                </div>
              )}
              <div className={styles.cardContent}>
                <h2>{config.displayName}</h2>
                <p className={styles.description}>{config.metaDescription}</p>
              </div>
              <span className={styles.arrow}>→</span>
            </Link>
          );
        })}
      </div>

      <footer className={styles.footer}>
        <p>Powered by Aspect AI</p>
      </footer>
    </div>
  );
}
