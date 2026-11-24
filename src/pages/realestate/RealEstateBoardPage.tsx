/**
 * "לוח מכירות חי" — the real-estate demo's live sales board (design A, GPT
 * Image 2.6, picked 2026-11-24): each project's buildings with every apartment
 * lit by its status, the chain KPIs, the overnight Intelligence findings, and
 * a strip to switch projects. Data: /api/realestate/board.
 *
 * ?project=<id>&unit=<id> opens a project with an apartment selected (the AI
 * advisor's "stuck apartment" rows link here).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDocumentMeta } from '../../hooks';
import { realestateService, type BoardData } from '../../services/realestateService';
import { greeting, shekels, buildingLetter, unitKind, REPORTS_PATH } from './shared';
import { useRealEstateChat } from './chatContext';
import { Icon, Ring } from './ui';
import { IsoBuildings } from './IsoBuildings';
import { RealEstateTopbar } from './RealEstateTopbar';
import styles from './RealEstateBoardPage.module.css';

type View = 'buildings' | 'floors' | 'list';
const DEFAULT_PROJECT = 3; // Haifa — the project with a story to tell
const KIND_LABEL: Record<string, string> = { sold: 'נמכרה', reserved: 'בהזמנה', free: 'פנויה', stuck: 'תקועה — מחיר מעל השוק' };
/** The legend's narrow column takes the short form; the card and the list keep the full one. */
const LEGEND_LABEL: Record<string, string> = { ...KIND_LABEL, stuck: 'תקועה · מעל השוק' };

