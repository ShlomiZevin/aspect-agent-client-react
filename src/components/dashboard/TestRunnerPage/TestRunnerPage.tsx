import { useState, useEffect, useCallback, useMemo } from 'react';
import * as testRunnerService from '../../../services/testRunnerService';
import type { TestRun, IndividualProfile } from '../../../types/testRunner';
import styles from './TestRunnerPage.module.css';

interface Props {
  agentName: string;
  baseURL?: string;
}

export function TestRunnerPage({ agentName, baseURL }: Props) {
  const [activeTab, setActiveTab] = useState<'individuals' | 'populations' | 'conversations' | 'reviewer'>('individuals');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Test Runner</h1>
          <p className={styles.subtitle}>Automated agent testing — generate personas, build populations, simulate conversations</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'individuals' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('individuals')}
        >
          1. Individuals
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'populations' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('populations')}
        >
          2. Populations
        </button>
        <button className={`${styles.tab} ${styles.tabDisabled}`} disabled title="Coming soon">
          3. Conversations
        </button>
        <button className={`${styles.tab} ${styles.tabDisabled}`} disabled title="Coming soon">
          4. Reviewer
        </button>
      </div>

      {activeTab === 'individuals' && (
        <IndividualsTab agentName={agentName} baseURL={baseURL} />
      )}
      {activeTab === 'populations' && (
        <PopulationsTab agentName={agentName} baseURL={baseURL} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Individuals Tab
// ─────────────────────────────────────────────────────────────────

function IndividualsTab({ agentName, baseURL }: Props) {
  const [motivations, setMotivations] = useState<string[]>([]);
  const [selectedMotivation, setSelectedMotivation] = useState('');
  const [count, setCount] = useState(10);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(true);
  const [selectedIndividual, setSelectedIndividual] = useState<IndividualProfile | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);

  // On mount: load config + runs, and poll for any in-progress runs
  useEffect(() => {
    loadConfig();
    loadRuns();
  }, [agentName]);

  // Poll for running runs — check every 3s until none are running
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running' || r.status === 'pending');
    if (!hasRunning) return;

    const interval = setInterval(async () => {
      const result = await testRunnerService.getTestRuns(
        { type: 'individuals', agentName },
        baseURL
      );
      setRuns(result);
      const stillRunning = result.some(r => r.status === 'running' || r.status === 'pending');
      if (!stillRunning) clearInterval(interval);
    }, 3000);

    return () => clearInterval(interval);
  }, [runs.some(r => r.status === 'running' || r.status === 'pending')]);

  const loadConfig = async () => {
    try {
      const config = await testRunnerService.getTestRunConfig(agentName, baseURL);
      setMotivations(config.motivations);
      if (config.motivations.length > 0 && !selectedMotivation) {
        setSelectedMotivation(config.motivations[0]);
      }
    } catch {
      setMotivations([]);
    }
  };

  const loadRuns = useCallback(async () => {
    try {
      setLoadingRuns(true);
      const result = await testRunnerService.getTestRuns(
        { type: 'individuals', agentName },
        baseURL
      );
      setRuns(result);
    } catch {
      // ignore
    } finally {
      setLoadingRuns(false);
    }
  }, [agentName, baseURL]);

  const handleGenerate = async () => {
    if (!selectedMotivation || generating) return;
    setError(null);
    setGenerating(true);

    try {
      // Create the run — it will appear as "pending" chip immediately
      const run = await testRunnerService.createTestRun({
        type: 'individuals',
        agentName,
        input: { motivation: selectedMotivation, count },
      }, baseURL);

      // Reload runs so the pending/running chip shows up
      await loadRuns();

      // Execute (long-running) — polling will pick up completion
      await testRunnerService.executeTestRun(run.id, baseURL);
      setSelectedIndividual(null);
      setShowAll(true);
      await loadRuns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
      await loadRuns(); // reload to show failed state
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteRun = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await testRunnerService.deleteTestRun(id, baseURL);
    setSelectedRunIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectedIndividual(null);
    await loadRuns();
  };

  const toggleRunChip = (id: number) => {
    setShowAll(false);
    setSelectedRunIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setShowAll(true);
    setSelectedRunIds(new Set());
  };

  const completedRuns = runs.filter(r => r.status === 'completed');

  // Collect individuals from selected runs
  const individuals = useMemo(() => {
    const visibleRuns = showAll
      ? completedRuns
      : completedRuns.filter(r => selectedRunIds.has(r.id));

    const result: (IndividualProfile & { _runId: number })[] = [];
    for (const run of visibleRuns) {
      if (Array.isArray(run.output)) {
        for (const ind of run.output as IndividualProfile[]) {
          result.push({ ...ind, _runId: run.id });
        }
      }
    }
    return result;
  }, [completedRuns, selectedRunIds, showAll]);

  return (
    <>
      {/* Config panel */}
      <div className={styles.configPanel}>
        <div className={styles.configRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Motivation</label>
            <select
              className={styles.select}
              value={selectedMotivation}
              onChange={e => setSelectedMotivation(e.target.value)}
              disabled={generating || motivations.length === 0}
            >
              {motivations.length === 0 && (
                <option value="">No motivations configured</option>
              )}
              {motivations.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Count</label>
            <input
              type="number"
              className={styles.input}
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              min={1}
              max={20}
              disabled={generating}
            />
          </div>

          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={generating || !selectedMotivation}
          >
            {generating ? (
              <><span className={styles.spinner} /> Generating...</>
            ) : (
              'Generate'
            )}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Run chips */}
      {!loadingRuns && runs.length > 0 && (
        <div className={styles.runChips}>
          {completedRuns.length > 0 && (
            <button
              className={`${styles.chip} ${showAll ? styles.chipActive : ''}`}
              onClick={handleSelectAll}
            >
              All ({completedRuns.reduce((sum, r) => sum + ((r.metadata?.count as number) || 0), 0)})
            </button>
          )}
          {runs.map(run => {
            const motivation = (run.input as Record<string, unknown>).motivation as string;
            const isRunning = run.status === 'running' || run.status === 'pending';
            const isFailed = run.status === 'failed';
            const isCompleted = run.status === 'completed';
            const count = (run.metadata?.count as number) || 0;
            const isActive = !showAll && selectedRunIds.has(run.id);

            return (
              <div key={run.id} className={styles.chipWrapper}>
                <button
                  className={`${styles.chip} ${isActive ? styles.chipActive : ''} ${isRunning ? styles.chipRunning : ''} ${isFailed ? styles.chipFailed : ''}`}
                  onClick={isCompleted ? () => toggleRunChip(run.id) : undefined}
                  style={!isCompleted ? { cursor: 'default' } : undefined}
                >
                  {isRunning && <span className={styles.chipSpinner} />}
                  {motivation}
                  {isCompleted && <> &middot; {count}</>}
                  {isRunning && <> &middot; generating...</>}
                  {isFailed && <> &middot; failed</>}
                </button>
                <button
                  className={styles.chipDelete}
                  onClick={(e) => handleDeleteRun(run.id, e)}
                  title="Delete run"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {loadingRuns && (
        <div className={styles.loading}><span className={styles.spinner} /> Loading...</div>
      )}

      {!loadingRuns && runs.length === 0 && (
        <div className={styles.empty}>No individuals yet. Generate your first batch above.</div>
      )}

      {/* Cards + detail panel */}
      {individuals.length > 0 && (
        <div className={styles.resultsArea}>
          <div className={`${styles.cardsSection} ${selectedIndividual ? styles.cardsSectionNarrow : ''}`}>
            <div className={styles.cardsGrid}>
              {individuals.map((ind, i) => {
                const isActive = selectedIndividual?.id === ind.id && (selectedIndividual as IndividualProfile & { _runId?: number })._runId === ind._runId;
                const difficultyClass = ind.difficulty === 'קשה'
                  ? styles.badgeDifficultyHard
                  : styles.badgeDifficulty;

                return (
                  <div
                    key={`${ind._runId}-${ind.id}`}
                    className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
                    onClick={() => setSelectedIndividual(ind)}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.cardName}>{ind.name}</span>
                      <span className={styles.cardId}>{ind.motivation_primary?.slice(0, 3).toUpperCase()}-{ind.id}</span>
                    </div>
                    <div className={styles.cardSummary}>
                      {ind.age}, {ind.gender} &middot; {ind.occupation}
                    </div>
                    <div className={styles.cardMeta}>
                      <span className={`${styles.badge} ${styles.badgeMotivation}`}>
                        {ind.motivation_primary}
                      </span>
                      <span className={`${styles.badge} ${difficultyClass}`}>
                        {ind.difficulty}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeTrait}`}>
                        {ind.behavioral_trait}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedIndividual && (
            <div className={styles.detailPanel}>
              <button
                className={styles.detailClose}
                onClick={() => setSelectedIndividual(null)}
              >
                &times;
              </button>
              <IndividualDetail individual={selectedIndividual} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Populations Tab
// ─────────────────────────────────────────────────────────────────

function PopulationsTab({ agentName, baseURL }: Props) {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [populationSize, setPopulationSize] = useState(20);
  const [mode, setMode] = useState<'random' | 'manual'>('random');
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [population, setPopulation] = useState<IndividualProfile[]>([]);
  const [selectedIndividual, setSelectedIndividual] = useState<IndividualProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, [agentName]);

  const loadRuns = async () => {
    try {
      setLoading(true);
      const result = await testRunnerService.getTestRuns(
        { type: 'individuals', agentName },
        baseURL
      );
      setRuns(result.filter(r => r.status === 'completed'));

      // Init percentages from available motivations
      const motivations = new Set<string>();
      for (const run of result) {
        if (run.status === 'completed') {
          const m = (run.input as Record<string, unknown>).motivation as string;
          if (m) motivations.add(m);
        }
      }
      const even = Math.floor(100 / Math.max(motivations.size, 1));
      const initial: Record<string, number> = {};
      for (const m of motivations) initial[m] = even;
      setPercentages(initial);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Collect all individuals grouped by motivation
  const poolByMotivation = useMemo(() => {
    const pool: Record<string, IndividualProfile[]> = {};
    for (const run of runs) {
      const motivation = (run.input as Record<string, unknown>).motivation as string;
      if (!motivation || !Array.isArray(run.output)) continue;
      if (!pool[motivation]) pool[motivation] = [];
      pool[motivation].push(...(run.output as IndividualProfile[]));
    }
    return pool;
  }, [runs]);

  const availableMotivations = Object.keys(poolByMotivation);
  const totalAvailable = Object.values(poolByMotivation).reduce((s, arr) => s + arr.length, 0);

  const handlePercentageChange = (motivation: string, value: number) => {
    setPercentages(prev => ({ ...prev, [motivation]: Math.max(0, Math.min(100, value)) }));
  };

  const totalPercentage = Object.values(percentages).reduce((s, v) => s + v, 0);

  const buildPopulation = () => {
    const result: IndividualProfile[] = [];

    if (mode === 'random') {
      // Flatten all individuals, shuffle, pick N
      const all = Object.values(poolByMotivation).flat();
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      result.push(...shuffled.slice(0, populationSize));
    } else {
      // Pick by percentage
      for (const motivation of availableMotivations) {
        const pct = percentages[motivation] || 0;
        const count = Math.round((pct / 100) * populationSize);
        const pool = poolByMotivation[motivation] || [];
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        result.push(...shuffled.slice(0, count));
      }
    }

    setPopulation(result);
    setSelectedIndividual(null);
  };

  if (loading) {
    return <div className={styles.loading}><span className={styles.spinner} /> Loading...</div>;
  }

  if (totalAvailable === 0) {
    return (
      <div className={styles.empty}>
        No individuals generated yet. Go to the Individuals tab first to generate batches.
      </div>
    );
  }

  return (
    <>
      <div className={styles.configPanel}>
        <div className={styles.populationHeader}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Population Size</label>
            <input
              type="number"
              className={styles.input}
              style={{ width: 100, minWidth: 100 }}
              value={populationSize}
              onChange={e => setPopulationSize(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Mode</label>
            <select
              className={styles.select}
              style={{ minWidth: 140 }}
              value={mode}
              onChange={e => setMode(e.target.value as 'random' | 'manual')}
            >
              <option value="random">Random mix</option>
              <option value="manual">Set percentages</option>
            </select>
          </div>

          <button className={styles.generateBtn} onClick={buildPopulation}>
            Build Population
          </button>
        </div>

        {mode === 'manual' && (
          <div className={styles.percentageGrid}>
            {availableMotivations.map(m => (
              <div key={m} className={styles.percentageRow}>
                <span className={styles.percentageLabel}>{m}</span>
                <span className={styles.percentagePool}>({poolByMotivation[m].length} available)</span>
                <input
                  type="number"
                  className={styles.percentageInput}
                  value={percentages[m] || 0}
                  onChange={e => handlePercentageChange(m, parseInt(e.target.value) || 0)}
                  min={0}
                  max={100}
                />
                <span className={styles.percentageSign}>%</span>
              </div>
            ))}
            <div className={styles.percentageTotal}>
              Total: {totalPercentage}%
              {totalPercentage !== 100 && (
                <span className={styles.percentageWarn}> (should be 100%)</span>
              )}
            </div>
          </div>
        )}

        {mode === 'random' && (
          <div className={styles.poolSummary}>
            Available pool: {totalAvailable} individuals across {availableMotivations.length} motivations
            ({availableMotivations.map(m => `${m}: ${poolByMotivation[m].length}`).join(', ')})
          </div>
        )}
      </div>

      {/* Population results */}
      {population.length > 0 && (
        <>
          <div className={styles.resultsHeader}>
            <span className={styles.resultsTitle}>Population ({population.length})</span>
            <span className={styles.resultsMeta}>
              {(() => {
                const counts: Record<string, number> = {};
                for (const ind of population) {
                  counts[ind.motivation_primary] = (counts[ind.motivation_primary] || 0) + 1;
                }
                return Object.entries(counts).map(([m, c]) => `${m}: ${c}`).join(', ');
              })()}
            </span>
          </div>

          <div className={styles.resultsArea}>
            <div className={`${styles.cardsSection} ${selectedIndividual ? styles.cardsSectionNarrow : ''}`}>
              <div className={styles.cardsGrid}>
                {population.map((ind, i) => {
                  const isActive = selectedIndividual === ind;
                  const difficultyClass = ind.difficulty === 'קשה'
                    ? styles.badgeDifficultyHard
                    : styles.badgeDifficulty;

                  return (
                    <div
                      key={`pop-${i}-${ind.id}`}
                      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
                      onClick={() => setSelectedIndividual(ind)}
                    >
                      <div className={styles.cardHeader}>
                        <span className={styles.cardName}>{ind.name}</span>
                        <span className={styles.cardId}>{ind.motivation_primary?.slice(0, 3).toUpperCase()}-{ind.id}</span>
                      </div>
                      <div className={styles.cardSummary}>
                        {ind.age}, {ind.gender} &middot; {ind.occupation}
                      </div>
                      <div className={styles.cardMeta}>
                        <span className={`${styles.badge} ${styles.badgeMotivation}`}>
                          {ind.motivation_primary}
                        </span>
                        <span className={`${styles.badge} ${difficultyClass}`}>
                          {ind.difficulty}
                        </span>
                        <span className={`${styles.badge} ${styles.badgeTrait}`}>
                          {ind.behavioral_trait}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedIndividual && (
              <div className={styles.detailPanel}>
                <button
                  className={styles.detailClose}
                  onClick={() => setSelectedIndividual(null)}
                >
                  &times;
                </button>
                <IndividualDetail individual={selectedIndividual} />
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Individual Detail Panel
// ─────────────────────────────────────────────────────────────────

function IndividualDetail({ individual: ind }: { individual: IndividualProfile }) {
  const difficultyClass = ind.difficulty === 'קשה'
    ? styles.badgeDifficultyHard
    : styles.badgeDifficulty;

  return (
    <div className={styles.detailContent}>
      <div className={styles.detailTopRow}>
        <h2 className={styles.detailName}>{ind.name}</h2>
        <span className={styles.cardId}>{ind.motivation_primary?.slice(0, 3).toUpperCase()}-{ind.id}</span>
      </div>

      <div className={styles.detailSummary}>
        {ind.age}, {ind.gender} &middot; {ind.location} &middot; {ind.occupation}
      </div>

      <div className={styles.cardMeta} style={{ marginBottom: 16 }}>
        <span className={`${styles.badge} ${styles.badgeMotivation}`}>{ind.motivation_primary}</span>
        <span className={`${styles.badge} ${difficultyClass}`}>{ind.difficulty}</span>
        <span className={`${styles.badge} ${styles.badgeTrait}`}>{ind.behavioral_trait}</span>
      </div>

      <div className={styles.detailFact}>{ind.unique_fact}</div>

      <DetailSection title="Demographics">
        <DetailGrid items={[
          ['Family', ind.family_status],
          ['Children', String(ind.children)],
          ['Origin', ind.origin],
          ['Employment', ind.employment_status],
        ]} />
      </DetailSection>

      <DetailSection title="Financial">
        <DetailGrid items={[
          ['Income', `${ind.income_level} (~${ind.income_monthly_approx?.toLocaleString()})`],
          ['Stability', ind.financial_stability],
          ['Literacy', ind.financial_literacy],
          ['Goal', ind.financial_goal],
          ['Risk', ind.risk_appetite],
        ]} />
      </DetailSection>

      <DetailSection title="Banking">
        <DetailGrid items={[
          ['Status', ind.banking_status],
          ['Credit Card', ind.has_credit_card ? 'Yes' : 'No'],
          ['Savings', ind.has_savings ? 'Yes' : 'No'],
          ['Loans', ind.has_loans ? 'Yes' : 'No'],
          ['Digital Comfort', ind.digital_banking_comfort],
        ]} />
      </DetailSection>

      <DetailSection title="Behavioral">
        <DetailGrid items={[
          ['Decision Style', ind.decision_making_style],
          ['Info Need', ind.information_need],
          ['Trust Speed', ind.trust_building_speed],
          ['Objection', ind.objection_style],
          ['Pressure', ind.pressure_response],
          ['Social Proof', ind.social_proof_sensitivity],
        ]} />
      </DetailSection>

      {ind.motivation_secondary && (
        <DetailSection title="Secondary Motivation">
          <span className={styles.detailValue}>{ind.motivation_secondary}</span>
        </DetailSection>
      )}

      <DetailSection title="Primary Fear">
        <span className={styles.detailFearText}>{ind.primary_fear}</span>
      </DetailSection>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.detailSection}>
      <div className={styles.detailSectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <div className={styles.detailGrid}>
      {items.map(([label, value]) => (
        <div key={label} className={styles.detailItem}>
          <span className={styles.detailLabel}>{label}</span>
          <span className={styles.detailValue}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
