import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { CrewMember } from '../../../types/crew';
import type { CrewMemberPrompt } from '../../../types/promptEditor';
import type { TransitionLogicConfig } from '../../../types/chat';
import type { AgentTheme } from '../../../types';
import {
  getAgentPrompts,
  createPromptVersion,
  updatePromptVersion,
  activatePromptVersion,
  deletePromptVersion,
  revertToCode,
  type SaveVersionPayload,
} from '../../../services/promptService';
import { getCrewTransitionLogic } from '../../../services/crewService';
import { getKnowledgeBases } from '../../../services/kbService';
import type { KnowledgeBase } from '../../../types';
import styles from './PromptEditorPanel.module.css';

const OPENAI_MODELS = [
  // GPT-4 family
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  // GPT-5 family
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-chat-latest',
  // Reasoning models
  'o3-mini',
  'o4-mini',
];

const ANTHROPIC_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-3-7-20250219',
  'claude-haiku-3-5-20241022',
];

const GOOGLE_MODELS = [
  // Gemini 3 family
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  // Gemini 2.5 family
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  // Gemini 2.0 family (no Pro version exists)
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  // Gemini 1.5 family
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  google: GOOGLE_MODELS,
};

const AVAILABLE_PROVIDERS = ['openai', 'anthropic', 'google'];

// Feature flag: show fallback model/provider selectors in debug panel
const SHOW_FALLBACK_MODEL_UI = false;

function inferProvider(model: string): string {
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gemini-')) return 'google';
  return 'openai';
}

interface PromptEditorPanelProps {
  crewMembers: CrewMember[];
  currentCrew: CrewMember | null;
  agentName: string;
  baseURL: string;
  onClose: () => void;
  onSessionOverride: (crewMemberId: string, prompt: string) => void;
  onModelOverride: (crewMemberId: string, model: string) => void;
  onFallbackOverride: (crewMemberId: string, model: string) => void;
  onKBOverride: (crewMemberId: string, sources: string[]) => void;
  onFireTransitionPrompt?: (content: string, crewMemberName?: string) => Promise<void>;
  personaOverride: string | null;
  onPersonaOverride: (persona: string | null) => void;
  onThinkingPromptOverride: (crewMemberId: string, prompt: string) => void;
  onThinkingModelOverride: (crewMemberId: string, model: string) => void;
  thinkerDisabled: Record<string, boolean>;
  onThinkerDisabledToggle: (crewMemberId: string, disabled: boolean) => void;
  onTemperatureOverride: (crewMemberId: string, temperature: number | null) => void;
  onTopKOverride: (crewMemberId: string, topK: number | null) => void;
  // Theme selection (brand themes)
  themes?: AgentTheme[];
  selectedTheme: AgentTheme | null;
  onThemeSelect: (themeId: string | null) => void;
}

type StatusType = 'success' | 'error' | 'info' | null;

interface Status {
  type: StatusType;
  message: string;
}

