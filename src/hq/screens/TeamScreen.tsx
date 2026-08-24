/**
 * HQ — Team. The employees you can put to work.
 *
 * Deliberately reads like a staff list rather than a tool picker: a person has
 * a name, a role and a job description you can read. That framing is the point
 * — you brief an employee, you don't configure an integration.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { listWorkers } from '../services/hqApi';
import type { Worker, WorkerCapabilities } from '../types';
import styles from './TeamScreen.module.css';

export function TeamScreen() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [caps, setCaps] = useState<WorkerCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listWorkers()
      .then(r => { setWorkers(r.workers); setCaps(r.capabilities); setError(null); })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load the team'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headInner}>
          <span className={`hqEyebrow ${styles.eyebrow}`}>Who works here</span>
          <h1 className={styles.title}>Team</h1>
          <p className={styles.subtitle}>
            Each one has a job description you can read and change, and does real work — not just
            answers. Give them something to do and watch it happen.
          </p>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.inner}>
          {error && <div className={styles.errorBox}>{error}</div>}
          {loading && <div className={styles.loading}>Loading…</div>}

          <div className={styles.grid}>
            {workers.map(w => (
              <button
                key={w.id}
                className={styles.card}
                style={{ ['--accent' as string]: w.accent || 'var(--mag)' }}
                onClick={() => navigate(`../team/${w.slug}`)}
              >
                <div className={styles.cardTop}>
                  <span className={styles.avatar}>{w.avatar || '🙂'}</span>
                  <div className={styles.who}>
                    <div className={styles.name}>{w.name}</div>
                    <div className={styles.role}>{w.role_title}</div>
                  </div>
                  {!!w.running_jobs && (
                    <span className={styles.busy}>
                      <span className={styles.busyDot} />
                      working
                    </span>
                  )}
                </div>

                <p className={styles.tagline}>{w.tagline}</p>

                <div className={styles.cardFoot}>
                  <span>{w.conversations || 0} {w.conversations === 1 ? 'conversation' : 'conversations'}</span>
                  {/* Both kinds of money, because images alone understate it by
                      about half — and nobody should have to go looking. */}
                  {w.spend && w.spend.totalUsd > 0 && (
                    <span
                      className={styles.spend}
                      title={`$${w.spend.imagesUsd.toFixed(2)} on images (${w.spend.imageCount}) · $${w.spend.thinkingUsd.toFixed(2)} thinking`}
                    >
                      ${w.spend.totalUsd.toFixed(2)} spent
                    </span>
                  )}
                  <span className={styles.spacer} />
                  <span className={styles.open}>Open →</span>
                </div>
              </button>
            ))}

            {/* Says what's coming without pretending it exists. */}
            <div className={`${styles.card} ${styles.cardGhost}`}>
              <div className={styles.cardTop}>
                <span className={styles.avatar}>＋</span>
                <div className={styles.who}>
                  <div className={styles.name}>More to come</div>
                  <div className={styles.role}>Sales · Research · Support</div>
                </div>
              </div>
              <p className={styles.tagline}>
                A new employee is a row in the database, not a rebuild — the job description and the
                list of abilities are all that differ.
              </p>
            </div>
          </div>

          {caps && (
            <div className={styles.caps}>
              <span className={`${styles.capDot} ${caps.images ? styles.capOk : styles.capOff}`} />
              Image generation {caps.images ? 'ready' : 'not configured'}
              <span className={styles.capSep} />
              <span className={`${styles.capDot} ${caps.htmlRender ? styles.capOk : styles.capOff}`} />
              Exact-type rendering {caps.htmlRender ? 'ready' : 'needs a browser on this server'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
