/**
 * CrewPlayground Component
 *
 * Two-panel layout:
 * - Left: Design chat OR Config editor (toggled)
 * - Right: Test chat (always visible)
 * Either panel can be collapsed to give full width to the other.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useChat } from '../../../hooks/useChat';
import { getKnowledgeBases } from '../../../services/kbService';
import { ChatContext } from '../../../context/ChatContext';
import { LanguageContext } from '../../../context/LanguageContext';
import { Message } from '../../chat/Message';
import { ThinkingIndicator } from '../../chat/ThinkingIndicator';
import {
  designChat,
  registerPlayground,
  removePlayground,
  saveConfig,
  listSavedConfigs,
  loadSavedConfig,
  deleteSavedConfig,
  exportToCrewFile,
} from '../../../services/playgroundService';
import type {
  PlaygroundConfig,
  PlaygroundMode,
  DesignMessage,
  MockTool,
  SavedPlaygroundConfig,
  ToolCallLog,
} from '../../../types/playground';
import type { AgentConfig, KnowledgeBase } from '../../../types';
import styles from './CrewPlayground.module.css';

interface CrewPlaygroundProps {
  agentName: string;
  baseURL: string;
}

type LeftTab = 'design' | 'config';

const DEFAULT_CONFIG: PlaygroundConfig = {
  displayName: '',
  description: '',
  mode: 'simple',
  model: 'gpt-4o',
  guidance: '',
  thinkingPrompt: '',
  thinkingModel: 'claude-sonnet-4-20250514',
  persona: '',
  kbSources: [],
  tools: [],
  context: {},
  maxTokens: 2048,
};

const MODEL_OPTIONS = [
  { group: 'OpenAI', models: [
    { label: 'GPT-5', value: 'gpt-5-chat-latest' },
    { label: 'GPT-4o', value: 'gpt-4o' },
  ]},
  { group: 'Anthropic', models: [
    { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
  ]},
  { group: 'Google', models: [
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  ]},
];

export function CrewPlayground({ agentName, baseURL }: CrewPlaygroundProps) {
  // Left tab: design or config
  const [leftTab, setLeftTab] = useState<LeftTab>('design');

  // Panel collapse state
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Draggable split ratio (percentage for left panel, 20-80 range)
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const panelsRef = useRef<HTMLDivElement>(null);

  // Design chat
  const [designMessages, setDesignMessages] = useState<DesignMessage[]>([]);
  const [designInput, setDesignInput] = useState('');
  const [isDesigning, setIsDesigning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Config
  const [config, setConfig] = useState<PlaygroundConfig>(DEFAULT_CONFIG);

  // Session
  const [sessionId] = useState(() => crypto.randomUUID().slice(0, 8));
  const [registeredSession, setRegisteredSession] = useState<{ crewName: string; agentName: string } | null>(null);
  const [activatedConfig, setActivatedConfig] = useState<PlaygroundConfig | null>(null);

  // Test chat
  const [testConversationId, setTestConversationId] = useState(() => `playground-${sessionId}`);
  const [toolCallLogs, setToolCallLogs] = useState<ToolCallLog[]>([]);

  // Save/load
  const [savedConfigs, setSavedConfigs] = useState<SavedPlaygroundConfig[]>([]);
  const [showSavedConfigs, setShowSavedConfigs] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Status
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Available KBs
  const [availableKBs, setAvailableKBs] = useState<KnowledgeBase[]>([]);

  // Modal editor
  const [modalEditor, setModalEditor] = useState<{ title: string; value: string; field: string; isJson?: boolean } | null>(null);

  // Debug mode
  const [debugMode, setDebugMode] = useState(false);

  // Config dirty check — true when config changed since last activation
  const configDirty = registeredSession !== null && activatedConfig !== null &&
    JSON.stringify(config) !== JSON.stringify(activatedConfig);

  // Refs
  const designMessagesRef = useRef<HTMLDivElement>(null);
  const testMessagesRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // useChat for test panel
  const testAgentConfig: AgentConfig = {
    agentName,
    displayName: config.displayName || 'Playground',
    baseURL,
    logo: { src: '', alt: '' },
    storagePrefix: 'playground',
    welcomeMessage: '',
  };

  const testChat = useChat({
    config: testAgentConfig,
    conversationId: testConversationId,
    userId: null,
    useKnowledgeBase: config.kbSources.length > 0,
    overrideCrewMember: registeredSession?.crewName || null,
    debug: debugMode,
    onCrewInfo: () => {},
    onFieldExtracted: () => {},
  });

  // ========== EFFECTS ==========

  useEffect(() => {
    if (designMessagesRef.current) designMessagesRef.current.scrollTop = designMessagesRef.current.scrollHeight;
  }, [designMessages, isDesigning, isGenerating]);

  useEffect(() => {
    if (testMessagesRef.current) testMessagesRef.current.scrollTop = testMessagesRef.current.scrollHeight;
  }, [testChat.messages, testChat.isLoading]);

  useEffect(() => {
    getKnowledgeBases(agentName, baseURL).then(setAvailableKBs).catch(() => {});
  }, [agentName, baseURL]);

  useEffect(() => {
    return () => { removePlayground(sessionId, baseURL).catch(() => {}); };
  }, [sessionId, baseURL]);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  useEffect(() => {
    if (!showSavedConfigs) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowSavedConfigs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSavedConfigs]);

  // Drag to resize panels
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!panelsRef.current) return;
      const rect = panelsRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.round((x / rect.width) * 100);
      setSplitRatio(Math.max(20, Math.min(80, pct)));
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // ========== DESIGN CHAT ==========

  const apiMessages = useCallback((msgs: DesignMessage[]) => msgs.filter(m => m.role !== 'system'), []);

  const handleDesignSend = useCallback(async () => {
    const text = designInput.trim();
    if (!text || isDesigning) return;
    const newMessages: DesignMessage[] = [...designMessages, { role: 'user', content: text }];
    setDesignMessages(newMessages);
    setDesignInput('');
    setIsDesigning(true);
    try {
      const result = await designChat(apiMessages(newMessages), config.guidance ? config : null, 'discuss', baseURL);
      setDesignMessages([...newMessages, { role: 'assistant', content: result.response }]);
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Design chat failed: ${(err as Error).message}` });
    } finally {
      setIsDesigning(false);
    }
  }, [designInput, designMessages, config, baseURL, isDesigning, apiMessages]);

  const handleGenerate = useCallback(async () => {
    if (isGenerating || designMessages.length === 0) return;
    setIsGenerating(true);
    try {
      const result = await designChat(apiMessages(designMessages), config.guidance ? config : null, 'generate', baseURL);
      setDesignMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
      if (result.updatedConfig) {
        const newConfig = { ...DEFAULT_CONFIG, ...result.updatedConfig };
        setConfig(newConfig);
        await doRegister(newConfig);
        setStatusMessage({ type: 'success', text: 'Crew generated and activated! Try it in the chat.' });
      } else {
        setStatusMessage({ type: 'error', text: 'Could not extract config from response. Try again.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Generation failed: ${(err as Error).message}` });
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, designMessages, config, baseURL]);

  // ========== REGISTER ==========

  const doRegister = useCallback(async (cfg: PlaygroundConfig) => {
    // Filter out any kbSources that don't exist in the real KB list
    const realKBIds = new Set(availableKBs.filter(kb => kb.vectorStoreId).map(kb => kb.vectorStoreId));
    const filteredConfig = {
      ...cfg,
      kbSources: cfg.kbSources.filter(s => realKBIds.has(s.vectorStoreId)),
    };
    try {
      const registration = await registerPlayground(sessionId, agentName, filteredConfig, baseURL);
      setRegisteredSession(registration);
      setActivatedConfig({ ...filteredConfig });
      // Update config if we filtered anything
      if (filteredConfig.kbSources.length !== cfg.kbSources.length) {
        setConfig(filteredConfig);
      }
      // Only create a new conversation if there isn't one yet
      if (!testConversationId || !testChat.messages.length) {
        const newTestId = `playground-${sessionId}-${Date.now()}`;
        setTestConversationId(newTestId);
        testChat.newChat(newTestId);
        setToolCallLogs([]);
      }
      return registration;
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Activation failed: ${(err as Error).message}` });
      return null;
    }
  }, [sessionId, agentName, baseURL, testChat, availableKBs, testConversationId]);

  const handleApplyConfig = useCallback(async () => {
    if (!config.guidance) { setStatusMessage({ type: 'error', text: 'Guidance is required.' }); return; }
    await doRegister(config);
    setStatusMessage({ type: 'success', text: 'Crew activated! Try it in the chat.' });
  }, [config, doRegister]);

  const updateConfig = useCallback((field: keyof PlaygroundConfig, value: unknown) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  // ========== TEST CHAT ==========

  const handleTestSend = useCallback(async (text: string) => {
    if (!registeredSession) { setStatusMessage({ type: 'error', text: 'Apply config first.' }); return; }
    await testChat.sendMessage(text);
  }, [registeredSession, testChat]);

  // ========== SAVE / LOAD / EXPORT ==========

  const handleSave = useCallback(async () => {
    if (!saveName.trim() || !config.guidance) return;
    try {
      await saveConfig(agentName, saveName.trim(), config, baseURL);
      setShowSaveDialog(false);
      setSaveName('');
      setStatusMessage({ type: 'success', text: 'Config saved!' });
    } catch (err) { setStatusMessage({ type: 'error', text: `Save failed: ${(err as Error).message}` }); }
  }, [saveName, config, agentName, baseURL]);

  const handleLoadConfigs = useCallback(async () => {
    if (showSavedConfigs) { setShowSavedConfigs(false); return; }
    try {
      const result = await listSavedConfigs(agentName, baseURL);
      setSavedConfigs(result.configs);
      setShowSavedConfigs(true);
    } catch (err) { setStatusMessage({ type: 'error', text: `Load failed: ${(err as Error).message}` }); }
  }, [agentName, baseURL, showSavedConfigs]);

  const handleLoadConfig = useCallback(async (id: string) => {
    try {
      const result = await loadSavedConfig(agentName, id, baseURL);
      const loadedConfig = { ...DEFAULT_CONFIG, ...result.config };
      // Filter kbSources against real KBs
      const realKBIds = new Set(availableKBs.filter(kb => kb.vectorStoreId).map(kb => kb.vectorStoreId));
      loadedConfig.kbSources = loadedConfig.kbSources.filter((s: { vectorStoreId: string }) => realKBIds.has(s.vectorStoreId));
      setConfig(loadedConfig);
      setShowSavedConfigs(false);
      await doRegister(loadedConfig);
      setDesignMessages(prev => [...prev, {
        role: 'system' as const,
        content: `Loaded "${result.name}" — ${loadedConfig.displayName || 'Unnamed'} (${loadedConfig.mode}, ${loadedConfig.model})`,
      }]);
      setStatusMessage({ type: 'success', text: `Loaded "${result.name}"` });
    } catch (err) { setStatusMessage({ type: 'error', text: `Load failed: ${(err as Error).message}` }); }
  }, [agentName, baseURL, doRegister, availableKBs]);

  const handleDeleteConfig = useCallback(async (id: string) => {
    try { await deleteSavedConfig(agentName, id, baseURL); setSavedConfigs(prev => prev.filter(c => c.id !== id)); }
    catch (err) { setStatusMessage({ type: 'error', text: `Delete failed: ${(err as Error).message}` }); }
  }, [agentName, baseURL]);

  const handleExport = useCallback(async () => {
    if (!config.guidance) return;
    try {
      const result = await exportToCrewFile(config, baseURL);
      const blob = new Blob([result.source], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(config.displayName || 'playground').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.crew.js`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: 'File exported!' });
    } catch (err) { setStatusMessage({ type: 'error', text: `Export failed: ${(err as Error).message}` }); }
  }, [config, baseURL]);

  // ========== RESET ==========

  const handleResetChat = useCallback(() => {
    const newTestId = `playground-${sessionId}-${Date.now()}`;
    setTestConversationId(newTestId);
    testChat.newChat(newTestId);
    setToolCallLogs([]);
  }, [sessionId, testChat]);

  const handleResetAll = useCallback(() => {
    setDesignMessages([]);
    setConfig(DEFAULT_CONFIG);
    setRegisteredSession(null);
    setActivatedConfig(null);
    setToolCallLogs([]);
    setLeftTab('design');
    removePlayground(sessionId, baseURL).catch(() => {});
    const newTestId = `playground-${sessionId}-${Date.now()}`;
    setTestConversationId(newTestId);
    testChat.newChat(newTestId);
  }, [sessionId, baseURL, testChat]);

  // ========== MOCK RESPONSE ==========

  const handleMockResponseSave = useCallback((toolName: string, newMockResponse: string) => {
    try {
      const parsed = JSON.parse(newMockResponse);
      const updatedTools = config.tools.map(t => t.name === toolName ? { ...t, mockResponse: parsed } : t);
      const newConfig = { ...config, tools: updatedTools };
      setConfig(newConfig);
      registerPlayground(sessionId, agentName, newConfig, baseURL).then(reg => setRegisteredSession(reg)).catch(() => {});
      setStatusMessage({ type: 'success', text: `Mock response updated.` });
    } catch { setStatusMessage({ type: 'error', text: 'Invalid JSON.' }); }
  }, [config, sessionId, agentName, baseURL]);

  // ========== MODAL EDITOR ==========

  const handleModalSave = useCallback(() => {
    if (!modalEditor) return;
    const { field, value } = modalEditor;
    updateConfig(field as keyof PlaygroundConfig, value);
    setModalEditor(null);
  }, [modalEditor, updateConfig]);

  const openEnlargeEditor = useCallback((title: string, field: keyof PlaygroundConfig, isJson = false) => {
    const val = config[field];
    const strVal = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    setModalEditor({ title, value: strVal, field, isJson });
  }, [config]);

  // ========== TOOL EDITING ==========

  const updateTool = useCallback((index: number, updates: Partial<MockTool>) => {
    const updated = [...config.tools];
    updated[index] = { ...updated[index], ...updates };
    updateConfig('tools', updated);
  }, [config.tools, updateConfig]);

  const removeTool = useCallback((index: number) => {
    updateConfig('tools', config.tools.filter((_, j) => j !== index));
  }, [config.tools, updateConfig]);

  const addTool = useCallback(() => {
    updateConfig('tools', [...config.tools, {
      name: `tool_${config.tools.length + 1}`,
      description: '',
      parameters: { type: 'object', properties: {} },
      mockResponse: {},
    } as MockTool]);
  }, [config.tools, updateConfig]);

  // ========== RENDER ==========

  const hasConfig = !!config.guidance;
  const leftPanelClass = leftCollapsed ? styles.leftPanelCollapsed : rightCollapsed ? styles.leftPanelFull : styles.leftPanel;
  const rightPanelClass = rightCollapsed ? styles.rightPanelCollapsed : leftCollapsed ? styles.rightPanelFull : styles.rightPanel;
  const leftPanelStyle = (!leftCollapsed && !rightCollapsed) ? { width: `${splitRatio}%` } : undefined;

  return (
    <div className={styles.container}>
      {/* ===== TOP BAR ===== */}
      <div className={styles.topBar}>
        <span className={styles.topBarTitle}>Crew Playground</span>
        <div className={styles.topBarSeparator} />

        <div className={styles.topBarActions}>
          <button className={styles.actionButton} onClick={() => setDesignMessages([])}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            New Design
          </button>

          <div className={styles.dropdownWrapper} ref={dropdownRef}>
            <button className={styles.actionButton} onClick={handleLoadConfigs}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Load
            </button>
            {showSavedConfigs && (
              <div className={styles.savedConfigsList}>
                {savedConfigs.length === 0 ? (
                  <div className={styles.savedConfigItem}><div className={styles.savedConfigDate}>No saved configs</div></div>
                ) : savedConfigs.map(sc => (
                  <div key={sc.id} className={styles.savedConfigItem}>
                    <div onClick={() => handleLoadConfig(sc.id)} style={{ flex: 1, cursor: 'pointer' }}>
                      <div className={styles.savedConfigName}>{sc.name}</div>
                      <div className={styles.savedConfigDate}>{new Date(sc.savedAt).toLocaleDateString()}</div>
                    </div>
                    <button className={styles.savedConfigDelete} onClick={(e) => { e.stopPropagation(); handleDeleteConfig(sc.id); }}>&#x2715;</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className={styles.actionButton} onClick={() => { setSaveName(config.displayName || ''); setShowSaveDialog(true); }} disabled={!hasConfig}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save
          </button>

          <button className={styles.actionButton} onClick={handleExport} disabled={!hasConfig}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>

          <button className={styles.actionButton} onClick={handleResetAll}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
            Reset
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`${styles.statusMessage} ${statusMessage.type === 'success' ? styles.statusSuccess : styles.statusError}`}>
          {statusMessage.text}
        </div>
      )}

      {/* ===== MAIN PANELS ===== */}
      <div className={styles.panels} ref={panelsRef}>

        {/* ===== LEFT PANEL ===== */}
        <div className={leftPanelClass} style={leftPanelStyle}>
          {!leftCollapsed && (
            <>
              {/* Shared left panel header */}
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 013.54-2.12l.06.06A1.65 1.65 0 009 4.68 1.65 1.65 0 0010 3.17V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                  Configuration
                </span>
                <div className={styles.panelHeaderRight}>
                  <div className={styles.modeToggle}>
                    <button className={`${styles.modeButton} ${leftTab === 'design' ? styles.modeButtonActive : ''}`} onClick={() => setLeftTab('design')}>
                      Design AI
                    </button>
                    <button className={`${styles.modeButton} ${leftTab === 'config' ? styles.modeButtonActive : ''}`} onClick={() => setLeftTab('config')}>
                      Config
                    </button>
                  </div>
                  <button className={`${styles.actionButton} ${styles.actionButtonPrimary}`} onClick={handleApplyConfig} disabled={!config.guidance}>
                    Activate
                  </button>
                  {registeredSession && !configDirty && <span className={styles.registeredBadge}>Active</span>}
                  {configDirty && <span className={`${styles.registeredBadge} ${styles.dirtyBadge}`}>Config Changed</span>}
                </div>
              </div>

              {leftTab === 'design' ? (
              /* --- DESIGN CHAT --- */
              <>
                <div className={styles.chatMessages} ref={designMessagesRef}>
                  {designMessages.length === 0 ? (
                    <div className={styles.chatEmpty}>
                      <svg className={styles.chatEmptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                      <h3 className={styles.chatEmptyTitle}>Design Your Crew</h3>
                      <p className={styles.chatEmptyText}>
                        Describe the AI assistant you want to create. Claude will help you design it. When ready, click Generate.
                      </p>
                    </div>
                  ) : (
                    designMessages.map((msg, i) => (
                      <div key={i} className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : msg.role === 'system' ? styles.messageSystem : styles.messageAssistant}`}>
                        {msg.role !== 'system' && <span className={styles.messageLabel}>{msg.role === 'user' ? 'You' : 'Claude'}</span>}
                        <div className={`${styles.messageBubble} ${msg.role === 'user' ? styles.messageBubbleUser : msg.role === 'system' ? styles.messageBubbleSystem : styles.messageBubbleAssistant}`}>
                          {msg.role === 'assistant' ? <FormattedMessage content={msg.content} /> : msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {isDesigning && <div className={styles.thinkingIndicator}><div className={styles.thinkingDots}><span /><span /><span /></div>Claude is thinking...</div>}
                </div>

                {isGenerating && <div className={styles.generatingBanner}><div className={styles.spinner} /> Generating crew configuration...</div>}

                <div className={styles.chatInputArea}>
                  <textarea
                    className={styles.chatInput}
                    value={designInput}
                    onChange={e => setDesignInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDesignSend(); } }}
                    placeholder="Describe the crew member you want to create..."
                    disabled={isDesigning || isGenerating}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button className={styles.sendButton} onClick={handleDesignSend} disabled={!designInput.trim() || isDesigning || isGenerating}>Send</button>
                    {designMessages.length > 0 && (
                      <button className={`${styles.sendButton} ${styles.generateButton}`} onClick={handleGenerate} disabled={isDesigning || isGenerating}>Generate</button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* --- CONFIG EDITOR --- */

                <div className={styles.configEditor}>
                  {/* Basics */}
                  <ConfigSection title="Basics" defaultOpen>
                    <div className={styles.configFieldRow}>
                      <div className={styles.configField}>
                        <label className={styles.configFieldLabel}>Display Name</label>
                        <input className={styles.configFieldInput} value={config.displayName} onChange={e => updateConfig('displayName', e.target.value)} placeholder="My Assistant" />
                      </div>
                      <div className={styles.configField}>
                        <label className={styles.configFieldLabel}>Description</label>
                        <input className={styles.configFieldInput} value={config.description} onChange={e => updateConfig('description', e.target.value)} placeholder="One-line description" />
                      </div>
                    </div>
                    <div className={styles.configFieldRow}>
                      <div className={styles.configField}>
                        <label className={styles.configFieldLabel}>Mode</label>
                        <div className={styles.configModeToggle}>
                          <button className={`${styles.configModeBtn} ${config.mode === 'simple' ? styles.configModeBtnActive : ''}`} onClick={() => updateConfig('mode', 'simple' as PlaygroundMode)}>Simple</button>
                          <button className={`${styles.configModeBtn} ${config.mode === 'thinker' ? styles.configModeBtnActive : ''}`} onClick={() => updateConfig('mode', 'thinker' as PlaygroundMode)}>Thinker</button>
                        </div>
                      </div>
                      <div className={styles.configField}>
                        <label className={styles.configFieldLabel}>Model</label>
                        <select className={styles.configFieldSelect} value={config.model} onChange={e => updateConfig('model', e.target.value)}>
                          {MODEL_OPTIONS.map(group => (
                            <optgroup key={group.group} label={group.group}>
                              {group.models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div className={styles.configField}>
                        <label className={styles.configFieldLabel}>Max Tokens</label>
                        <input className={styles.configFieldInput} type="number" value={config.maxTokens} onChange={e => updateConfig('maxTokens', parseInt(e.target.value) || 2048)} />
                      </div>
                    </div>
                  </ConfigSection>

                  {/* Guidance */}
                  <ConfigSection title="Guidance (Main Prompt)" defaultOpen>
                    <div className={styles.configTextareaWrapper}>
                      <textarea className={`${styles.configTextarea} ${styles.configTextareaLarge}`} value={config.guidance} onChange={e => updateConfig('guidance', e.target.value)} placeholder="The full prompt that defines the assistant's behavior..." />
                      <button className={styles.enlargeButton} onClick={() => openEnlargeEditor('Guidance (Main Prompt)', 'guidance')}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        Enlarge
                      </button>
                    </div>
                  </ConfigSection>

                  {/* Thinking Prompt */}
                  {config.mode === 'thinker' && (
                    <ConfigSection title="Thinking Prompt (Strategy Brain)" defaultOpen>
                      <div className={styles.configTextareaWrapper}>
                        <textarea className={styles.configTextarea} value={config.thinkingPrompt} onChange={e => updateConfig('thinkingPrompt', e.target.value)} placeholder="Strategy brain prompt — returns JSON with analysis..." />
                        <button className={styles.enlargeButton} onClick={() => openEnlargeEditor('Thinking Prompt', 'thinkingPrompt')}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                          Enlarge
                        </button>
                      </div>
                      <div className={styles.configField}>
                        <label className={styles.configFieldLabel}>Thinking Model</label>
                        <select className={styles.configFieldSelect} value={config.thinkingModel} onChange={e => updateConfig('thinkingModel', e.target.value)}>
                          {MODEL_OPTIONS.map(group => (
                            <optgroup key={group.group} label={group.group}>
                              {group.models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </ConfigSection>
                  )}

                  {/* Persona */}
                  <ConfigSection title="Persona">
                    <div className={styles.configTextareaWrapper}>
                      <textarea className={styles.configTextarea} value={config.persona} onChange={e => updateConfig('persona', e.target.value)} placeholder="Voice and personality description..." />
                      <button className={styles.enlargeButton} onClick={() => openEnlargeEditor('Persona', 'persona')}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        Enlarge
                      </button>
                    </div>
                  </ConfigSection>

                  {/* Knowledge Base */}
                  <ConfigSection title="Knowledge Base">
                    <p className={styles.configHint}>Connect to real knowledge bases for this agent.</p>
                    {config.kbSources.map((kb, i) => {
                      const isReal = availableKBs.some(real => real.vectorStoreId === kb.vectorStoreId);
                      if (!isReal) return null;
                      return (
                        <div key={i} className={styles.kbChip}>
                          <span className={styles.kbChipName}>{kb.name}</span>
                          <span className={styles.kbChipId}>{kb.vectorStoreId}</span>
                          <button className={styles.removeButton} onClick={() => updateConfig('kbSources', config.kbSources.filter((_, j) => j !== i))}>&#x2715;</button>
                        </div>
                      );
                    })}
                    {availableKBs.filter(kb => kb.vectorStoreId).length > 0 ? (
                      <select className={styles.kbSelect} value="" onChange={e => {
                        const selected = availableKBs.find(kb => kb.vectorStoreId === e.target.value);
                        if (selected && !config.kbSources.some(s => s.vectorStoreId === selected.vectorStoreId)) {
                          updateConfig('kbSources', [...config.kbSources, { vectorStoreId: selected.vectorStoreId!, name: selected.name }]);
                        }
                      }}>
                        <option value="">Select a knowledge base...</option>
                        {availableKBs.filter(kb => kb.vectorStoreId && !config.kbSources.some(s => s.vectorStoreId === kb.vectorStoreId)).map(kb => (
                          <option key={kb.id} value={kb.vectorStoreId!}>{kb.name}</option>
                        ))}
                      </select>
                    ) : (
                      <p className={styles.configHint}>No knowledge bases found for this agent.</p>
                    )}
                  </ConfigSection>

                  {/* Capabilities (Tools) */}
                  <ConfigSection title="Capabilities (Actions)">
                    <p className={styles.configHint}>
                      Define actions your crew can perform. Each action has a name, a description that tells the AI <strong>when to use it</strong>,
                      input parameters, and a test response.
                    </p>
                    {config.tools.map((tool, i) => (
                      <ToolCard
                        key={i}
                        tool={tool}
                        index={i}
                        onUpdate={updateTool}
                        onRemove={removeTool}
                        onEnlarge={(title, value, isJson) => {
                          setModalEditor({ title, value, field: `__tool_${i}`, isJson });
                        }}
                      />
                    ))}
                    <button className={styles.addButton} onClick={addTool}>
                      + Add Action
                    </button>
                  </ConfigSection>

                  {/* Context */}
                  <ConfigSection title="Pre-loaded Knowledge">
                    <p className={styles.configHint}>
                      Data your crew already knows before the conversation starts — like user profiles, journey stages, or business rules.
                      Each entry has a label and a JSON value.
                    </p>
                    {Object.entries(config.context).map(([key, value], i) => (
                      <ContextCard
                        key={i}
                        entryKey={key}
                        entryValue={value}
                        index={i}
                        allEntries={config.context}
                        onUpdate={(entries) => updateConfig('context', entries)}
                        onEnlarge={(title, val) => {
                          setModalEditor({ title, value: val, field: `__context_${i}`, isJson: true });
                        }}
                      />
                    ))}
                    <button className={styles.addButton} onClick={() => updateConfig('context', { ...config.context, [`entry_${Object.keys(config.context).length + 1}`]: {} })}>
                      + Add Entry
                    </button>
                  </ConfigSection>
                </div>

            )}
            </>
          )}
        </div>

        {/* ===== PANEL DIVIDER (draggable) ===== */}
        {!leftCollapsed && !rightCollapsed && (
          <div
            className={`${styles.panelDivider} ${isDragging ? styles.panelDividerDragging : ''}`}
            onMouseDown={e => { e.preventDefault(); setIsDragging(true); }}
          >
            <button className={styles.collapseButton} onClick={() => setLeftCollapsed(true)} title="Collapse left panel" onMouseDown={e => e.stopPropagation()}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className={styles.dragHandle}>
              <span /><span /><span />
            </div>
            <button className={styles.collapseButton} onClick={() => setRightCollapsed(true)} title="Collapse chat" onMouseDown={e => e.stopPropagation()}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        )}

        {/* Expand buttons when a panel is collapsed */}
        {leftCollapsed && (
          <button className={`${styles.expandButton} ${styles.expandButtonLeft}`} onClick={() => setLeftCollapsed(false)} title={`Show ${leftTab === 'design' ? 'Design' : 'Config'}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}

        {/* ===== RIGHT PANEL (Chat) ===== */}
        <div className={rightPanelClass}>
          {!rightCollapsed && (
            <>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Test Chat
                  {config.displayName && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>— {config.displayName}</span>}
                </span>
                <div className={styles.panelActions}>
                  <button
                    className={`${styles.actionButton} ${debugMode ? styles.actionButtonActive : ''}`}
                    onClick={() => setDebugMode(!debugMode)}
                    title="Toggle debug info"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>
                    Debug
                  </button>
                  {registeredSession && <button className={styles.actionButton} onClick={handleResetChat}>Clear Chat</button>}
                </div>
              </div>

              <div className={styles.chatMessages} ref={testMessagesRef} dir="ltr">
                <LanguageContext.Provider value={{
                  language: 'en',
                  setLanguage: () => {},
                  direction: 'ltr',
                  t: (key: string) => key,
                }}>
                  <ChatContext.Provider value={{
                    debugMode,
                    deleteMessagesFrom: testChat.deleteMessagesFrom,
                    crewMembers: [],
                    conversationId: testConversationId,
                  } as any}>
                    {!registeredSession ? (
                      <div className={styles.chatEmpty}>
                        <svg className={styles.chatEmptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <h3 className={styles.chatEmptyTitle}>No Crew Active</h3>
                        <p className={styles.chatEmptyText}>Design a crew with AI or configure it manually, then click "Activate" to start testing.</p>
                      </div>
                    ) : testChat.messages.length === 0 ? (
                      <div className={styles.chatEmpty}>
                        <h3 className={styles.chatEmptyTitle}>Ready to Chat</h3>
                        <p className={styles.chatEmptyText}>Send a message to test your crew member.</p>
                      </div>
                    ) : (
                      testChat.messages.map(msg => (
                        <Message key={msg.id} message={msg} />
                      ))
                    )}
                    {testChat.isThinking && (
                      <ThinkingIndicator
                        currentStep={testChat.currentThinkingStep}
                        steps={testChat.thinkingSteps}
                        isComplete={false}
                      />
                    )}
                  </ChatContext.Provider>
                </LanguageContext.Provider>
              </div>

              <TestInput disabled={!registeredSession} isLoading={testChat.isLoading} onSend={handleTestSend} />
            </>
          )}

          {/* Show expand button when right is collapsed */}
          {rightCollapsed && (
            <button className={`${styles.expandButton} ${styles.expandButtonRight}`} onClick={() => setRightCollapsed(false)} title="Show chat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* ===== SAVE DIALOG ===== */}
      {showSaveDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowSaveDialog(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <h3 className={styles.dialogTitle}>Save Playground Config</h3>
            <input className={styles.dialogInput} value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Config name..." autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSave(); }} />
            <div className={styles.dialogActions}>
              <button className={styles.actionButton} onClick={() => setShowSaveDialog(false)}>Cancel</button>
              <button className={`${styles.actionButton} ${styles.actionButtonPrimary}`} onClick={handleSave} disabled={!saveName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL EDITOR ===== */}
      {modalEditor && (
        <div className={styles.modalOverlay} onClick={() => setModalEditor(null)}>
          <div className={styles.modalEditor} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modalEditor.title}</span>
              <div className={styles.panelActions}>
                <button className={`${styles.actionButton} ${styles.actionButtonPrimary}`} onClick={() => {
                  if (!modalEditor) return;
                  const { field, value } = modalEditor;
                  // Handle special tool/context modal fields
                  if (field.startsWith('__tool_')) {
                    const idx = parseInt(field.replace('__tool_', ''));
                    // value is JSON for the whole tool section we're editing - but we opened with specific data
                    // This is for tool params/mock - we store as the specific field
                    // Actually, for tools we open enlarge on params or mockResponse separately
                    // The ToolCard passes the specific value
                    try {
                      const parsed = JSON.parse(value);
                      // We need to determine which sub-field was opened - stored in title
                      if (modalEditor.title.includes('Parameters')) {
                        updateTool(idx, { parameters: parsed });
                      } else if (modalEditor.title.includes('Test Response')) {
                        updateTool(idx, { mockResponse: parsed });
                      }
                    } catch {
                      // If parse fails, store as string
                    }
                  } else if (field.startsWith('__context_')) {
                    const idx = parseInt(field.replace('__context_', ''));
                    const entries = Object.entries(config.context);
                    if (entries[idx]) {
                      try {
                        entries[idx] = [entries[idx][0], JSON.parse(value)];
                      } catch {
                        entries[idx] = [entries[idx][0], value];
                      }
                      updateConfig('context', Object.fromEntries(entries));
                    }
                  } else {
                    handleModalSave();
                    return;
                  }
                  setModalEditor(null);
                }}>Done</button>
                <button className={styles.actionButton} onClick={() => setModalEditor(null)}>Cancel</button>
              </div>
            </div>
            <div className={styles.modalBody}>
              {modalEditor.isJson ? (
                <ModalJsonEditor
                  value={modalEditor.value}
                  onChange={val => setModalEditor(prev => prev ? { ...prev, value: val } : null)}
                />
              ) : (
                <textarea
                  className={styles.modalTextarea}
                  value={modalEditor.value}
                  onChange={e => setModalEditor(prev => prev ? { ...prev, value: e.target.value } : null)}
                  autoFocus
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Sub-components ==========

function ConfigSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.configSection}>
      <div className={styles.configSectionHeader} onClick={() => setOpen(!open)}>
        <svg className={`${styles.configSectionChevron} ${open ? styles.configSectionChevronOpen : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {title}
      </div>
      {open && <div className={styles.configSectionBody}>{children}</div>}
    </div>
  );
}

/** Collapsible tool card - default closed, shows only name */
function ToolCard({ tool, index, onUpdate, onRemove, onEnlarge }: {
  tool: MockTool;
  index: number;
  onUpdate: (index: number, updates: Partial<MockTool>) => void;
  onRemove: (index: number) => void;
  onEnlarge: (title: string, value: string, isJson: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.toolCard}>
      <div className={styles.toolCardHeader} onClick={() => setExpanded(!expanded)}>
        <svg className={`${styles.toolCardChevron} ${expanded ? styles.toolCardChevronOpen : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <span className={styles.toolCardName}>{tool.name || `Action ${index + 1}`}</span>
        {tool.description && !expanded && <span className={styles.toolCardDesc}>— {tool.description.slice(0, 40)}{tool.description.length > 40 ? '...' : ''}</span>}
        <button className={styles.removeButton} onClick={(e) => { e.stopPropagation(); onRemove(index); }}>&#x2715;</button>
      </div>
      {expanded && (
        <div className={styles.toolCardBody}>
          <div className={styles.configField}>
            <label className={styles.configFieldLabel}>Action Name</label>
            <input className={`${styles.configFieldInput} ${styles.configValueMono}`} value={tool.name} onChange={e => onUpdate(index, { name: e.target.value })} placeholder="e.g. search_products" />
          </div>
          <div className={styles.configField}>
            <label className={styles.configFieldLabel}>When should the AI use this action?</label>
            <p className={styles.configFieldHint}>This description tells the AI exactly when to trigger this action during conversation.</p>
            <textarea className={styles.configTextarea} style={{ minHeight: 80 }} value={tool.description} onChange={e => onUpdate(index, { description: e.target.value })} placeholder="e.g. Use this action when the user asks about products or wants to search the catalog..." />
          </div>
          <div className={styles.configField}>
            <label className={styles.configFieldLabel}>Input Parameters (JSON Schema)</label>
            <p className={styles.configFieldHint}>What data the AI should provide when calling this action.</p>
            <JsonEditor
              value={typeof tool.parameters === 'string' ? tool.parameters : JSON.stringify(tool.parameters, null, 2)}
              onChange={val => { try { onUpdate(index, { parameters: JSON.parse(val) }); } catch { onUpdate(index, { parameters: val as unknown as object }); } }}
              rows={6}
              minHeight={160}
              enlargeTitle={`Parameters — ${tool.name}`}
              onEnlarge={onEnlarge}
            />
          </div>
          <div className={styles.configField}>
            <label className={styles.configFieldLabel}>Test Response (Mock)</label>
            <p className={styles.configFieldHint}>The fake response returned during testing — lets you simulate real behavior.</p>
            <JsonEditor
              value={typeof tool.mockResponse === 'string' ? tool.mockResponse : JSON.stringify(tool.mockResponse, null, 2)}
              onChange={val => { try { onUpdate(index, { mockResponse: JSON.parse(val) }); } catch { onUpdate(index, { mockResponse: val }); } }}
              rows={6}
              minHeight={160}
              enlargeTitle={`Test Response — ${tool.name}`}
              onEnlarge={onEnlarge}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Context entry card with enlarge support */
function ContextCard({ entryKey, entryValue, index, allEntries, onUpdate, onEnlarge }: {
  entryKey: string;
  entryValue: unknown;
  index: number;
  allEntries: Record<string, unknown>;
  onUpdate: (entries: Record<string, unknown>) => void;
  onEnlarge: (title: string, value: string) => void;
}) {
  const strValue = typeof entryValue === 'string' ? entryValue : JSON.stringify(entryValue, null, 2);

  const handleKeyChange = (newKey: string) => {
    const entries = Object.entries(allEntries);
    entries[index] = [newKey, entryValue];
    onUpdate(Object.fromEntries(entries));
  };

  const handleValueChange = (newValue: string) => {
    const entries = Object.entries(allEntries);
    try { entries[index] = [entryKey, JSON.parse(newValue)]; } catch { entries[index] = [entryKey, newValue]; }
    onUpdate(Object.fromEntries(entries));
  };

  const handleRemove = () => {
    const entries = Object.entries(allEntries).filter((_, j) => j !== index);
    onUpdate(Object.fromEntries(entries));
  };

  return (
    <div className={styles.contextCard}>
      <div className={styles.contextCardHeader}>
        <input className={`${styles.configFieldInput} ${styles.configValueMono}`} value={entryKey} onChange={e => handleKeyChange(e.target.value)} placeholder="label (e.g. user_profile)" style={{ flex: 1 }} />
        <button className={styles.removeButton} onClick={handleRemove}>&#x2715;</button>
      </div>
      <JsonEditor
        value={strValue}
        onChange={handleValueChange}
        rows={8}
        minHeight={200}
        enlargeTitle={`Pre-loaded Knowledge — ${entryKey}`}
        onEnlarge={(title, val) => onEnlarge(title, val)}
      />
    </div>
  );
}

function TestInput({ disabled, isLoading, onSend }: { disabled: boolean; isLoading: boolean; onSend: (text: string) => void }) {
  const [value, setValue] = useState('');
  const handleSend = () => { const t = value.trim(); if (!t || isLoading || disabled) return; onSend(t); setValue(''); };
  return (
    <div className={styles.chatInputArea}>
      <textarea className={styles.chatInput} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={disabled ? 'Activate a crew first...' : 'Type a message...'} disabled={disabled || isLoading} />
      <button className={styles.sendButton} onClick={handleSend} disabled={!value.trim() || isLoading || disabled}>
        {isLoading ? <div className={styles.spinner} /> : 'Send'}
      </button>
    </div>
  );
}

function FormattedMessage({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
        if (codeMatch) {
          const lang = codeMatch[1] || 'text';
          const code = codeMatch[2].trimEnd();
          const isJson = lang === 'json';
          return (
            <div key={i} className={styles.codeBlock}>
              <div className={styles.codeBlockHeader}>
                <span>{lang}</span>
                <button className={styles.codeBlockCopy} onClick={() => navigator.clipboard.writeText(code)}>Copy</button>
              </div>
              {isJson ? (
                <pre className={styles.codeBlockContent} dangerouslySetInnerHTML={{ __html: colorizeJson(code) }} />
              ) : (
                <pre className={styles.codeBlockContent}>{code}</pre>
              )}
            </div>
          );
        }
        return part ? <span key={i}>{part}</span> : null;
      })}
    </>
  );
}

/** Lightweight JSON syntax coloring — returns HTML with colored spans */
function colorizeJson(text: string): string {
  return text.replace(
    /("(?:\\.|[^"\\])*")\s*(:)|("(?:\\.|[^"\\])*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, key, colon, str, bool, num) => {
      if (key && colon) return `<span class="${styles.jsonKey}">${key}</span>${colon}`;
      if (str) return `<span class="${styles.jsonString}">${str}</span>`;
      if (bool) return `<span class="${styles.jsonBool}">${bool}</span>`;
      if (num) return `<span class="${styles.jsonNumber}">${num}</span>`;
      return match;
    }
  );
}

/** JSON editor with syntax highlighting overlay — auto-sizes to content */
function JsonEditor({ value, onChange, minHeight, enlargeTitle, onEnlarge }: {
  value: string;
  onChange: (val: string) => void;
  minHeight?: number;
  enlargeTitle?: string;
  onEnlarge?: (title: string, value: string, isJson: boolean) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const highlighted = useMemo(() => colorizeJson(value), [value]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, minHeight || 140) + 'px';
  }, [value, minHeight]);

  const syncScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className={styles.configTextareaWrapper}>
      <div className={styles.jsonEditorContainer} style={{ minHeight: minHeight || 140 }}>
        <pre ref={preRef} className={styles.jsonHighlight} dangerouslySetInnerHTML={{ __html: highlighted + '\n' }} />
        <textarea
          ref={textareaRef}
          className={styles.jsonTextarea}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
        />
      </div>
      {onEnlarge && enlargeTitle && (
        <button className={styles.enlargeButton} onClick={() => onEnlarge(enlargeTitle, value, true)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          Enlarge
        </button>
      )}
    </div>
  );
}

/** Full-screen modal JSON editor with syntax highlighting */
function ModalJsonEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const highlighted = useMemo(() => colorizeJson(value), [value]);
  const syncScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };
  return (
    <div className={styles.modalJsonContainer}>
      <pre ref={preRef} className={styles.modalJsonHighlight} dangerouslySetInnerHTML={{ __html: highlighted + '\n' }} />
      <textarea
        ref={textareaRef}
        className={styles.modalJsonInput}
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        autoFocus
      />
    </div>
  );
}

function MockResponseEditor({ toolName, initialValue, onSave }: { toolName: string; initialValue: string; onSave: (toolName: string, value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  const [dirty, setDirty] = useState(false);
  return (
    <div className={styles.mockResponseSection}>
      <div className={styles.mockResponseLabel}>
        <span>Mock Response</span>
        {dirty && <button className={styles.saveMockButton} onClick={() => { onSave(toolName, value); setDirty(false); }}>Save</button>}
      </div>
      <textarea className={styles.mockResponseEditor} value={value} onChange={e => { setValue(e.target.value); setDirty(true); }} />
    </div>
  );
}
