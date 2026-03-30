import { useState, useEffect, useCallback, useMemo } from 'react';
import * as testRunnerService from '../../../services/testRunnerService';
import type { TestRun, IndividualProfile, TestRunConfig, MotivationDef } from '../../../types/testRunner';
import styles from './TestRunnerPage.module.css';

interface Props {
  agentName: string;
  baseURL?: string;
}

export function TestRunnerPage({ agentName, baseURL }: Props) {
  const [activeTab, setActiveTab] = useState<'individuals' | 'populations'>('individuals');
  const [showSettings, setShowSettings] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);

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
        <div style={{ flex: 1 }} />
        {activeTab === 'individuals' && <button
          className={styles.settingsBtn}
          onClick={() => setShowSettings(true)}
          title="Configure prompts and motivations"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>}
      </div>

      {activeTab === 'individuals' && (
        <IndividualsTab agentName={agentName} baseURL={baseURL} key={configVersion} />
      )}
      {activeTab === 'populations' && (
        <PopulationsTab agentName={agentName} baseURL={baseURL} />
      )}

      {showSettings && (
        <SettingsModal agentName={agentName} baseURL={baseURL} onClose={() => { setShowSettings(false); setConfigVersion(v => v + 1); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Individuals Tab
// ─────────────────────────────────────────────────────────────────

function IndividualsTab({ agentName, baseURL }: Props) {
  const [motivations, setMotivations] = useState<MotivationDef[]>([]);
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
      const mots: MotivationDef[] = (config.motivations || []).map(
        (m: string | MotivationDef) => typeof m === 'string' ? { key: m, description: '' } : m
      );
      setMotivations(mots);
      if (mots.length > 0 && !selectedMotivation) {
        setSelectedMotivation(mots[0].key);
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
                <option key={m.key} value={m.key}>{m.key}</option>
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
              {individuals.map((ind, _i) => {
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
  const [individualRuns, setIndividualRuns] = useState<TestRun[]>([]);
  const [savedPopulations, setSavedPopulations] = useState<TestRun[]>([]);
  const [selectedPopulation, setSelectedPopulation] = useState<TestRun | null>(null);
  const [populationName, setPopulationName] = useState('');
  const [populationSize, setPopulationSize] = useState(20);
  const [mode, setMode] = useState<'random' | 'manual'>('random');
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [builtPopulation, setBuiltPopulation] = useState<IndividualProfile[] | null>(null);
  const [selectedIndividual, setSelectedIndividual] = useState<IndividualProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadData();
  }, [agentName]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [indRuns, popRuns] = await Promise.all([
        testRunnerService.getTestRuns({ type: 'individuals', agentName }, baseURL),
        testRunnerService.getTestRuns({ type: 'population', agentName }, baseURL),
      ]);
      setIndividualRuns(indRuns.filter(r => r.status === 'completed'));
      setSavedPopulations(popRuns.filter(r => r.status === 'completed'));

      // Init percentages
      const motivations = new Set<string>();
      for (const run of indRuns) {
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

  const poolByMotivation = useMemo(() => {
    const pool: Record<string, IndividualProfile[]> = {};
    for (const run of individualRuns) {
      const motivation = (run.input as Record<string, unknown>).motivation as string;
      if (!motivation || !Array.isArray(run.output)) continue;
      if (!pool[motivation]) pool[motivation] = [];
      pool[motivation].push(...(run.output as IndividualProfile[]));
    }
    return pool;
  }, [individualRuns]);

  const availableMotivations = Object.keys(poolByMotivation);
  const totalAvailable = Object.values(poolByMotivation).reduce((s, arr) => s + arr.length, 0);
  const totalPercentage = Object.values(percentages).reduce((s, v) => s + v, 0);

  const handlePercentageChange = (motivation: string, value: number) => {
    setPercentages(prev => ({ ...prev, [motivation]: Math.max(0, Math.min(100, value)) }));
  };

  const buildPopulation = () => {
    const result: IndividualProfile[] = [];

    if (mode === 'random') {
      const all = Object.values(poolByMotivation).flat();
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      result.push(...shuffled.slice(0, populationSize));
    } else {
      for (const motivation of availableMotivations) {
        const pct = percentages[motivation] || 0;
        const count = Math.round((pct / 100) * populationSize);
        const pool = poolByMotivation[motivation] || [];
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        result.push(...shuffled.slice(0, count));
      }
    }

    setBuiltPopulation(result);
    setSelectedPopulation(null);
    setSelectedIndividual(null);
    if (!populationName) {
      setPopulationName(`Population ${savedPopulations.length + 1}`);
    }
  };

  const handleSavePopulation = async () => {
    if (!builtPopulation || builtPopulation.length === 0) return;
    setSaving(true);

    try {
      const counts: Record<string, number> = {};
      for (const ind of builtPopulation) {
        counts[ind.motivation_primary] = (counts[ind.motivation_primary] || 0) + 1;
      }

      const name = populationName || `Population ${savedPopulations.length + 1}`;

      const run = await testRunnerService.createTestRun({
        type: 'population',
        agentName,
        input: {
          name,
          size: builtPopulation.length,
          mode,
          percentages: mode === 'manual' ? percentages : null,
          breakdown: counts,
        },
      }, baseURL);

      // Save population output via execute (server will handle 'population' type)
      // We need to add server support for this
      await testRunnerService.saveTestRunOutput(run.id, builtPopulation, baseURL);

      setBuiltPopulation(null);
      setPopulationName('');
      await loadData();
    } catch (err) {
      console.error('Failed to save population:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPopulation = async (pop: TestRun) => {
    if (!pop.output) {
      const full = await testRunnerService.getTestRun(pop.id, baseURL);
      setSelectedPopulation(full);
    } else {
      setSelectedPopulation(pop);
    }
    setBuiltPopulation(null);
    setSelectedIndividual(null);
  };

  const handleRename = async () => {
    if (!selectedPopulation || !editName.trim()) {
      setEditingName(false);
      return;
    }
    await testRunnerService.updateTestRunInput(selectedPopulation.id, { name: editName.trim() }, baseURL);
    setEditingName(false);
    await loadData();
    // Re-select to refresh
    const updated = await testRunnerService.getTestRun(selectedPopulation.id, baseURL);
    setSelectedPopulation(updated);
  };

  const handleDeletePopulation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await testRunnerService.deleteTestRun(id, baseURL);
    if (selectedPopulation?.id === id) setSelectedPopulation(null);
    await loadData();
  };

  // Current display: either built (unsaved) or selected saved population
  const displayPopulation: IndividualProfile[] =
    builtPopulation
      ? builtPopulation
      : selectedPopulation?.status === 'completed' && Array.isArray(selectedPopulation.output)
        ? (selectedPopulation.output as IndividualProfile[])
        : [];

  const displayName = builtPopulation
    ? populationName || 'Unsaved population'
    : selectedPopulation
      ? (selectedPopulation.input as Record<string, unknown>).name as string || 'Population'
      : '';

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
      {/* Build config */}
      <div className={styles.configPanel}>
        <div className={styles.populationHeader}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Name</label>
            <input
              type="text"
              className={styles.select}
              style={{ minWidth: 200 }}
              value={populationName}
              onChange={e => setPopulationName(e.target.value)}
              placeholder="Population name..."
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Size</label>
            <input
              type="number"
              className={styles.input}
              style={{ width: 80, minWidth: 80 }}
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
            Build
          </button>
        </div>

        {mode === 'manual' && (
          <div className={styles.percentageGrid}>
            {availableMotivations.map(m => (
              <div key={m} className={styles.percentageRow}>
                <span className={styles.percentageLabel}>{m}</span>
                <span className={styles.percentagePool}>({poolByMotivation[m].length})</span>
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
            Pool: {totalAvailable} individuals — {availableMotivations.map(m => `${m}: ${poolByMotivation[m].length}`).join(', ')}
          </div>
        )}
      </div>

      {/* Saved populations chips */}
      {(savedPopulations.length > 0 || builtPopulation) && (
        <div className={styles.runChips}>
          {builtPopulation && (
            <div className={styles.chipWrapper}>
              <button className={`${styles.chip} ${styles.chipActive}`}>
                {populationName || 'Unsaved'} &middot; {builtPopulation.length}
              </button>
              <button
                className={styles.chipSave}
                onClick={handleSavePopulation}
                disabled={saving}
                title="Save population"
              >
                {saving ? '...' : '✓'}
              </button>
            </div>
          )}
          {savedPopulations.map(pop => {
            const name = (pop.input as Record<string, unknown>).name as string || 'Population';
            const size = (pop.input as Record<string, unknown>).size as number || 0;
            const isActive = !builtPopulation && selectedPopulation?.id === pop.id;
            return (
              <div key={pop.id} className={styles.chipWrapper}>
                <button
                  className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
                  onClick={() => handleSelectPopulation(pop)}
                >
                  {name} &middot; {size}
                </button>
                <button
                  className={styles.chipDelete}
                  onClick={(e) => handleDeletePopulation(pop.id, e)}
                  title="Delete population"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Population cards */}
      {displayPopulation.length > 0 && (
        <>
          <div className={styles.resultsHeader}>
            {editingName && selectedPopulation ? (
              <input
                className={styles.editNameInput}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={e => e.key === 'Enter' && handleRename()}
                autoFocus
              />
            ) : (
              <span
                className={styles.resultsTitle}
                style={selectedPopulation ? { cursor: 'pointer' } : undefined}
                onClick={() => {
                  if (selectedPopulation) {
                    setEditName(displayName);
                    setEditingName(true);
                  }
                }}
                title={selectedPopulation ? 'Click to rename' : undefined}
              >
                {displayName} ({displayPopulation.length})
              </span>
            )}
            <span className={styles.resultsMeta}>
              {(() => {
                const counts: Record<string, number> = {};
                for (const ind of displayPopulation) {
                  counts[ind.motivation_primary] = (counts[ind.motivation_primary] || 0) + 1;
                }
                return Object.entries(counts).map(([m, c]) => `${m}: ${c}`).join(', ');
              })()}
            </span>
          </div>

          <div className={styles.resultsArea}>
            <div className={`${styles.cardsSection} ${selectedIndividual ? styles.cardsSectionNarrow : ''}`}>
              <div className={styles.cardsGrid}>
                {displayPopulation.map((ind, i) => {
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
                        <span className={styles.cardId}>{ind.id}</span>
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
                <button className={styles.detailClose} onClick={() => setSelectedIndividual(null)}>
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
// Settings Modal
// ─────────────────────────────────────────────────────────────────

function SettingsModal({ agentName, baseURL, onClose }: Props & { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [motivations, setMotivations] = useState<MotivationDef[]>([]);
  const [generatorPrompt, setGeneratorPrompt] = useState('');
  const [userMessageTemplate, setUserMessageTemplate] = useState('');
  const [defaultModel, setDefaultModel] = useState('gpt-4o');
  const [defaultCount, setDefaultCount] = useState(10);

  useEffect(() => {
    loadConfig();
  }, [agentName]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const cfg = await testRunnerService.getTestRunConfig(agentName, baseURL);
      const mots: MotivationDef[] = (cfg.motivations || []).map(
        (m: string | MotivationDef) => typeof m === 'string' ? { key: m, description: '' } : m
      );
      setMotivations(mots);
      setGeneratorPrompt(cfg.generatorPrompt || '');
      setUserMessageTemplate(cfg.userMessageTemplate || '');
      setDefaultModel(cfg.defaultModel || 'gpt-4o');
      setDefaultCount(cfg.defaultCount || 10);
    } catch {
      setError('Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  const handleMotivationChange = (index: number, field: 'key' | 'description', value: string) => {
    setMotivations(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const addMotivation = () => {
    setMotivations(prev => [...prev, { key: '', description: '' }]);
    // Scroll to bottom after render
    setTimeout(() => {
      const list = document.querySelector('[class*="motivationsList"]');
      if (list) list.scrollTop = list.scrollHeight;
    }, 50);
  };

  const removeMotivation = (index: number) => {
    setMotivations(prev => prev.filter((_, i) => i !== index));
  };

  // Build the assembled prompt preview (template + motivations injected)
  const assembledPrompt = useMemo(() => {
    const motivationsDefs = motivations
      .filter(m => m.key.trim())
      .map(m => `${m.key} — ${m.description}`)
      .join('\n\n');
    return generatorPrompt.replace(/\{\{motivations_definitions\}\}/g, motivationsDefs);
  }, [generatorPrompt, motivations]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const cleanMotivations = motivations.filter(m => m.key.trim());
      await testRunnerService.updateTestRunConfig(agentName, {
        motivations: cleanMotivations,
        generatorPrompt,
        userMessageTemplate,
        defaultModel,
        defaultCount,
      }, baseURL);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContentWide} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Test Runner Settings</h2>
          <button className={styles.modalClose} onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <div className={styles.loading}><span className={styles.spinner} /> Loading config...</div>
        ) : (
          <div className={styles.modalBody}>
            {error && <div className={styles.error}>{error}</div>}

            {/* Defaults row */}
            <div className={styles.settingsSection}>
              <div className={styles.settingsRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Default Model</label>
                  <select className={styles.select} value={defaultModel} onChange={e => setDefaultModel(e.target.value)}>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                    <option value="claude-opus-4-6">Claude Opus 4.6</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Default Count</label>
                  <input type="number" className={styles.input} value={defaultCount} onChange={e => setDefaultCount(parseInt(e.target.value) || 10)} min={1} max={50} />
                </div>
              </div>
            </div>

            {/* Side-by-side: Motivations + Prompt Preview */}
            <div className={styles.splitSettings}>
              {/* Left: Motivations editor */}
              <div className={styles.splitLeft}>
                <h3 className={styles.sectionLabel}>Motivations</h3>
                <p className={styles.sectionDesc}>
                  Define motivation types. Key appears in the dropdown, description is injected into the prompt.
                </p>
                <div className={styles.motivationsList}>
                  {motivations.map((m, i) => (
                    <div key={i} className={styles.motivationRow}>
                      <span className={styles.motivationNumber}>{i + 1}</span>
                      <div className={styles.motivationFields}>
                        <input
                          className={styles.motivationKey}
                          value={m.key}
                          onChange={e => handleMotivationChange(i, 'key', e.target.value)}
                          placeholder="key (e.g. bad_experience)"
                        />
                        <textarea
                          className={styles.motivationDesc}
                          value={m.description}
                          onChange={e => handleMotivationChange(i, 'description', e.target.value)}
                          placeholder="Description in Hebrew — injected into the prompt"
                          rows={2}
                        />
                      </div>
                      <button className={styles.motivationRemove} onClick={() => removeMotivation(i)} title="Remove">&times;</button>
                    </div>
                  ))}
                  <button className={styles.motivationAdd} onClick={addMotivation}>+ Add motivation</button>
                </div>
              </div>

              {/* Right: Live prompt preview */}
              <div className={styles.splitRight}>
                <h3 className={styles.sectionLabel}>Prompt Preview</h3>
                <p className={styles.sectionDesc}>
                  The final prompt sent to the LLM — motivations are injected automatically.
                </p>
                <pre className={styles.promptPreview}>{assembledPrompt}</pre>
              </div>
            </div>

            {/* Advanced: raw template + user message */}
            <div className={styles.advancedSection}>
              <button
                className={styles.advancedToggle}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? '▾' : '▸'} Advanced — Edit raw prompt template
              </button>

              {showAdvanced && (
                <div className={styles.advancedBody}>
                  <div className={styles.settingsSection}>
                    <h3 className={styles.sectionLabel}>Prompt Template</h3>
                    <p className={styles.sectionDesc}>
                      The raw template. Use {'{{motivations_definitions}}'} where motivation descriptions should appear.
                    </p>
                    <textarea
                      className={styles.settingsTextareaLarge}
                      value={generatorPrompt}
                      onChange={e => setGeneratorPrompt(e.target.value)}
                      rows={16}
                    />
                  </div>
                  <div className={styles.settingsSection}>
                    <h3 className={styles.sectionLabel}>User Message Template</h3>
                    <p className={styles.sectionDesc}>
                      Appended as the user message. Use {'{{motivation}}'} and {'{{count}}'} as placeholders.
                    </p>
                    <textarea
                      className={styles.settingsTextarea}
                      value={userMessageTemplate}
                      onChange={e => setUserMessageTemplate(e.target.value)}
                      rows={5}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.generateBtn} onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
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