export function RealEstateBoardPage() {
  useDocumentMeta({ title: 'אופק יזמות — לוח מכירות חי', favicon: '/img/realestate-logo.svg', description: 'Live sales board for Ofek Development' });
  const [params, setParams] = useSearchParams();
  const { openChat } = useRealEstateChat();
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('buildings');
  // The user's pick, remembered with the project it belongs to — switching
  // project falls back to that project's default selection below.
  const [chosen, setChosen] = useState<{ project: number; unit: number } | null>(null);

  useEffect(() => {
    let alive = true;
    realestateService.getBoard().then(d => { if (alive) setData(d); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const projectId = Number(params.get('project')) || DEFAULT_PROJECT;
  const project = data?.projects.find(p => p.id === projectId) || data?.projects[0] || null;
  const allUnits = useMemo(() => project ? project.buildings.flatMap(b => b.units.map(u => ({ ...u, building: b.building }))) : [], [project]);

  // Default selection: the unit in the URL, else the most telling free unit — the longest-stuck big one.
  const urlUnit = Number(params.get('unit'));
  const defaultId = useMemo(() => {
    const pick = allUnits.find(u => u.id === urlUnit)
      || [...allUnits].filter(u => u.status === 'פנויה').sort((a, b) => Number(b.stuck) - Number(a.stuck) || b.rooms - a.rooms || b.floor - a.floor)[0]
      || allUnits[0];
    return pick ? pick.id : null;
  }, [allUnits, urlUnit]);
  const selectedId = chosen && project && chosen.project === project.id ? chosen.unit : defaultId;
  const setSelectedId = (id: number) => { if (project) setChosen({ project: project.id, unit: id }); };

  const selected = allUnits.find(u => u.id === selectedId) || null;
  const goProject = (id: number) => setParams({ project: String(id) });
  const step = (dir: 1 | -1) => {
    if (!data || !project) return;
    const i = data.projects.findIndex(p => p.id === project.id);
    goProject(data.projects[(i + dir + data.projects.length) % data.projects.length].id);
  };

  return (
    <div className={styles.page} dir="rtl">
      <RealEstateTopbar active="board" />

      {error && <div className={styles.error}>לא הצלחתי לטעון את הלוח: {error}</div>}

      {data && project && (
        <main className={styles.main}>
          <section className={styles.top}>
            <div className={styles.headline}>
              <span className={styles.dateChip}><Icon name="calendar" size={15} /> {data.date}</span>
              <h1>{greeting()},</h1>
              <p>זהו לוח המכירות החי של הפרויקטים.</p>
            </div>

            <aside className={styles.insights}>
              <h3><Icon name="sparkle" size={18} /> תובנות AI ללילה האחרון</h3>
              {/* One-line findings composed from the data; the full reports are on the reports page. */}
              {data.insights.map(ins => (
                <Link key={ins.id} to={REPORTS_PATH} className={styles.insight}>
                  <Icon name={ins.icon} size={18} />
                  <span>{ins.title}</span>
                </Link>
              ))}
              <Link to={REPORTS_PATH} className={styles.insightsMore}><Icon name="arrowLeft" size={14} /> לכל הדוחות</Link>
            </aside>

            <div className={styles.kpis}>
              <div className={styles.kpi}><Icon name="building" size={26} /><div><strong>{data.kpis.totalUnits}</strong><small>סה״כ דירות</small></div></div>
              <div className={styles.kpi}><Ring pct={data.kpis.pctSold} size={54} stroke={6} label={false} /><div><strong>{data.kpis.pctSold}%</strong><small>שיעור מכירה כולל</small></div></div>
              <div className={styles.kpi}><Icon name="handshake" size={26} /><div><strong>{data.kpis.soldUnits}</strong><small>דירות נמכרו</small></div></div>
              <div className={styles.kpi}><Icon name="trendUp" size={24} /><div><strong className={styles.plus}>+{data.kpis.soldLast30Days}</strong><small>דירות נמכרו ב־30 הימים האחרונים</small></div></div>
            </div>
          </section>

          <section className={styles.projectHead}>
            <div>
              <h2><Icon name="pin" size={22} /> {project.name}, {project.city}</h2>
              <p>{project.buildings.length} בניינים · {project.totalUnits} דירות · {Math.round(project.pctSold)}% נמכרו · {project.monthlyPace === 1 ? 'דירה אחת' : `${project.monthlyPace} דירות`} בחודש</p>
            </div>
            <div className={styles.arrows}>
              <button type="button" onClick={() => step(-1)} aria-label="הפרויקט הקודם"><Icon name="chevronRight" size={18} /></button>
              <button type="button" onClick={() => step(1)} aria-label="הפרויקט הבא"><Icon name="chevronLeft" size={18} /></button>
            </div>
          </section>

          <section className={styles.stage}>
            <div className={styles.side}>
              <div className={styles.legend}>
                {(['sold', 'reserved', 'free', 'stuck'] as const).map(k => (
                  <span key={k}><i className={styles[`dot_${k}`]} /> {LEGEND_LABEL[k]}</span>
                ))}
              </div>
              <div className={styles.views}>
                <button type="button" className={view === 'buildings' ? styles.viewOn : ''} onClick={() => setView('buildings')}><Icon name="building" size={16} /> תצוגת בניינים</button>
                <button type="button" className={view === 'floors' ? styles.viewOn : ''} onClick={() => setView('floors')}><Icon name="layers" size={16} /> תצוגת קומות</button>
                <button type="button" className={view === 'list' ? styles.viewOn : ''} onClick={() => setView('list')}><Icon name="grid" size={16} /> רשימת דירות</button>
              </div>
            </div>

            {selected && (
              <div className={styles.card}>
                <img src="/img/realestate/interior.jpg" alt="" />
                <div className={styles.cardBody}>
                  <strong>דירה {selected.number}</strong>
                  <small>בניין {buildingLetter(selected.building)} · קומה {selected.floor === 0 ? 'קרקע' : selected.floor} · {selected.direction}</small>
                  <div className={styles.specs}>
                    <span><Icon name="bed" size={16} />{selected.rooms} חדרים</span>
                    <span><Icon name="ruler" size={16} />{selected.sqm} מ״ר</span>
                    <span><Icon name="sun" size={16} />{selected.outdoorSqm} מ״ר {selected.type === 'דירת גן' ? 'גינה' : 'מרפסת'}</span>
                  </div>
                  <div className={styles.price}>{shekels(selected.price)}</div>
                  <span className={`${styles.status} ${styles[`status_${unitKind(selected)}`]}`}>{KIND_LABEL[unitKind(selected)]}</span>
                  {selected.status === 'פנויה' && <small className={styles.days}>על המדף {selected.daysOnMarket} ימים</small>}
                  {selected.stuck && selected.premiumPct != null && <small className={styles.days}>{selected.premiumPct}% מעל עסקאות דומות</small>}
                  <button type="button" className={styles.askBtn} onClick={() => openChat(selected.status === 'נמכרה'
                    ? `מי קנה את דירה ${selected.number} בבניין ${selected.building} ב${project.name}, באיזה מחיר ובאיזו הנחה?`
                    : `למה דירה ${selected.number} בבניין ${selected.building} ב${project.name} (${selected.rooms} חדרים, ${selected.direction}) לא נמכרת, ומה כדאי לעשות?`)}>
                    <Icon name="sparkle" size={15} /> שאל את ה-AI על הדירה
                  </button>
                </div>
              </div>
            )}

            <div className={styles.scene}>
              {view === 'buildings' && (
                <IsoBuildings buildings={project.buildings} floors={project.floors} selectedId={selectedId} onSelect={u => setSelectedId(u.id)} />
              )}
              {view === 'floors' && (
                <div className={styles.floorsView}>
                  {project.buildings.map(b => (
                    <div key={b.building} className={styles.floorsBuilding}>
                      <h4>בניין {buildingLetter(b.building)} · {b.pctSold}% נמכרו</h4>
                      {Array.from({ length: project.floors + 1 }, (_, i) => project.floors - i).map(floor => (
                        <div key={floor} className={styles.floorRow}>
                          <span className={styles.floorLabel}>{floor === 0 ? 'קרקע' : floor}</span>
                          {[1, 2, 3, 4].map(pos => {
                            const u = b.units.find(x => x.floor === floor && x.position === pos);
                            return u
                              ? <button key={pos} type="button" className={`${styles.cell} ${styles[`cell_${unitKind(u)}`]} ${u.id === selectedId ? styles.cellOn : ''}`} onClick={() => setSelectedId(u.id)}>{u.rooms}</button>
                              : <span key={pos} className={styles.cellEmpty} />;
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {view === 'list' && (
                <div className={styles.listView}>
                  <table>
                    <thead><tr><th>בניין</th><th>קומה</th><th>דירה</th><th>חדרים</th><th>סוג</th><th>מ״ר</th><th>כיוון</th><th>מחיר</th><th>סטטוס</th><th>ימים על המדף</th></tr></thead>
                    <tbody>
                      {allUnits.filter(u => u.status !== 'נמכרה')
                        .sort((a, b) => Number(b.stuck) - Number(a.stuck) || b.daysOnMarket - a.daysOnMarket || b.rooms - a.rooms)
                        .map(u => (
                          <tr key={u.id} className={u.id === selectedId ? styles.rowOn : ''} onClick={() => setSelectedId(u.id)}>
                            <td>{buildingLetter(u.building)}</td><td>{u.floor === 0 ? 'קרקע' : u.floor}</td><td>{u.number}</td><td>{u.rooms}</td><td>{u.type}</td>
                            <td>{u.sqm}</td><td>{u.direction}</td><td>{shekels(u.price)}</td>
                            <td><span className={`${styles.status} ${styles[`status_${unitKind(u)}`]}`}>{KIND_LABEL[unitKind(u)]}</span></td><td>{u.daysOnMarket}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className={styles.strip}>
            <div className={styles.stripHead}>
              <h3><Icon name="pin" size={18} /> כל הפרויקטים</h3>
              <small><Icon name="layers" size={14} /> סטטוס מכירות בזמן אמת</small>
            </div>
            {data.projects.map(p => (
              <button key={p.id} type="button" className={`${styles.projectCard} ${p.id === project.id ? styles.projectOn : ''}`} onClick={() => goProject(p.id)}>
                <img src={`/img/realestate/p${p.id}.jpg`} alt="" />
                <div>
                  <strong>{p.name}, {p.city}</strong>
                  <span className={styles.projectStat}><Ring pct={p.pctSold} size={34} stroke={4} label={false} /> <b>{Math.round(p.pctSold)}%</b></span>
                  <small>{p.sold} / {p.totalUnits} נמכרו</small>
                </div>
              </button>
            ))}
          </section>
        </main>
      )}
    </div>
  );
}