export function PromptEditorPanel({
  crewMembers,
  currentCrew,
  agentName,
  baseURL,
  onClose,
  onSessionOverride,
  onModelOverride,
  onFallbackOverride,
  onKBOverride,
  onFireTransitionPrompt,
  personaOverride,
  onPersonaOverride,
  onThinkingPromptOverride,
  onThinkingModelOverride,
  thinkerDisabled,
  onThinkerDisabledToggle,
  onTemperatureOverride,
  onTopKOverride,
  themes,
  selectedTheme,
  onThemeSelect,
}: PromptEditorPanelProps) {
  // Prompts data from API
  const [prompts, setPrompts] = useState<CrewMemberPrompt[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);

  // Selected crew member for editing
  const [selectedCrewId, setSelectedCrewId] = useState<string>(
    currentCrew?.name || crewMembers[0]?.name || ''
  );

  // Current prompt being edited
  const [editedPrompt, setEditedPrompt] = useState<string>('');

  // Original prompt (for dirty checking and revert)
  const [originalPrompt, setOriginalPrompt] = useState<string>('');
  const [originalThinkingPrompt, setOriginalThinkingPrompt] = useState<string>('');

  // Session override state
  const [sessionOverrides, setSessionOverrides] = useState<Record<string, string>>({});

  // Model/provider override state
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});
  const [providerOverrides, setProviderOverrides] = useState<Record<string, string>>({});
  // Fallback model override state
  const [fallbackOverrides, setFallbackOverrides] = useState<Record<string, string>>({});
  const [thinkingModelOverrides, setThinkingModelOverrides] = useState<Record<string, string>>({});

  // Temperature & Top K overrides
  const [temperatureOverrides, setTemperatureOverrides] = useState<Record<string, number | null>>({});
  const [topKOverrides, setTopKOverrides] = useState<Record<string, number | null>>({});

  // Status message
  const [status, setStatus] = useState<Status>({ type: null, message: '' });

  // Selected version ID (for version switching)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const versionDropdownRef = useRef<HTMLDivElement>(null);

  // Transition system prompt state
  const [editedTransitionPrompt, setEditedTransitionPrompt] = useState<string>('');
  const [originalTransitionPrompt, setOriginalTransitionPrompt] = useState<string>('');
  const [isFiring, setIsFiring] = useState(false);

  // Save version modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveVersionName, setSaveVersionName] = useState('');
  const [saveVersionDescription, setSaveVersionDescription] = useState('');
  const [isSavingVersion, setIsSavingVersion] = useState(false);

  // Collapsible section states
  const [showVersions, setShowVersions] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [showThemeSection, setShowThemeSection] = useState(false);
  const [showPrompting, setShowPrompting] = useState(true);

  // Thinking prompt override state (per-crew, session-only)
  const [thinkingPromptOverrides, setThinkingPromptOverrides] = useState<Record<string, string>>({});

  // Enlarge modal for thinking prompt
  const [showThinkingModal, setShowThinkingModal] = useState(false);

  // Persona editor state (agent-level, not per-crew);
  // Get the code-defined persona from any crew member (it's agent-level, shared across all)
  const codePersona = crewMembers.find(c => c.persona)?.persona || '';
  const [editedPersona, setEditedPersona] = useState<string>(personaOverride || codePersona);

  // Sync edited persona when code persona loads from API (initial load)
  const personaInitialized = useRef(false);
  useEffect(() => {
    if (!personaInitialized.current && codePersona && !personaOverride) {
      personaInitialized.current = true;
      setEditedPersona(codePersona);
    }
  }, [codePersona, personaOverride]);

  // KB override state - { crewName: string[] }
  const [kbOverrides, setKbOverrides] = useState<Record<string, string[]>>({});
  const [originalKBSources, setOriginalKBSources] = useState<string[]>([]);
  // Available KBs for this agent (loaded once)
  const [availableKBs, setAvailableKBs] = useState<KnowledgeBase[]>([]);
  const [showKBOverride, setShowKBOverride] = useState(false);

  // Load available KBs once on mount
  useEffect(() => {
    if (!agentName) return;
    getKnowledgeBases(agentName, baseURL)
      .then(setAvailableKBs)
      .catch(err => console.warn('Could not load KBs:', err.message));
  }, [agentName, baseURL]);

  // Get current crew's configured KB sources (from crew member definition)
  const crewKBSources: string[] = useMemo(() => {
    const crew = crewMembers.find(c => c.name === selectedCrewId);
    const raw = crew?.knowledgeBase?.sources || [];
    return raw.map((s: string | { name: string }) => typeof s === 'string' ? s : s.name);
  }, [crewMembers, selectedCrewId]);

  // Toggle a KB source override for the selected crew
  const handleKBToggle = useCallback((kbName: string) => {
    setKbOverrides(prev => {
      // Start from current override if exists, otherwise from crew's configured sources
      const current = prev[selectedCrewId] !== undefined ? prev[selectedCrewId] : crewKBSources;
      const next = current.includes(kbName)
        ? current.filter(n => n !== kbName)
        : [...current, kbName];
      const updated = { ...prev, [selectedCrewId]: next };
      onKBOverride(selectedCrewId, next);
      return updated;
    });
  }, [selectedCrewId, crewKBSources, onKBOverride]);

  // Current effective KB sources (override or crew config)
  const activeKBSources = kbOverrides[selectedCrewId] !== undefined
    ? kbOverrides[selectedCrewId]
    : crewKBSources;

  // Enlarge modal state
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);

  // Transition logic state (fetched from API per crew member)
  const [transitionLogic, setTransitionLogic] = useState<TransitionLogicConfig | null>(null);
  const [isLoadingTransitionLogic, setIsLoadingTransitionLogic] = useState(false);
  const [showTransitionLogicModal, setShowTransitionLogicModal] = useState(false);

  // Load prompts from API
  useEffect(() => {
    async function loadPrompts() {
      if (!agentName) return;

      setIsLoadingPrompts(true);
      try {
        const data = await getAgentPrompts(agentName, baseURL);
        setPrompts(data);
      } catch (error) {
        console.error('Failed to load prompts:', error);
        setStatus({ type: 'error', message: 'Failed to load prompts from server' });
      } finally {
        setIsLoadingPrompts(false);
      }
    }

    loadPrompts();
  }, [agentName, baseURL]);

  // Fetch transition logic when crew member selection changes
  useEffect(() => {
    if (!agentName || !selectedCrewId) return;

    setIsLoadingTransitionLogic(true);
    getCrewTransitionLogic(agentName, selectedCrewId, baseURL)
      .then(data => setTransitionLogic(data))
      .finally(() => setIsLoadingTransitionLogic(false));
  }, [agentName, selectedCrewId, baseURL]);

  // Get the selected crew member's prompt data
  const selectedPromptData = prompts.find(p => p.crewMemberId === selectedCrewId);

  // Get the currently selected version (or default to currentVersion/active)
  const selectedVersion = selectedPromptData?.versions.find(v => v.id === selectedVersionId)
    || selectedPromptData?.currentVersion;

  // Persona baseline: version's saved persona takes precedence over code default
  const basePersona = selectedVersion?.persona || codePersona;
  const isPersonaDirty = editedPersona !== basePersona;

  // Check if the current prompt is dirty (modified)
  const isMainDirty = editedPrompt !== originalPrompt;

  // Check if transition prompt is dirty
  const isTransitionDirty = editedTransitionPrompt !== originalTransitionPrompt;

  // Either prompt is dirty
  const isDirty = isMainDirty || isTransitionDirty;

  // Check if there's a session override for the selected crew
  const hasSessionOverride = selectedCrewId in sessionOverrides;
  const hasModelOverride = selectedCrewId in modelOverrides;

  // Get default model for the selected crew - prefer from prompts API (server), fallback to crew list
  const selectedCrewMember = crewMembers.find(c => c.name === selectedCrewId);
  const isThinkerCrew = selectedCrewMember?.usesThinker === true;
  const codeThinkingPrompt = selectedCrewMember?.thinkingPrompt || '';
  // Default model: active DB version's model takes precedence, then code default
  const defaultModel = selectedVersion?.model || selectedPromptData?.model || selectedCrewMember?.model || 'gpt-4';
  const currentProvider = providerOverrides[selectedCrewId] || inferProvider(defaultModel);

  // Build available models list - filter by provider and include server's model if not already in list
  const availableModels = useMemo(() => {
    const baseModels = MODELS_BY_PROVIDER[currentProvider] || OPENAI_MODELS;
    const models = [...baseModels];

    // Only add defaultModel if it's not already in the list AND there's no explicit provider override
    // (If provider is explicitly set, respect that choice and don't mix models from different providers)
    const hasProviderOverride = selectedCrewId in providerOverrides;
    if (!hasProviderOverride && defaultModel && !models.includes(defaultModel)) {
      models.unshift(defaultModel); // Add server's model at the top
    }
    return models;
  }, [currentProvider, defaultModel, selectedCrewId, providerOverrides]);

  let currentModel = modelOverrides[selectedCrewId] || defaultModel;

  // If current model is not available for the selected provider, use the first available model
  if (!availableModels.includes(currentModel)) {
    currentModel = availableModels[0];
  }

  // Check if selected version is the active one
  const isActiveVersion = selectedVersion?.isActive === true;

  // Track the last loaded version to avoid reloading on every render
  const lastLoadedVersionRef = useRef<string | null>(null);

  // Load prompt when crew member or version selection changes (NOT on sessionOverrides change)
  useEffect(() => {
    if (selectedVersion) {
      const versionKey = `${selectedCrewId}-${selectedVersion.id}`;
      // Only reload if we switched to a different version
      if (lastLoadedVersionRef.current !== versionKey) {
        lastLoadedVersionRef.current = versionKey;
        // Always show the version's prompt when switching versions
        setEditedPrompt(selectedVersion.prompt);
        setOriginalPrompt(selectedVersion.prompt);
        // Apply selected version's prompt as session override so it fires on next message
        if (selectedVersion.isActive) {
          // Active version selected — clear session override, server uses its own resolution
          setSessionOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
          onSessionOverride(selectedCrewId, '');
        } else {
          // Non-active version: apply as session override so it fires on next message
          setSessionOverrides(prev => ({ ...prev, [selectedCrewId]: selectedVersion.prompt }));
          onSessionOverride(selectedCrewId, selectedVersion.prompt);
        }
        // Load transition system prompt
        setEditedTransitionPrompt(selectedVersion.transitionSystemPrompt || '');
        setOriginalTransitionPrompt(selectedVersion.transitionSystemPrompt || '');
        // Restore saved model/provider override from version (or clear override)
        // Active version: server already uses DB model, no session override needed
        // Non-active version: set as session override so server uses it
        if (selectedVersion.model && !selectedVersion.isActive) {
          const vProvider = selectedVersion.provider || inferProvider(selectedVersion.model);
          setModelOverrides(prev => ({ ...prev, [selectedCrewId]: selectedVersion.model! }));
          setProviderOverrides(prev => ({ ...prev, [selectedCrewId]: vProvider }));
          onModelOverride(selectedCrewId, selectedVersion.model);
        } else {
          setModelOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
          setProviderOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
          onModelOverride(selectedCrewId, '');
          // Set provider to match version's model for correct dropdown display
          if (selectedVersion.model) {
            const vProvider = selectedVersion.provider || inferProvider(selectedVersion.model);
            setProviderOverrides(prev => ({ ...prev, [selectedCrewId]: vProvider }));
          }
        }
        // Restore saved KB sources from version (or clear override)
        if (selectedVersion.kbSources && selectedVersion.kbSources.length > 0) {
          setKbOverrides(prev => ({ ...prev, [selectedCrewId]: selectedVersion.kbSources! }));
          setOriginalKBSources(selectedVersion.kbSources);
          onKBOverride(selectedCrewId, selectedVersion.kbSources);
        } else {
          setKbOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
          setOriginalKBSources(crewKBSources);
          (onKBOverride as (id: string, sources: string[] | null) => void)(selectedCrewId, null);
        }
        // Restore saved persona from version (or revert to code default)
        if (selectedVersion.persona) {
          setEditedPersona(selectedVersion.persona);
          onPersonaOverride(selectedVersion.persona);
        } else {
          setEditedPersona(codePersona);
          onPersonaOverride(null);
        }
        // Restore saved thinking prompt from version (or clear override)
        if (selectedVersion.thinkingPrompt) {
          setThinkingPromptOverrides(prev => ({ ...prev, [selectedCrewId]: selectedVersion.thinkingPrompt! }));
          setOriginalThinkingPrompt(selectedVersion.thinkingPrompt);
          onThinkingPromptOverride(selectedCrewId, selectedVersion.thinkingPrompt);
        } else {
          setThinkingPromptOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
          setOriginalThinkingPrompt(codeThinkingPrompt);
          onThinkingPromptOverride(selectedCrewId, '');
        }
        // Restore saved thinking model from version (or clear override)
        if (selectedVersion.thinkingModel) {
          setThinkingModelOverrides(prev => ({ ...prev, [selectedCrewId]: selectedVersion.thinkingModel! }));
        } else {
          setThinkingModelOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
        }
        // Restore saved temperature/topK from version (or clear override)
        if (selectedVersion.temperature != null) {
          setTemperatureOverrides(prev => ({ ...prev, [selectedCrewId]: selectedVersion.temperature! }));
          onTemperatureOverride(selectedCrewId, selectedVersion.temperature!);
        } else {
          setTemperatureOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
          onTemperatureOverride(selectedCrewId, null);
        }
        if (selectedVersion.topK != null) {
          setTopKOverrides(prev => ({ ...prev, [selectedCrewId]: selectedVersion.topK! }));
          onTopKOverride(selectedCrewId, selectedVersion.topK!);
        } else {
          setTopKOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
          onTopKOverride(selectedCrewId, null);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCrewId, selectedVersion?.id]);

  // Reset version selection when crew changes (originals are set by the version load effect)
  useEffect(() => {
    setSelectedVersionId(null);
    lastLoadedVersionRef.current = null; // Force version load effect to re-run for new crew
  }, [selectedCrewId]);

  // Close version dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(e.target as Node)) {
        setVersionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync with current crew when it changes externally (not from dropdown)
  useEffect(() => {
    if (currentCrew) {
      setSelectedCrewId(currentCrew.name);
    }
    // Only sync when currentCrew changes, not when selectedCrewId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCrew?.name]);

  // Handle crew member selection change
  const handleCrewSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCrewId = e.target.value;
    setSelectedCrewId(newCrewId);
    setStatus({ type: null, message: '' });
  }, []);

  // Handle version selection change
  const handleVersionSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const versionId = e.target.value;
    setSelectedVersionId(versionId || null);
    setStatus({ type: null, message: '' });
  }, []);

  // Debounced session override to prevent re-rendering the entire context tree on every keystroke
  const debouncedSessionOverride = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (crewId: string, prompt: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        onSessionOverride(crewId, prompt);
      }, 300);
    };
  }, [onSessionOverride]);

  // Handle prompt text change
  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setEditedPrompt(newPrompt);

    // Apply session override with debouncing to avoid performance issues
    if (newPrompt !== originalPrompt) {
      setSessionOverrides(prev => ({ ...prev, [selectedCrewId]: newPrompt }));
      debouncedSessionOverride(selectedCrewId, newPrompt);

      if (!hasSessionOverride) {
        setStatus({ type: 'info', message: 'Session override active - this change is temporary' });
      }
    }
  }, [selectedCrewId, originalPrompt, hasSessionOverride, debouncedSessionOverride]);

  // Save current overrides as a new prompt version in the DB
  const handleSaveVersion = useCallback(async (name: string) => {
    if (!selectedCrewId || !editedPrompt.trim()) return;
    setIsSavingVersion(true);
    try {
      const payload: SaveVersionPayload = {
        prompt: editedPrompt,
        name: name.trim() || undefined,
        description: saveVersionDescription.trim() || undefined,
        transitionSystemPrompt: editedTransitionPrompt || undefined,
        model: modelOverrides[selectedCrewId] || undefined,
        provider: providerOverrides[selectedCrewId] || undefined,
        kbSources: kbOverrides[selectedCrewId]?.length ? kbOverrides[selectedCrewId] : undefined,
        persona: isPersonaDirty ? editedPersona : (selectedVersion?.persona || undefined),
        thinkingPrompt: thinkingPromptOverrides[selectedCrewId] || undefined,
        thinkingModel: thinkingModelOverrides[selectedCrewId] || undefined,
        temperature: temperatureOverrides[selectedCrewId] ?? undefined,
        topK: topKOverrides[selectedCrewId] ?? undefined,
      };
      const newVersion = await createPromptVersion(agentName, selectedCrewId, payload, baseURL);
      // Reload prompts to show new version
      const data = await getAgentPrompts(agentName, baseURL);
      setPrompts(data);
      // Select the newly created version in the dropdown
      setSelectedVersionId(newVersion.id);
      // Clear session override — the saved version is now the active DB default
      setSessionOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
      onSessionOverride(selectedCrewId, '');
      // Update originalPrompt so guidance doesn't show as dirty
      setOriginalPrompt(editedPrompt);
      setOriginalThinkingPrompt(thinkingPromptOverrides[selectedCrewId] ?? codeThinkingPrompt);
      setOriginalKBSources(kbOverrides[selectedCrewId] || []);
      // Reset version load ref so the effect picks up the new version cleanly
      lastLoadedVersionRef.current = null;
      setShowSaveModal(false);
      setSaveVersionName('');
      setSaveVersionDescription('');
      setStatus({ type: 'success', message: `Saved as version "${name.trim() || 'unnamed'}"` });
    } catch {
      setStatus({ type: 'error', message: 'Failed to save version' });
    } finally {
      setIsSavingVersion(false);
    }
  }, [selectedCrewId, selectedVersion, editedPrompt, editedTransitionPrompt, modelOverrides, providerOverrides, kbOverrides, editedPersona, isPersonaDirty, codePersona, thinkingPromptOverrides, thinkingModelOverrides, agentName, baseURL, saveVersionDescription]);

  // Overwrite the currently selected DB version with current edits
  const handleOverwriteVersion = useCallback(async () => {
    if (!selectedCrewId || !selectedVersion || selectedVersion.version === 0 || !editedPrompt.trim()) return;
    setIsSavingVersion(true);
    try {
      const payload: SaveVersionPayload = {
        prompt: editedPrompt,
        name: selectedVersion.name || undefined,
        description: selectedVersion.description || undefined,
        transitionSystemPrompt: editedTransitionPrompt || undefined,
        model: modelOverrides[selectedCrewId] || undefined,
        provider: providerOverrides[selectedCrewId] || undefined,
        kbSources: kbOverrides[selectedCrewId]?.length ? kbOverrides[selectedCrewId] : undefined,
        persona: isPersonaDirty ? editedPersona : (selectedVersion.persona || undefined),
        thinkingPrompt: thinkingPromptOverrides[selectedCrewId] || undefined,
        thinkingModel: thinkingModelOverrides[selectedCrewId] || undefined,
        temperature: temperatureOverrides[selectedCrewId] ?? undefined,
        topK: topKOverrides[selectedCrewId] ?? undefined,
      };
      await updatePromptVersion(agentName, selectedCrewId, selectedVersion.id, payload, baseURL);
      const data = await getAgentPrompts(agentName, baseURL);
      setPrompts(data);
      setOriginalPrompt(editedPrompt);
      setOriginalThinkingPrompt(thinkingPromptOverrides[selectedCrewId] ?? codeThinkingPrompt);
      setOriginalKBSources(kbOverrides[selectedCrewId] || []);
      lastLoadedVersionRef.current = null;
      setStatus({ type: 'success', message: `Saved v${selectedVersion.version}` });
    } catch {
      setStatus({ type: 'error', message: 'Failed to save version' });
    } finally {
      setIsSavingVersion(false);
    }
  }, [selectedCrewId, selectedVersion, editedPrompt, editedTransitionPrompt, modelOverrides, providerOverrides, kbOverrides, editedPersona, isPersonaDirty, thinkingPromptOverrides, thinkingModelOverrides, agentName, baseURL]);

  // Activate selected version as the default (without saving a new one)
  const handleActivateVersion = useCallback(async () => {
    if (!selectedCrewId || !selectedVersion || selectedVersion.isActive) return;
    try {
      if (selectedVersion.version === 0) {
        // Code default — deactivate all DB versions
        await revertToCode(agentName, selectedCrewId, baseURL);
      } else {
        await activatePromptVersion(agentName, selectedCrewId, selectedVersion.id, baseURL);
      }
      const data = await getAgentPrompts(agentName, baseURL);
      setPrompts(data);
      // Clear session override — the activated version is now the default
      setSessionOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
      onSessionOverride(selectedCrewId, '');
      setSelectedVersionId(selectedVersion.version === 0 ? `code-${selectedCrewId}` : selectedVersion.id);
      setStatus({ type: 'success', message: selectedVersion.version === 0 ? 'Reverted to code default' : `v${selectedVersion.version} set as active` });
    } catch {
      setStatus({ type: 'error', message: 'Failed to activate version' });
    }
  }, [selectedCrewId, selectedVersion, agentName, baseURL, onSessionOverride]);

  // Delete selected version
  const handleDeleteVersion = useCallback(async () => {
    if (!selectedCrewId || !selectedVersion || selectedVersion.version === 0) return;
    try {
      await deletePromptVersion(agentName, selectedCrewId, selectedVersion.id, baseURL);
      const data = await getAgentPrompts(agentName, baseURL);
      setPrompts(data);
      setSelectedVersionId(null); // Reset to current active
      setStatus({ type: 'success', message: `Deleted v${selectedVersion.version}` });
    } catch {
      setStatus({ type: 'error', message: 'Failed to delete version' });
    }
  }, [selectedCrewId, selectedVersion, agentName, baseURL]);

  // Default fallback model for selected crew — from prompts API or crew list
  const defaultFallbackModel = selectedPromptData?.fallbackModel || selectedCrewMember?.fallbackModel || 'gpt-4o';
  const currentFallbackModel = fallbackOverrides[selectedCrewId] || defaultFallbackModel;
  const hasFallbackOverride = selectedCrewId in fallbackOverrides;

  // Fallback provider — inferred from current fallback model, independent of primary provider
  const currentFallbackProvider = inferProvider(currentFallbackModel);
  const availableFallbackModels = useMemo(() => {
    return MODELS_BY_PROVIDER[currentFallbackProvider] || OPENAI_MODELS;
  }, [currentFallbackProvider]);

  // Handle fallback provider change — switch provider and reset model to first of that provider
  const handleFallbackProviderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    const newModel = (MODELS_BY_PROVIDER[newProvider] || OPENAI_MODELS)[0];
    if (newModel === defaultFallbackModel) {
      setFallbackOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
      onFallbackOverride(selectedCrewId, '');
    } else {
      setFallbackOverrides(prev => ({ ...prev, [selectedCrewId]: newModel }));
      onFallbackOverride(selectedCrewId, newModel);
      setStatus({ type: 'info', message: `Fallback provider: ${newProvider}, model: ${newModel}` });
    }
  }, [selectedCrewId, defaultFallbackModel, onFallbackOverride]);

  // Handle fallback model change
  const handleFallbackModelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    if (newModel === defaultFallbackModel) {
      setFallbackOverrides(prev => {
        const next = { ...prev };
        delete next[selectedCrewId];
        return next;
      });
      onFallbackOverride(selectedCrewId, '');
    } else {
      setFallbackOverrides(prev => ({ ...prev, [selectedCrewId]: newModel }));
      onFallbackOverride(selectedCrewId, newModel);
      setStatus({ type: 'info', message: `Fallback model override: ${newModel}` });
    }
  }, [selectedCrewId, defaultFallbackModel, onFallbackOverride]);

  // Handle model change
  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    if (newModel === defaultModel) {
      // Revert to default - clear override
      setModelOverrides(prev => {
        const next = { ...prev };
        delete next[selectedCrewId];
        return next;
      });
      onModelOverride(selectedCrewId, '');
    } else {
      // Apply model to all crews — override must persist through crew transitions
      const newOverrides: Record<string, string> = {};
      crewMembers.forEach(c => { newOverrides[c.name] = newModel; });
      setModelOverrides(prev => ({ ...prev, ...newOverrides }));
      crewMembers.forEach(c => onModelOverride(c.name, newModel));
      setStatus({ type: 'info', message: `Model override: ${newModel} (applied to all crews)` });
    }
  }, [selectedCrewId, defaultModel, onModelOverride, crewMembers]);

  // Handle provider change
  const handleProviderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    const newAvailableModels = MODELS_BY_PROVIDER[newProvider] || OPENAI_MODELS;
    const newModel = newAvailableModels[0];

    // Apply provider/model to all crews — override must persist through crew transitions
    const providerUpdates: Record<string, string> = {};
    const modelUpdates: Record<string, string> = {};
    crewMembers.forEach(c => { providerUpdates[c.name] = newProvider; modelUpdates[c.name] = newModel; });
    setProviderOverrides(prev => ({ ...prev, ...providerUpdates }));
    setModelOverrides(prev => ({ ...prev, ...modelUpdates }));
    crewMembers.forEach(c => onModelOverride(c.name, newModel));
    setStatus({ type: 'info', message: `Provider changed to ${newProvider} (applied to all crews)` });
  }, [selectedCrewId, onModelOverride, crewMembers]);

  // Revert to original prompt and model
  const handleRevert = useCallback(() => {
    if (selectedVersion) {
      setEditedPrompt(selectedVersion.prompt);
      setEditedTransitionPrompt(selectedVersion.transitionSystemPrompt || '');
      // Remove session override if reverting active version
      if (selectedVersion.isActive) {
        setSessionOverrides(prev => {
          const next = { ...prev };
          delete next[selectedCrewId];
          return next;
        });
        onSessionOverride(selectedCrewId, ''); // Clear the override
      }
      // Also revert model override
      setModelOverrides(prev => {
        const next = { ...prev };
        delete next[selectedCrewId];
        return next;
      });
      onModelOverride(selectedCrewId, '');
      // Also revert fallback override
      setFallbackOverrides(prev => {
        const next = { ...prev };
        delete next[selectedCrewId];
        return next;
      });
      onFallbackOverride(selectedCrewId, '');
      setProviderOverrides(prev => {
        const next = { ...prev };
        delete next[selectedCrewId];
        return next;
      });
      setStatus({ type: 'success', message: 'Reverted to original' });
    }
  }, [selectedVersion, selectedCrewId, onSessionOverride, onModelOverride]);

  // Clear status after delay
  useEffect(() => {
    if (status.type) {
      const timer = setTimeout(() => {
        setStatus({ type: null, message: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div className={styles.panel} dir="ltr">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h3>Prompt Editor</h3>
          <span className={styles.debugBadge}>DEBUG</span>
        </div>
        <button
          className={styles.closeButton}
          onClick={onClose}
          title="Close panel"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className={styles.content}>
        {/* 1. Crew Member Selector */}
        <div className={styles.selectorSection}>
          <label className={styles.selectorLabel}>Crew Member</label>
          <select
            className={styles.crewSelect}
            value={selectedCrewId}
            onChange={handleCrewSelect}
            disabled={isLoadingPrompts}
          >
            {crewMembers.map(crew => (
              <option key={crew.name} value={crew.name}>
                {crew.displayName}
                {crew.name === currentCrew?.name ? ' (Active)' : ''}
              </option>
            ))}
          </select>
          {hasSessionOverride && isActiveVersion && (
            <span className={styles.sessionOverrideBadge}>
              SESSION OVERRIDE
            </span>
          )}
        </div>

        {/* 2. Versions - collapsible, default collapsed */}
        {selectedPromptData && selectedPromptData.versions.length > 0 && (
          <div className={styles.editorSection}>
            <button
              className={styles.collapsibleHeader}
              onClick={() => setShowVersions(!showVersions)}
              type="button"
            >
              <span className={styles.editorLabelText}>
                Versions
                {selectedVersion && (
                  <span className={styles.hasContentBadge}>
                    v{selectedVersion.version}
                    {selectedVersion.isActive ? ' (Active)' : ''}
                  </span>
                )}
              </span>
              <svg
                className={`${styles.chevron} ${showVersions ? styles.expanded : ''}`}
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showVersions && (
              <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className={styles.versionDropdown} ref={versionDropdownRef}>
                  <button
                    type="button"
                    className={`${styles.versionDropdownTrigger} ${versionDropdownOpen ? styles.open : ''}`}
                    onClick={() => setVersionDropdownOpen(o => !o)}
                  >
                    <div className={styles.versionDropdownTriggerText}>
                      <div className={styles.versionDropdownTriggerMain}>
                        v{selectedVersion?.version ?? '?'}
                        {selectedVersion?.name ? ` - ${selectedVersion.name}` : ''}
                        {selectedVersion?.isActive ? ' (Active)' : ''}
                      </div>
                      {selectedVersion?.description && (
                        <div className={styles.versionDropdownTriggerDesc}>{selectedVersion.description}</div>
                      )}
                    </div>
                    <svg className={`${styles.versionDropdownChevron} ${versionDropdownOpen ? styles.open : ''}`}
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {versionDropdownOpen && (
                    <div className={styles.versionDropdownMenu}>
                      {selectedPromptData.versions.map(version => {
                        const isSelected = version.id === (selectedVersionId || selectedPromptData.currentVersion?.id);
                        return (
                          <div
                            key={version.id}
                            className={`${styles.versionDropdownOption} ${isSelected ? styles.selected : ''}`}
                            onClick={() => {
                              handleVersionSelect({ target: { value: version.id } } as React.ChangeEvent<HTMLSelectElement>);
                              setVersionDropdownOpen(false);
                            }}
                          >
                            <div className={styles.versionDropdownOptionMain}>
                              v{version.version}
                              {version.name ? ` - ${version.name}` : ''}
                              {version.isActive ? ' (Active)' : ''}
                            </div>
                            {version.description && (
                              <div className={styles.versionDropdownOptionDesc}>{version.description}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedVersion && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {!selectedVersion.isActive && (
                      <button
                        className={`${styles.actionButton} ${styles.saveVersionBtn}`}
                        onClick={handleActivateVersion}
                        type="button"
                      >
                        {selectedVersion.version === 0 ? 'Revert to Code' : 'Set as Active'}
                      </button>
                    )}
                    {selectedVersion.version !== 0 && (
                      selectedVersion.isActive ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', alignSelf: 'center' }}>
                          Can&apos;t delete active version
                        </span>
                      ) : (
                        <button
                          className={`${styles.actionButton} ${styles.revertButton}`}
                          onClick={handleDeleteVersion}
                          type="button"
                        >
                          Delete
                        </button>
                      )
                    )}
                  </div>
                )}
                {showSaveModal ? (
                  <div className={styles.saveVersionModal}>
                    <input
                      className={styles.saveVersionInput}
                      type="text"
                      placeholder="Version name (optional)"
                      value={saveVersionName}
                      onChange={e => setSaveVersionName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveVersion(saveVersionName);
                        if (e.key === 'Escape') { setShowSaveModal(false); setSaveVersionName(''); setSaveVersionDescription(''); }
                      }}
                      autoFocus
                    />
                    <textarea
                      className={styles.saveVersionInput}
                      placeholder="What changed? (optional)"
                      value={saveVersionDescription}
                      onChange={e => setSaveVersionDescription(e.target.value)}
                      rows={2}
                      style={{ resize: 'vertical' }}
                    />
                    <div className={styles.saveVersionActions}>
                      <button
                        className={`${styles.actionButton} ${styles.saveVersionConfirmBtn}`}
                        onClick={() => handleSaveVersion(saveVersionName)}
                        disabled={isSavingVersion || !editedPrompt.trim()}
                      >
                        {isSavingVersion ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className={styles.actionButton}
                        onClick={() => { setShowSaveModal(false); setSaveVersionName(''); setSaveVersionDescription(''); }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {selectedVersion && selectedVersion.version !== 0 && (
                      <button
                        className={`${styles.actionButton} ${styles.saveVersionBtn}`}
                        onClick={handleOverwriteVersion}
                        disabled={!editedPrompt.trim() || isSavingVersion}
                        title={`Overwrite v${selectedVersion.version}${selectedVersion.name ? ` - ${selectedVersion.name}` : ''}`}
                        type="button"
                        style={{ flex: 1 }}
                      >
                        {isSavingVersion ? 'Saving...' : 'Save'}
                      </button>
                    )}
                    <button
                      className={`${styles.actionButton} ${styles.saveNewVersionButton}`}
                      onClick={() => setShowSaveModal(true)}
                      disabled={!editedPrompt.trim()}
                      title="Save current overrides as a new prompt version"
                      type="button"
                      style={{ flex: 1 }}
                    >
                      Save as New
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. Model - collapsible */}
        <div className={styles.editorSection}>
          <button
            className={styles.collapsibleHeader}
            onClick={() => setShowModel(!showModel)}
            type="button"
          >
            <span className={styles.editorLabelText}>
              Model
              {hasModelOverride && <span className={styles.hasContentBadge}>OVERRIDE</span>}
              {!showModel && (
                <span className={styles.transitionLogicMeta}>{currentModel}</span>
              )}
            </span>
            <svg
              className={`${styles.chevron} ${showModel ? styles.expanded : ''}`}
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showModel && (<>
            <div className={styles.modelProviderRow}>
              <div className={styles.modelSection}>
                <label className={styles.selectorLabel}>Model</label>
                <select
                  className={styles.crewSelect}
                  value={currentModel}
                  onChange={handleModelChange}
                >
                  {availableModels.map(model => (
                    <option key={model} value={model}>
                      {model}{model === defaultModel ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.providerSection}>
                <label className={styles.selectorLabel}>Provider</label>
                <select
                  className={styles.crewSelect}
                  value={currentProvider}
                  onChange={handleProviderChange}
                  disabled={AVAILABLE_PROVIDERS.length <= 1}
                >
                  {AVAILABLE_PROVIDERS.map(provider => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>
              {SHOW_FALLBACK_MODEL_UI && (<>
              <div className={styles.providerSection}>
                <label className={styles.selectorLabel}>
                  Fallback Provider{hasFallbackOverride && <span className={styles.hasContentBadge}>OVERRIDE</span>}
                </label>
                <select
                  className={styles.crewSelect}
                  value={currentFallbackProvider}
                  onChange={handleFallbackProviderChange}
                >
                  {AVAILABLE_PROVIDERS.map(provider => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>
              <div className={styles.modelSection}>
                <label className={styles.selectorLabel}>Fallback Model</label>
                <select
                  className={styles.crewSelect}
                  value={currentFallbackModel}
                  onChange={handleFallbackModelChange}
                >
                  {availableFallbackModels.map(model => (
                    <option key={model} value={model}>
                      {model}{model === defaultFallbackModel ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              </>)}
            </div>
            {/* Temperature & Top K sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className={styles.selectorLabel} style={{ margin: 0 }} title="Controls randomness. 0 = deterministic, 0.7 = balanced, 2.0 = very creative/random">
                    Temperature {(temperatureOverrides[selectedCrewId] ?? 0.7).toFixed(1)}
                    {temperatureOverrides[selectedCrewId] != null && (
                      <>
                        <span className={styles.hasContentBadge}>OVERRIDE</span>
                        <button
                          onClick={() => {
                            setTemperatureOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
                            onTemperatureOverride(selectedCrewId, null);
                          }}
                          title="Reset to default"
                          style={{ padding: 0, fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-color)', textDecoration: 'underline', marginLeft: 4 }}
                        >reset</button>
                      </>
                    )}
                  </label>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  className={styles.rangeSlider}
                  value={temperatureOverrides[selectedCrewId] ?? 0.7}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTemperatureOverrides(prev => ({ ...prev, [selectedCrewId]: val }));
                    onTemperatureOverride(selectedCrewId, val);
                  }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className={styles.selectorLabel} style={{ margin: 0 }} title="Limits token selection pool. Lower = more focused, higher = more diverse. Maps to top_p (OpenAI/Google) or top_k (Claude)">
                    Top K / Top P {(topKOverrides[selectedCrewId] ?? 1).toFixed(2)}
                    {topKOverrides[selectedCrewId] != null && (
                      <>
                        <span className={styles.hasContentBadge}>OVERRIDE</span>
                        <button
                          onClick={() => {
                            setTopKOverrides(prev => { const next = { ...prev }; delete next[selectedCrewId]; return next; });
                            onTopKOverride(selectedCrewId, null);
                          }}
                          title="Reset to default"
                          style={{ padding: 0, fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-color)', textDecoration: 'underline', marginLeft: 4 }}
                        >reset</button>
                      </>
                    )}
                  </label>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  className={styles.rangeSlider}
                  value={topKOverrides[selectedCrewId] ?? 1}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTopKOverrides(prev => ({ ...prev, [selectedCrewId]: val }));
                    onTopKOverride(selectedCrewId, val);
                  }}
                />
              </div>
            </div>
          </>)}
        </div>

        {/* 3.5. Theme - collapsible, only shown when agent has themes */}
        {themes && themes.length > 0 && (
          <div className={styles.editorSection}>
            <button
              className={styles.collapsibleHeader}
              onClick={() => setShowThemeSection(!showThemeSection)}
              type="button"
            >
              <span className={styles.editorLabelText}>
                Theme
                {selectedTheme && (
                  <span className={styles.transitionLogicMeta}>{selectedTheme.name}</span>
                )}
              </span>
              <svg
                className={`${styles.chevron} ${showThemeSection ? styles.expanded : ''}`}
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showThemeSection && (
              <div className={styles.themeGrid}>
                {themes.map(theme => (
                  <button
                    key={theme.id}
                    className={`${styles.themeCard} ${selectedTheme?.id === theme.id ? styles.themeCardActive : ''}`}
                    onClick={() => onThemeSelect(theme.id)}
                    type="button"
                  >
                    <img
                      src={theme.logo}
                      alt={theme.name}
                      className={styles.themeLogo}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        const ratio = img.naturalWidth / img.naturalHeight;
                        img.classList.toggle(styles.themeLogoWide, ratio > 2);
                        img.classList.toggle(styles.themeLogoSquare, ratio <= 1.2);
                      }}
                    />
                    <span className={styles.themeName}>{theme.name}</span>
                    <div className={styles.themeColors}>
                      <span className={styles.colorDot} style={{ background: theme.colors.primary }} />
                      <span className={styles.colorDot} style={{ background: theme.colors.secondary }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Knowledge Bases - collapsible */}
        <div className={styles.editorSection}>
          <button
            className={styles.collapsibleHeader}
            onClick={() => setShowKBOverride(!showKBOverride)}
            type="button"
          >
            <span className={styles.editorLabelText}>
              Knowledge Bases
              {kbOverrides[selectedCrewId] !== undefined && JSON.stringify(kbOverrides[selectedCrewId]?.slice().sort()) !== JSON.stringify(originalKBSources.slice().sort()) && (
                <span className={styles.hasContentBadge}>OVERRIDE</span>
              )}
            </span>
            <svg
              className={`${styles.chevron} ${showKBOverride ? styles.expanded : ''}`}
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showKBOverride && (
            <div className={styles.kbSection}>
              {availableKBs.length === 0 && crewKBSources.length === 0 ? (
                <p className={styles.kbNone}>No knowledge bases configured for this crew</p>
              ) : (
                <>
                  <div className={styles.kbCheckboxes}>
                    {availableKBs.map(kb => {
                      const isChecked = activeKBSources.includes(kb.name);
                      const isCrewSource = crewKBSources.includes(kb.name);
                      const providerOk = currentProvider === 'openai'
                        ? kb.vectorStoreId
                        : currentProvider === 'google'
                        ? kb.googleCorpusId
                        : currentProvider === 'anthropic'
                        ? kb.providers?.includes('anthropic')
                        : false;
                      return (
                        <label
                          key={kb.id}
                          className={`${styles.kbCheckboxLabel} ${isCrewSource ? styles.kbCrewSource : ''}`}
                          style={!providerOk ? { opacity: 0.45, pointerEvents: 'none' } : undefined}
                          title={!providerOk ? `This KB is not connected to ${currentProvider}` : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!providerOk}
                            onChange={() => handleKBToggle(kb.name)}
                          />
                          <span>{kb.name}</span>
                          <span className={styles.kbMeta}>
                            {kb.fileCount} files
                          </span>
                          {providerOk ? (
                            <span className={styles.kbOk}>✓ {currentProvider}</span>
                          ) : (
                            <span className={styles.kbWarning}>no {currentProvider}</span>
                          )}
                        </label>
                      );
                    })}
                    {/* Show crew sources not found in DB */}
                    {crewKBSources
                      .filter(name => !availableKBs.find(kb => kb.name === name))
                      .map(name => (
                        <div key={name} className={styles.kbCheckboxLabel}>
                          <input type="checkbox" checked={false} disabled />
                          <span>{name}</span>
                          <span className={styles.kbMissing}>Not found in DB</span>
                        </div>
                      ))
                    }
                  </div>
                  {kbOverrides[selectedCrewId] !== undefined && JSON.stringify(kbOverrides[selectedCrewId]?.slice().sort()) !== JSON.stringify(originalKBSources.slice().sort()) && (
                    <button
                      className={styles.fireNowButton}
                      onClick={() => {
                        setKbOverrides(prev => {
                          const next = { ...prev };
                          delete next[selectedCrewId];
                          return next;
                        });
                        (onKBOverride as (id: string, sources: string[] | null) => void)(selectedCrewId, null);
                      }}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      Clear KB Override
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 5. Prompting - collapsible, default open */}
        {isLoadingPrompts ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>...</div>
            <p className={styles.emptyText}>Loading prompts...</p>
          </div>
        ) : selectedPromptData ? (
          <div className={styles.editorSection}>
            <button
              className={styles.collapsibleHeader}
              onClick={() => setShowPrompting(!showPrompting)}
              type="button"
            >
              <span className={styles.editorLabelText}>
                Prompting
                {isThinkerCrew && <span className={styles.hasContentBadge}>THINKER</span>}
              </span>
              <svg
                className={`${styles.chevron} ${showPrompting ? styles.expanded : ''}`}
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showPrompting && (
              <>
                {/* Agent Persona */}
                <div style={{ padding: '8px 0' }}>
                  <div className={styles.subSectionLabel}>
                    Agent Persona
                    {isPersonaDirty && <span className={styles.hasContentBadge}>OVERRIDE</span>}
                    <button
                      className={styles.expandButton}
                      onClick={() => setShowPersonaModal(true)}
                      title="Open in larger view"
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>
                  </div>
                  <p className={styles.helperText}>
                    Shared persona injected into all crews. Edit to override for this session.
                  </p>
                  <textarea
                    className={`${styles.promptTextarea} ${styles.transitionTextarea} ${isPersonaDirty ? styles.dirty : ''}`}
                    value={editedPersona}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditedPersona(val);
                      if (val !== basePersona) {
                        onPersonaOverride(val);
                      } else {
                        onPersonaOverride(null);
                      }
                    }}
                    placeholder="No persona defined for this agent."
                    spellCheck={false}
                    rows={6}
                  />
                  <div className={styles.transitionActions}>
                    <span className={styles.charCount}>
                      {editedPersona.length} chars
                    </span>
                    {isPersonaDirty && (
                      <button
                        className={styles.fireNowButton}
                        onClick={() => {
                          setEditedPersona(basePersona);
                          onPersonaOverride(basePersona !== codePersona ? basePersona : null);
                        }}
                        title="Clear persona override and revert to code default"
                        type="button"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                        Revert to Code
                      </button>
                    )}
                  </div>
                </div>

                {/* Guidance (renamed from Prompt Content) */}
                <div style={{ padding: '8px 0' }}>
                  <div className={styles.subSectionLabel}>
                    Guidance
                    {isMainDirty && <span className={styles.hasContentBadge}>OVERRIDE</span>}
                    <button
                      className={styles.expandButton}
                      onClick={() => setShowPromptModal(true)}
                      title="Open in larger view"
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>
                  </div>
                  <textarea
                    className={`${styles.promptTextarea} ${isMainDirty ? styles.dirty : ''}`}
                    value={editedPrompt}
                    onChange={handlePromptChange}
                    placeholder="Enter the crew member's guidance..."
                    spellCheck={false}
                  />
                  <div className={styles.transitionActions}>
                    <span className={styles.charCount}>
                      {editedPrompt.length} chars
                    </span>
                    {isMainDirty && (
                      <button
                        className={styles.fireNowButton}
                        onClick={() => {
                          setEditedPrompt(originalPrompt);
                          setSessionOverrides(prev => {
                            const next = { ...prev };
                            delete next[selectedCrewId];
                            return next;
                          });
                          onSessionOverride(selectedCrewId, '');
                        }}
                        title="Clear prompt override and revert to base version"
                        type="button"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                        Revert to Code
                      </button>
                    )}
                  </div>
                </div>

                {/* Thinking Prompt (only for thinker crews - editable for session override) */}
                {isThinkerCrew && codeThinkingPrompt && (() => {
                  const editedThinking = thinkingPromptOverrides[selectedCrewId] ?? codeThinkingPrompt;
                  const isThinkingDirty = editedThinking !== originalThinkingPrompt;
                  const isDisabled = thinkerDisabled[selectedCrewId] || false;
                  return (
                    <div style={{ padding: '8px 0' }}>
                      <div className={styles.subSectionLabel}>
                        Thinking Prompt
                        {isThinkingDirty && <span className={styles.hasContentBadge}>OVERRIDE</span>}
                        {isDisabled && <span className={styles.hasContentBadge} style={{ background: '#ef4444' }}>DISABLED</span>}
                        <button
                          className={styles.expandButton}
                          onClick={() => setShowThinkingModal(true)}
                          title="Open in larger view"
                          type="button"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </svg>
                        </button>
                      </div>
                      <div className={styles.thinkerControls}>
                        <label className={styles.thinkerToggle}>
                          <input
                            type="checkbox"
                            checked={!isDisabled}
                            onChange={() => onThinkerDisabledToggle(selectedCrewId, !isDisabled)}
                          />
                          <span>Thinker {isDisabled ? 'off' : 'on'}</span>
                        </label>
                        <select
                          className={`${styles.modelSelect} ${thinkingModelOverrides[selectedCrewId] ? styles.modelOverride : ''}`}
                          value={thinkingModelOverrides[selectedCrewId] || selectedCrewMember?.thinkingModel || 'claude-sonnet-4-6'}
                          onChange={(e) => {
                            const val = e.target.value;
                            const defaultThinkerModel = selectedCrewMember?.thinkingModel || 'claude-sonnet-4-6';
                            setThinkingModelOverrides(prev => ({ ...prev, [selectedCrewId]: val }));
                            onThinkingModelOverride(selectedCrewId, val === defaultThinkerModel ? '' : val);
                          }}
                        >
                          {[...ANTHROPIC_MODELS, ...OPENAI_MODELS, ...GOOGLE_MODELS].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        className={`${styles.promptTextarea} ${styles.transitionTextarea} ${isThinkingDirty ? styles.dirty : ''}`}
                        value={editedThinking}
                        onChange={(e) => {
                          const val = e.target.value;
                          setThinkingPromptOverrides(prev => ({ ...prev, [selectedCrewId]: val }));
                          if (val !== codeThinkingPrompt) {
                            onThinkingPromptOverride(selectedCrewId, val);
                          } else {
                            onThinkingPromptOverride(selectedCrewId, '');
                          }
                        }}
                        spellCheck={false}
                        rows={8}
                      />
                      <div className={styles.transitionActions}>
                        <span className={styles.charCount}>
                          {editedThinking.length} chars
                        </span>
                        {isThinkingDirty && (
                          <button
                            className={styles.fireNowButton}
                            onClick={() => {
                              setThinkingPromptOverrides(prev => ({ ...prev, [selectedCrewId]: originalThinkingPrompt }));
                              onThinkingPromptOverride(selectedCrewId, originalThinkingPrompt !== codeThinkingPrompt ? originalThinkingPrompt : '');
                            }}
                            title="Revert thinking prompt"
                            type="button"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 3v5h5" />
                            </svg>
                            Revert
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Transition System Message */}
                <div style={{ padding: '8px 0' }}>
                  <div className={styles.subSectionLabel}>
                    Transition System Message
                    {editedTransitionPrompt && <span className={styles.hasContentBadge}>SET</span>}
                  </div>
                  <p className={styles.helperText}>
                    Injected once when transitioning to this crew. Uses &apos;developer&apos; role for highest authority.
                  </p>
                  <textarea
                    className={`${styles.promptTextarea} ${styles.transitionTextarea} ${isTransitionDirty ? styles.dirty : ''}`}
                    value={editedTransitionPrompt}
                    onChange={(e) => setEditedTransitionPrompt(e.target.value)}
                    placeholder="e.g., [CONTEXT SWITCH] Your role has changed. Disregard previous conversation patterns..."
                    spellCheck={false}
                    rows={4}
                  />
                  <div className={styles.transitionActions}>
                    <span className={styles.charCount}>
                      {editedTransitionPrompt.length} chars
                    </span>
                    {onFireTransitionPrompt && (
                      <button
                        className={styles.fireNowButton}
                        onClick={async () => {
                          if (!editedTransitionPrompt.trim()) return;
                          setIsFiring(true);
                          try {
                            await onFireTransitionPrompt(editedTransitionPrompt, selectedCrewId);
                            setStatus({ type: 'success', message: 'Transition prompt injected into chat!' });
                          } catch {
                            setStatus({ type: 'error', message: 'Failed to inject prompt' });
                          } finally {
                            setIsFiring(false);
                          }
                        }}
                        disabled={!editedTransitionPrompt.trim() || isFiring}
                        title="Inject this prompt into the conversation now (for testing)"
                        type="button"
                      >
                        {isFiring ? (
                          'Firing...'
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            Fire Now
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Transition Logic (opens modal) */}
                <div style={{ padding: '4px 0' }}>
                  <button
                    className={styles.transitionLogicButton}
                    onClick={() => setShowTransitionLogicModal(true)}
                    disabled={!transitionLogic && !isLoadingTransitionLogic}
                    type="button"
                  >
                    <div className={styles.transitionLogicButtonContent}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 3 21 3 21 8" />
                        <line x1="4" y1="20" x2="21" y2="3" />
                        <polyline points="21 16 21 21 16 21" />
                        <line x1="15" y1="15" x2="21" y2="21" />
                        <line x1="4" y1="4" x2="9" y2="9" />
                      </svg>
                      <span>Transition Logic</span>
                      {isLoadingTransitionLogic ? (
                        <span className={styles.transitionLogicMeta}>Loading...</span>
                      ) : transitionLogic ? (
                        <span className={styles.transitionLogicMeta}>
                          {transitionLogic.transitionTo ? `\u2192 ${transitionLogic.transitionTo}` : 'No target'}
                          {transitionLogic.hasStructuredRules ? ' (rules)' : ' (code)'}
                        </span>
                      ) : (
                        <span className={styles.transitionLogicMeta}>No transitions</span>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>no data</div>
            <p className={styles.emptyText}>
              No prompt data available for this crew member.
              <br />
              Select a different crew member or check the server.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons - Revert */}
      <div className={styles.actionsSection}>
        <div className={styles.actionButtons}>
          <button
            className={`${styles.actionButton} ${styles.revertButton}`}
            onClick={handleRevert}
            disabled={!isDirty && !hasSessionOverride && !hasModelOverride}
            title="Discard changes and reload original prompt"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Revert All
          </button>
        </div>

        {/* Status Message */}
        {status.type && (
          <div className={`${styles.statusMessage} ${styles[status.type]}`}>
            {status.type === 'success' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {status.type === 'error' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {status.type === 'info' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
            {status.message}
          </div>
        )}
      </div>

      {/* Transition Logic Modal */}
      {showTransitionLogicModal && transitionLogic && (
        <div className={styles.modalOverlay} onClick={() => setShowTransitionLogicModal(false)}>
          <div className={`${styles.modal} ${styles.transitionLogicModal}`} dir="ltr" onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>
                Transition Logic
                <span className={styles.tlCrewName}>{selectedCrewId}</span>
              </h4>
              <button
                className={styles.modalCloseButton}
                onClick={() => setShowTransitionLogicModal(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.tlMetaRow}>
                <span className={styles.tlMetaLabel}>Target:</span>
                <strong>{transitionLogic.transitionTo || 'none'}</strong>
                {transitionLogic.oneShot && <span className={styles.tlTag}>oneShot</span>}
                {transitionLogic.hasPreTransfer && <span className={styles.tlTag}>pre</span>}
                {transitionLogic.hasPostTransfer && <span className={styles.tlTag}>post</span>}
              </div>
              {transitionLogic.hasStructuredRules && transitionLogic.ruleDefinitions && (
                <>
                  {transitionLogic.ruleDefinitions.pre.length > 0 && (
                    <div className={styles.tlSection}>
                      <div className={styles.tlSectionLabel}>preMessageTransfer</div>
                      {transitionLogic.ruleDefinitions.pre.map(rule => (
                        <div key={rule.id} className={styles.tlRule}>
                          <span className={styles.tlRuleDesc}>{rule.description}</span>
                          {rule.fields.length > 0 && (
                            <span className={styles.tlRuleFields}>({rule.fields.join(', ')})</span>
                          )}
                          {rule.result?.target && (
                            <span className={styles.tlRuleTarget}>{'\u2192'} {rule.result.target}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {transitionLogic.ruleDefinitions.post.length > 0 && (
                    <div className={styles.tlSection}>
                      <div className={styles.tlSectionLabel}>postMessageTransfer</div>
                      {transitionLogic.ruleDefinitions.post.map(rule => (
                        <div key={rule.id} className={styles.tlRule}>
                          <span className={styles.tlRuleDesc}>{rule.description}</span>
                          {rule.fields.length > 0 && (
                            <span className={styles.tlRuleFields}>({rule.fields.join(', ')})</span>
                          )}
                          {rule.result?.target && (
                            <span className={styles.tlRuleTarget}>{'\u2192'} {rule.result.target}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {!transitionLogic.hasStructuredRules && transitionLogic.rawCode && (
                <>
                  {transitionLogic.rawCode.pre && (
                    <div className={styles.tlSection}>
                      <div className={styles.tlSectionLabel}>preMessageTransfer</div>
                      <pre className={styles.tlCodeBlock}>{transitionLogic.rawCode.pre}</pre>
                    </div>
                  )}
                  {transitionLogic.rawCode.post && (
                    <div className={styles.tlSection}>
                      <div className={styles.tlSectionLabel}>postMessageTransfer</div>
                      <pre className={styles.tlCodeBlock}>{transitionLogic.rawCode.post}</pre>
                    </div>
                  )}
                </>
              )}
              {transitionLogic.oneShot && !transitionLogic.hasPreTransfer && !transitionLogic.hasPostTransfer && (
                <div className={styles.tlSection}>
                  <div className={styles.tlSectionLabel}>oneShot</div>
                  <pre className={styles.tlCodeBlock}>Delivers one response, then auto-transitions to &quot;{transitionLogic.transitionTo}&quot; on next message.</pre>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                className={`${styles.actionButton} ${styles.revertButton}`}
                onClick={() => setShowTransitionLogicModal(false)}
                style={{ flex: 'none' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guidance Enlarge Modal */}
      {showPromptModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPromptModal(false)}>
          <div className={`${styles.modal} ${styles.promptModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>
                Guidance
                <span className={styles.tlCrewName}>
                  {selectedCrewMember?.displayName || selectedCrewId}
                </span>
              </h4>
              <button
                className={styles.modalCloseButton}
                onClick={() => setShowPromptModal(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <textarea
                className={`${styles.promptModalTextarea} ${isMainDirty ? styles.dirty : ''}`}
                value={editedPrompt}
                onChange={handlePromptChange}
                placeholder="Enter the crew member's guidance..."
                spellCheck={false}
                autoFocus
              />
            </div>
            <div className={styles.promptModalFooter}>
              <span className={styles.charCount}>
                {editedPrompt.length} chars
                {isMainDirty && (
                  <span className={styles.sessionOverrideBadge} style={{ marginLeft: '8px' }}>
                    OVERRIDE
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {isMainDirty && (
                  <button
                    className={`${styles.actionButton} ${styles.revertButton}`}
                    onClick={() => {
                      setEditedPrompt(originalPrompt);
                      setSessionOverrides(prev => {
                        const next = { ...prev };
                        delete next[selectedCrewId];
                        return next;
                      });
                      onSessionOverride(selectedCrewId, '');
                    }}
                    style={{ flex: 'none' }}
                  >
                    Revert to Code
                  </button>
                )}
                <button
                  className={`${styles.actionButton} ${styles.revertButton}`}
                  onClick={() => setShowPromptModal(false)}
                  style={{ flex: 'none' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thinking Prompt Enlarge Modal */}
      {showThinkingModal && isThinkerCrew && codeThinkingPrompt && (() => {
        const editedThinking = thinkingPromptOverrides[selectedCrewId] ?? codeThinkingPrompt;
        const isThinkingDirty = editedThinking !== originalThinkingPrompt;
        return (
          <div className={styles.modalOverlay} onClick={() => setShowThinkingModal(false)}>
            <div className={`${styles.modal} ${styles.promptModal}`} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h4>
                  Thinking Prompt
                  <span className={styles.tlCrewName}>
                    {selectedCrewMember?.displayName || selectedCrewId}
                  </span>
                </h4>
                <button
                  className={styles.modalCloseButton}
                  onClick={() => setShowThinkingModal(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className={styles.modalBody}>
                <textarea
                  className={`${styles.promptModalTextarea} ${isThinkingDirty ? styles.dirty : ''}`}
                  value={editedThinking}
                  onChange={(e) => {
                    const val = e.target.value;
                    setThinkingPromptOverrides(prev => ({ ...prev, [selectedCrewId]: val }));
                    if (val !== codeThinkingPrompt) {
                      onThinkingPromptOverride(selectedCrewId, val);
                    } else {
                      onThinkingPromptOverride(selectedCrewId, '');
                    }
                  }}
                  spellCheck={false}
                  autoFocus
                />
              </div>
              <div className={styles.promptModalFooter}>
                <span className={styles.charCount}>
                  {editedThinking.length} chars
                  {isThinkingDirty && (
                    <span className={styles.sessionOverrideBadge} style={{ marginLeft: '8px' }}>
                      OVERRIDE
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isThinkingDirty && (
                    <button
                      className={`${styles.actionButton} ${styles.revertButton}`}
                      onClick={() => {
                        setThinkingPromptOverrides(prev => ({ ...prev, [selectedCrewId]: originalThinkingPrompt }));
                        onThinkingPromptOverride(selectedCrewId, originalThinkingPrompt !== codeThinkingPrompt ? originalThinkingPrompt : '');
                      }}
                      style={{ flex: 'none' }}
                    >
                      Revert
                    </button>
                  )}
                  <button
                    className={`${styles.actionButton} ${styles.revertButton}`}
                    onClick={() => setShowThinkingModal(false)}
                    style={{ flex: 'none' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Persona Enlarge Modal */}
      {showPersonaModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPersonaModal(false)}>
          <div className={`${styles.modal} ${styles.promptModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>Agent Persona</h4>
              <button
                className={styles.modalCloseButton}
                onClick={() => setShowPersonaModal(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <textarea
                className={`${styles.promptModalTextarea} ${isPersonaDirty ? styles.dirty : ''}`}
                value={editedPersona}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditedPersona(val);
                  if (val !== basePersona) {
                    onPersonaOverride(val);
                  } else {
                    onPersonaOverride(null);
                  }
                }}
                placeholder="No persona defined for this agent."
                spellCheck={false}
                autoFocus
              />
            </div>
            <div className={styles.promptModalFooter}>
              <span className={styles.charCount}>
                {editedPersona.length} chars
                {isPersonaDirty && (
                  <span className={styles.sessionOverrideBadge} style={{ marginLeft: '8px' }}>
                    OVERRIDE
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {isPersonaDirty && (
                  <button
                    className={`${styles.actionButton} ${styles.revertButton}`}
                    onClick={() => {
                      setEditedPersona(codePersona);
                      onPersonaOverride(null);
                    }}
                    style={{ flex: 'none' }}
                  >
                    Revert to Code
                  </button>
                )}
                <button
                  className={`${styles.actionButton} ${styles.revertButton}`}
                  onClick={() => setShowPersonaModal(false)}
                  style={{ flex: 'none' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
