/**
 * CrewEditorAI Component
 *
 * Admin tool that lets super users view and edit crew member files
 * through a chat interface with Claude AI. No dev environment needed.
 *
 * Layout:
 * - Left panel: Code viewer (collapsible, shows current/proposed source)
 * - Right panel: Chat with Claude (conversation interface)
 * - Top bar: Crew member selector
 * - Bottom bar: Apply / Export / Discard actions
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { getAgentCrew } from '../../../services/crewService';
import { getCrewSource, chatWithClaude, applyCrewSource, listVersions, getVersionSource, deleteVersion, getDefaultVersion, setDefaultVersion, unsetDefaultVersion, getProjectFileSource } from '../../../services/crewEditorService';
import type { CrewMember, CrewEditorMessage, CrewVersionInfo, ProjectFileInfo } from '../../../types/crew';
import { extractCrewSummary } from '../../../utils/extractCrewSummary';
import type { CrewSummary } from '../../../utils/extractCrewSummary';
import styles from './CrewEditorAI.module.css';

interface CrewEditorAIProps {
  agentName: string;
  baseURL: string;
}

type ViewMode = 'prompts' | 'source';
type VersionMode = 'current' | 'proposed';

export function CrewEditorAI({ agentName, baseURL }: CrewEditorAIProps) {
  // Crew selection
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<string>('');
  const [isLoadingCrew, setIsLoadingCrew] = useState(true);

  // Source code
  const [source, setSource] = useState<string>('');
  const [proposedSource, setProposedSource] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [isLoadingSource, setIsLoadingSource] = useState(false);

  // Chat
  const [messages, setMessages] = useState<CrewEditorMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // Actions
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // UI state
  const [codeExpanded, setCodeExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('prompts');
  const [versionMode, setVersionMode] = useState<VersionMode>('current');
  const [crewSummary, setCrewSummary] = useState<CrewSummary | null>(null);
  const [proposedSummary, setProposedSummary] = useState<CrewSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Versions panel
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<CrewVersionInfo[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [loadedVersionTimestamp, setLoadedVersionTimestamp] = useState<string | null>(null);
  const [versionName, setVersionName] = useState('');
  const [showApplyPrompt, setShowApplyPrompt] = useState(false);
  const [projectFile, setProjectFile] = useState<ProjectFileInfo | null>(null);
  const [defaultVersionInfo, setDefaultVersionInfo] = useState<{ timestamp: string; setAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const versionsRef = useRef<HTMLDivElement>(null);

  // Load crew members on mount
  useEffect(() => {
    const load = async () => {
      setIsLoadingCrew(true);
      try {
        const crew = await getAgentCrew(agentName, baseURL);
        // Filter to file-based crews only (the editor is for file-based crews)
        const fileCrew = crew.filter(c => c.source === 'file');
        setCrewMembers(fileCrew);
        if (fileCrew.length > 0) {
          setSelectedCrew(fileCrew[0].name);
        }
      } catch {
        // Failed to load — empty list
      } finally {
        setIsLoadingCrew(false);
      }
    };
    load();
  }, [agentName, baseURL]);

  // Load source when crew selection changes + auto-load default if it differs
  useEffect(() => {
    if (!selectedCrew) return;

    const loadSource = async () => {
      setIsLoadingSource(true);
      setStatusMessage(null);
      setProposedSource(null);
      setProposedSummary(null);
      setVersionMode('current');
      setViewMode('prompts');
      setMessages([]);
      setLoadedVersionTimestamp(null);
      setVersionName('');
      setDefaultVersionInfo(null);
      try {
        const result = await getCrewSource(agentName, selectedCrew, baseURL);
        setSource(result.source);
        setFilePath(result.filePath);
        setCrewSummary(extractCrewSummary(result.source));

        // Check if a default version exists and differs from current
        try {
          const defaultInfo = await getDefaultVersion(agentName, selectedCrew, baseURL);
          setDefaultVersionInfo(defaultInfo);
          if (defaultInfo) {
            const defaultSource = await getVersionSource(agentName, selectedCrew, defaultInfo.timestamp, baseURL);
            if (defaultSource.trim() !== result.source.trim()) {
              setProposedSource(defaultSource);
              setProposedSummary(extractCrewSummary(defaultSource));
              setVersionMode('proposed');
              setLoadedVersionTimestamp(defaultInfo.timestamp);
              setStatusMessage({ type: 'success', text: 'Default version differs from current — click Apply to restore' });
            }
          }
        } catch {
          setDefaultVersionInfo(null);
        }
      } catch (err) {
        setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load source' });
        setSource('');
        setFilePath('');
        setCrewSummary(null);
      } finally {
        setIsLoadingSource(false);
      }
    };
    loadSource();
  }, [agentName, selectedCrew, baseURL]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatting]);

  // Send chat message
  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isChatting || isGenerating || !selectedCrew) return;

    setInputValue('');
    setStatusMessage(null);

    const userMessage: CrewEditorMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    setIsChatting(true);
    try {
      const activeSource = proposedSource || source;
      const result = await chatWithClaude(agentName, selectedCrew, updatedMessages, activeSource, baseURL, 'discuss');

      const assistantMessage: CrewEditorMessage = { role: 'assistant', content: result.response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: CrewEditorMessage = {
        role: 'assistant',
        content: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatting(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isChatting, isGenerating, selectedCrew, messages, proposedSource, source, agentName, baseURL]);

  // Generate changes — full prompt with building guide, outputs updated file
  const handleGenerate = useCallback(async () => {
    if (!selectedCrew || isChatting || isGenerating || messages.length === 0) return;

    setIsGenerating(true);
    setStatusMessage(null);

    try {
      const activeSource = proposedSource || source;
      const result = await chatWithClaude(agentName, selectedCrew, messages, activeSource, baseURL, 'generate');

      const assistantMessage: CrewEditorMessage = { role: 'assistant', content: result.response };
      setMessages(prev => [...prev, assistantMessage]);

      if (result.updatedSource) {
        setProposedSource(result.updatedSource);
        setProposedSummary(extractCrewSummary(result.updatedSource));
        setVersionMode('proposed');
      }
    } catch (err) {
      const errorMessage: CrewEditorMessage = {
        role: 'assistant',
        content: `Sorry, generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
      inputRef.current?.focus();
    }
  }, [selectedCrew, isChatting, isGenerating, messages, proposedSource, source, agentName, baseURL]);

  // Handle Enter key in input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Apply proposed source
  // Open the apply prompt dialog
  const handleApply = () => {
    if (!proposedSource || !selectedCrew || isApplying) return;
    setVersionName('');
    setShowApplyPrompt(true);
  };

  // Confirm apply (from the prompt dialog)
  const handleConfirmApply = async () => {
    if (!proposedSource || !selectedCrew || isApplying) return;

    setShowApplyPrompt(false);
    setIsApplying(true);
    setStatusMessage(null);

    try {
      const result = await applyCrewSource(
        agentName, selectedCrew, proposedSource, baseURL,
        versionName.trim() || undefined
      );
      if (result.success) {
        setSource(proposedSource);
        setCrewSummary(extractCrewSummary(proposedSource));
        setProposedSource(null);
        setProposedSummary(null);
        setVersionMode('current');
        setViewMode('prompts');
        setLoadedVersionTimestamp(null);
        setVersionName('');
        if (result.backupVersion) {
          setDefaultVersionInfo({ timestamp: result.backupVersion, setAt: new Date().toISOString() });
        }
        setStatusMessage({
          type: 'success',
          text: result.backupVersion
            ? `Applied & set as default. Version: ${formatTimestamp(result.backupVersion)}`
            : 'Applied successfully. Changes are live.'
        });
      } else {
        setStatusMessage({ type: 'error', text: result.error || 'Apply failed' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Apply failed' });
    } finally {
      setIsApplying(false);
    }
  };

  // Discard proposed changes
  const handleDiscard = () => {
    setProposedSource(null);
    setProposedSummary(null);
    setVersionMode('current');
    setLoadedVersionTimestamp(null);
  };

  // Export current source as file download
  const handleExport = () => {
    const content = proposedSource || source;
    if (!content) return;

    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCrew}.crew.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load versions list
  const handleLoadVersions = async () => {
    if (!selectedCrew) return;
    if (showVersions) {
      setShowVersions(false);
      return;
    }
    setShowVersions(true);
    setIsLoadingVersions(true);
    try {
      const result = await listVersions(agentName, selectedCrew, baseURL);
      setVersions(result.versions);
      setProjectFile(result.projectFile);
    } catch {
      setVersions([]);
      setProjectFile(null);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // Preview a version — loads it into the code panel as proposed, user clicks Apply to save
  const handleRestore = async (timestamp: string) => {
    if (!selectedCrew || restoringVersion) return;
    setRestoringVersion(timestamp);
    setStatusMessage(null);
    try {
      const versionSource = await getVersionSource(agentName, selectedCrew, timestamp, baseURL);
      setProposedSource(versionSource);
      setProposedSummary(extractCrewSummary(versionSource));
      setVersionMode('proposed');
      setShowVersions(false);
      setLoadedVersionTimestamp(timestamp);
      setStatusMessage({ type: 'success', text: `Loaded version from ${formatTimestamp(timestamp)} — click Apply to save` });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load version' });
    } finally {
      setRestoringVersion(null);
    }
  };

  // Delete a version
  const handleDeleteVersion = async (timestamp: string) => {
    if (!selectedCrew || deletingVersion) return;
    setDeletingVersion(timestamp);
    try {
      const wasDefault = versions.find(v => v.timestamp === timestamp)?.isDefault;
      await deleteVersion(agentName, selectedCrew, timestamp, baseURL);
      setVersions(prev => prev.filter(v => v.timestamp !== timestamp));
      if (wasDefault) {
        setDefaultVersionInfo(null);
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setDeletingVersion(null);
    }
  };

  // Set or unset a version as default (toggle)
  const handleSetDefault = async (timestamp: string) => {
    if (!selectedCrew || settingDefault) return;

    // Toggle off if already the default
    const targetVersion = versions.find(v => v.timestamp === timestamp);
    if (targetVersion?.isDefault) {
      setSettingDefault(timestamp);
      try {
        await unsetDefaultVersion(agentName, selectedCrew, baseURL);
        setVersions(prev => prev.map(v => ({ ...v, isDefault: false })));
        setDefaultVersionInfo(null);
        setStatusMessage({ type: 'success', text: 'Default unset — project file is now active' });
      } catch (err) {
        setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to unset default' });
      } finally {
        setSettingDefault(null);
      }
      return;
    }

    // Set as default
    setSettingDefault(timestamp);
    try {
      await setDefaultVersion(agentName, selectedCrew, timestamp, baseURL);
      setVersions(prev => prev.map(v => ({ ...v, isDefault: v.timestamp === timestamp })));
      setDefaultVersionInfo({ timestamp, setAt: new Date().toISOString() });
      setStatusMessage({ type: 'success', text: `Default version set to ${formatTimestamp(timestamp)}` });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to set default' });
    } finally {
      setSettingDefault(null);
    }
  };

  // Unset default (for project file star click)
  const handleUnsetDefault = async () => {
    if (!selectedCrew || settingDefault) return;
    setSettingDefault('project');
    try {
      await unsetDefaultVersion(agentName, selectedCrew, baseURL);
      setVersions(prev => prev.map(v => ({ ...v, isDefault: false })));
      setDefaultVersionInfo(null);
      setStatusMessage({ type: 'success', text: 'Default unset — project file is now active' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to unset default' });
    } finally {
      setSettingDefault(null);
    }
  };

  // Load project file source into proposed view
  const handleLoadProjectFile = async () => {
    if (!selectedCrew || restoringVersion) return;
    setRestoringVersion('project');
    setStatusMessage(null);
    try {
      let projectSource: string;
      try {
        // Try GCS backup first
        projectSource = await getProjectFileSource(agentName, selectedCrew, baseURL);
      } catch {
        // Fall back to current disk file (which IS the project file if no GCS override)
        const result = await getCrewSource(agentName, selectedCrew, baseURL);
        projectSource = result.source;
      }
      setProposedSource(projectSource);
      setProposedSummary(extractCrewSummary(projectSource));
      setVersionMode('proposed');
      setShowVersions(false);
      setLoadedVersionTimestamp(null);
      setStatusMessage({ type: 'success', text: 'Loaded project file — click Apply to restore' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load project file' });
    } finally {
      setRestoringVersion(null);
    }
  };

  // Format GCS timestamp for display (2024-01-15T10-30-00-000Z → Jan 15, 2024 10:30)
  const formatTimestamp = (ts: string): string => {
    try {
      // Convert back from GCS format: replace dashes in time portion with colons/dots
      const isoStr = ts.replace(/(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, '$1:$2:$3.$4Z');
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return ts;
    }
  };

  // Close versions panel when clicking outside
  useEffect(() => {
    if (!showVersions) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (versionsRef.current && !versionsRef.current.contains(e.target as Node)) {
        setShowVersions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVersions]);

  // Category display config
  const categoryMap: Record<string, { label: string; emoji: string }> = {
    'A': { label: 'Talking', emoji: '💬' },
    'B': { label: 'Thinking', emoji: '🧠' },
    'C': { label: 'Fields', emoji: '📋' },
    'D': { label: 'Code', emoji: '⚙️' },
    'E': { label: 'Escalation', emoji: '🚨' },
  };

  type ChangeGroup = { label: string; emoji: string; items: string[] };

  // Strip code block markers from assistant messages for display
  // Extract change summary and group by category
  const formatMessageContent = (content: string): { text: string; hasCode: boolean; changeGroups: ChangeGroup[] } => {
    const codeBlockRegex = /```(?:javascript|js)\s*\n([\s\S]*?)```/;
    const match = content.match(codeBlockRegex);

    if (match) {
      // Remove the code block from text
      let textOnly = content.replace(codeBlockRegex, '').trim();

      // Extract "Changes made:" section
      const changeGroups: ChangeGroup[] = [];
      const changesMatch = textOnly.match(/\*?\*?Changes\s+made:?\*?\*?\s*\n([\s\S]*)/i);
      if (changesMatch) {
        const rawChanges = changesMatch[1].trim();
        // Remove the changes section from the main text
        textOnly = textOnly.replace(/\*?\*?Changes\s+made:?\*?\*?\s*\n[\s\S]*/i, '').trim();

        // Parse lines and group by category
        const lines = rawChanges.split('\n').filter(l => l.trim());
        let currentGroup: ChangeGroup | null = null;

        for (const line of lines) {
          const trimmed = line.trim();
          // Match category header: **(A) Guidance** — description  or  (B) Thinking prompt — description
          const catMatch = trimmed.match(/^\*?\*?\(([A-E])\)\s*(?:Guidance|Thinking\s*prompt|Fields?|Code|Escalat(?:ion|e))\*?\*?\s*[-—]\s*(.*)/i);
          if (catMatch) {
            const key = catMatch[1].toUpperCase();
            const desc = catMatch[2].trim();
            const config = categoryMap[key] || { label: key, emoji: '•' };
            // Check if group for this category already exists
            const existing = changeGroups.find(g => g.label === config.label);
            if (existing) {
              if (desc) existing.items.push(desc);
              currentGroup = existing;
            } else {
              currentGroup = { label: config.label, emoji: config.emoji, items: desc ? [desc] : [] };
              changeGroups.push(currentGroup);
            }
          } else if (currentGroup) {
            // Continuation line — strip leading bullet/dash
            const cleaned = trimmed.replace(/^[-*•]\s*/, '');
            if (cleaned) currentGroup.items.push(cleaned);
          } else {
            // Ungrouped line — put in a general group
            const cleaned = trimmed.replace(/^[-*•]\s*/, '');
            if (cleaned) {
              if (!changeGroups.find(g => g.label === 'General')) {
                changeGroups.push({ label: 'General', emoji: '✏️', items: [] });
              }
              changeGroups.find(g => g.label === 'General')!.items.push(cleaned);
            }
          }
        }
      }

      return { text: textOnly, hasCode: true, changeGroups };
    }

    return { text: content, hasCode: false, changeGroups: [] };
  };

  // Render code with syntax highlighting (VS Code dark+ theme)
  const renderCode = (code: string) => {
    return (
      <Highlight theme={themes.vsDark} code={code} language="javascript">
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className={styles.codeBlock}>
            {tokens.map((line, i) => {
              const lineProps = getLineProps({ line, key: i });
              return (
                <div {...lineProps} key={i} className={styles.codeLine}>
                  <span className={styles.lineNumber}>{i + 1}</span>
                  {line.map((token, j) => (
                    <span {...getTokenProps({ token, key: j })} key={j} />
                  ))}
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    );
  };

  // Render lightweight markdown (headings, bold, bullets) into JSX
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let key = 0;

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(<ul key={key++} className={styles.mdList}>{listItems}</ul>);
        listItems = [];
      }
    };

    const renderInline = (line: string): React.ReactNode[] => {
      // Bold **text** and line content
      const parts: React.ReactNode[] = [];
      const regex = /\*\*(.+?)\*\*/g;
      let lastIndex = 0;
      let match;
      let inlineKey = 0;
      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.slice(lastIndex, match.index));
        }
        parts.push(<strong key={inlineKey++}>{match[1]}</strong>);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < line.length) {
        parts.push(line.slice(lastIndex));
      }
      return parts.length > 0 ? parts : [line];
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines — flush list
      if (!trimmed) {
        flushList();
        continue;
      }

      // Heading ##
      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        flushList();
        elements.push(
          <h4 key={key++} className={styles.mdHeading}>{renderInline(headingMatch[2])}</h4>
        );
        continue;
      }

      // Bullet - or *
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
      if (bulletMatch) {
        listItems.push(
          <li key={key++} className={styles.mdListItem}>{renderInline(bulletMatch[1])}</li>
        );
        continue;
      }

      // Regular text
      flushList();
      elements.push(
        <p key={key++} className={styles.mdParagraph}>{renderInline(trimmed)}</p>
      );
    }
    flushList();
    return elements;
  };

  // Get the code to display based on active tab
  const displayCode = versionMode === 'proposed' && proposedSource ? proposedSource : source;
  const displaySummary = versionMode === 'proposed' && proposedSummary ? proposedSummary : crewSummary;

  // Copy displayed code to clipboard
  const handleCopyCode = useCallback(() => {
    if (!displayCode) return;
    navigator.clipboard.writeText(displayCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [displayCode]);

  // Show loading while crew list loads
  if (isLoadingCrew) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>Loading crew members...</span>
        </div>
      </div>
    );
  }

  // No file-based crews available
  if (crewMembers.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noCrew}>
          <svg className={styles.noCrewIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h3 className={styles.noCrewTitle}>No File-Based Crews</h3>
          <p className={styles.noCrewText}>
            This editor works with file-based crew members (.crew.js files).
            No file-based crews were found for this agent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.selector}>
          <span className={styles.selectorLabel}>Crew Member</span>
          <select
            className={styles.selectorSelect}
            value={selectedCrew}
            onChange={e => setSelectedCrew(e.target.value)}
            disabled={isChatting || isApplying}
          >
            {crewMembers.map(crew => (
              <option key={crew.name} value={crew.name}>
                {crew.displayName} ({crew.name})
              </option>
            ))}
          </select>
        </div>

        {filePath && (
          <span className={styles.filePath} title={filePath}>
            {filePath.replace(/\\/g, '/')}
          </span>
        )}

        <span className={`${styles.sourceBadge} ${defaultVersionInfo ? styles.sourceBadgeGcs : styles.sourceBadgeProject}`}>
          {defaultVersionInfo ? '☁️ GCS Override' : '📁 Project File'}
        </span>

        {proposedSource ? (
          <span className={`${styles.statusBadge} ${styles.statusModified}`}>
            Changes Pending
          </span>
        ) : (
          <span className={`${styles.statusBadge} ${styles.statusFile}`}>
            File-based
          </span>
        )}
      </div>

      {/* Main Panels */}
      <div className={styles.panels}>
        {/* Code Panel */}
        <div className={`${styles.codePanel} ${!codeExpanded ? styles.codePanelCollapsed : ''}`}>
          {codeExpanded && (
            <>
              <div className={styles.codePanelHeader}>
                <div className={styles.codePanelTitle} title={filePath}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  {selectedCrew ? `${selectedCrew}.crew.js` : 'Source Code'}
                </div>

                <div className={styles.codeTabs}>
                  <button
                    className={`${styles.codeTab} ${viewMode === 'prompts' ? styles.codeTabActive : ''}`}
                    onClick={() => setViewMode('prompts')}
                  >
                    Prompts
                  </button>
                  <button
                    className={`${styles.codeTab} ${viewMode === 'source' ? styles.codeTabActive : ''}`}
                    onClick={() => setViewMode('source')}
                  >
                    Source
                  </button>
                </div>

                <div className={styles.codePanelActions}>
                  {viewMode === 'source' && (
                    <button
                      className={styles.iconButton}
                      onClick={handleCopyCode}
                      disabled={!displayCode}
                      title={copied ? 'Copied!' : 'Copy code'}
                    >
                      {copied ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      )}
                    </button>
                  )}
                  <button
                    className={styles.iconButton}
                    onClick={() => setCodeExpanded(false)}
                    title="Collapse code panel"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="11 17 6 12 11 7" />
                      <polyline points="18 17 13 12 18 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Version pill toggle — only shown when proposed changes exist */}
              {proposedSource && (
                <div className={styles.versionToggleBar}>
                  <div className={styles.versionPill}>
                    <button
                      className={`${styles.versionPillOption} ${versionMode === 'current' ? styles.versionPillActive : ''}`}
                      onClick={() => setVersionMode('current')}
                    >
                      Current
                    </button>
                    <button
                      className={`${styles.versionPillOption} ${versionMode === 'proposed' ? styles.versionPillActive : ''}`}
                      onClick={() => setVersionMode('proposed')}
                    >
                      Proposed
                    </button>
                  </div>
                  {versionMode === 'proposed' && (
                    <span className={styles.versionHint}>Showing proposed changes</span>
                  )}
                </div>
              )}

              <div className={viewMode === 'prompts' ? styles.promptsContainer : styles.codeContent}>
                {isLoadingSource ? (
                  <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <span className={styles.loadingText}>Loading source...</span>
                  </div>
                ) : viewMode === 'prompts' ? (
                  displaySummary ? (
                    <div className={styles.promptsView}>
                      {/* Guidance */}
                      <div className={styles.promptSection}>
                        <div className={styles.promptSectionHeader}>
                          <h3 className={styles.promptSectionTitle}>Guidance</h3>
                        </div>
                        <div className={styles.promptBody}>
                          {displaySummary.guidance
                            ? renderMarkdown(displaySummary.guidance)
                            : <span className={styles.promptEmpty}>No guidance found</span>}
                        </div>
                      </div>

                      {/* Thinking Prompt (thinker crews only) */}
                      {displaySummary.isThinker && displaySummary.thinkingPrompt && (
                        <div className={styles.promptSection}>
                          <div className={styles.promptSectionHeader}>
                            <h3 className={styles.promptSectionTitle}>Thinking Prompt</h3>
                            <span className={styles.promptSectionBadge}>Thinker</span>
                          </div>
                          <div className={styles.promptBody}>
                            {renderMarkdown(displaySummary.thinkingPrompt)}
                          </div>
                        </div>
                      )}

                      {/* Fields */}
                      {displaySummary.fields.length > 0 && (
                        <div className={styles.promptSection}>
                          <div className={styles.promptSectionHeader}>
                            <h3 className={styles.promptSectionTitle}>Fields to Collect</h3>
                            <span className={styles.promptFieldCount}>{displaySummary.fields.length}</span>
                          </div>
                          <div className={styles.promptFieldsGrid}>
                            {displaySummary.fields.map(f => (
                              <div key={f.name} className={styles.promptFieldRow}>
                                <code className={styles.promptFieldName}>{f.name}</code>
                                <span className={styles.promptFieldDesc}>{f.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Transition */}
                      {displaySummary.transitionTo && (
                        <div className={styles.promptSection}>
                          <div className={styles.promptSectionHeader}>
                            <h3 className={styles.promptSectionTitle}>Transitions to</h3>
                          </div>
                          <div className={styles.promptTransition}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                            <code>{displaySummary.transitionTo}</code>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#858585' }}>No source code loaded</span>
                  )
                ) : displayCode ? (
                  renderCode(displayCode)
                ) : (
                  <span style={{ color: '#858585' }}>No source code loaded</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Chat Panel */}
        <div className={`${styles.chatPanel} ${!codeExpanded ? styles.chatPanelExpanded : ''}`}>
          <div className={styles.chatHeader}>
            <div className={styles.chatTitle}>
              {!codeExpanded && (
                <button
                  className={styles.iconButton}
                  onClick={() => setCodeExpanded(true)}
                  title="Expand code panel"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="13 17 18 12 13 7" />
                    <polyline points="6 17 11 12 6 7" />
                  </svg>
                </button>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Chat with Claude
            </div>
          </div>

          {/* Messages or Empty State */}
          {messages.length === 0 && !isChatting ? (
            <div className={styles.chatEmpty}>
              <svg className={styles.chatEmptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <h3 className={styles.chatEmptyTitle}>Edit with AI</h3>
              <p className={styles.chatEmptyText}>
                Describe what you want to change about this crew member. For example:
                "Make the agent ask one question at a time" or
                "The tone is too formal, make it friendlier."
              </p>
            </div>
          ) : (
            <div className={styles.chatMessages}>
              {proposedSource && (
                <div className={styles.proposedNotice}>
                  <svg className={styles.proposedNoticeIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Claude proposed changes. Review them in the code panel, then click "Apply Changes" to save.
                </div>
              )}

              {messages.map((msg, i) => {
                const formatted = msg.role === 'assistant' ? formatMessageContent(msg.content) : null;
                const displayText = formatted ? formatted.text : msg.content;

                return (
                  <div
                    key={i}
                    className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
                  >
                    <span className={styles.messageLabel}>
                      {msg.role === 'user' ? 'You' : 'Claude'}
                    </span>
                    {displayText && (
                      <div
                        className={`${styles.messageBubble} ${msg.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleAssistant}`}
                      >
                        {displayText}
                      </div>
                    )}
                    {formatted?.hasCode && (
                      <div className={styles.changeSummaryBox}>
                        <div className={styles.changeSummaryHeader}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Changes ready — review in the code panel
                        </div>
                        {formatted.changeGroups.length > 0 && (
                          <div className={styles.changeSummaryBody}>
                            {formatted.changeGroups.map((group, gi) => (
                              <div key={gi} className={styles.changeGroup}>
                                <div className={styles.changeGroupHeader}>
                                  <span className={styles.changeGroupEmoji}>{group.emoji}</span>
                                  <span className={styles.changeGroupLabel}>{group.label}</span>
                                  {group.items.length > 1 && (
                                    <span className={styles.changeGroupCount}>{group.items.length}</span>
                                  )}
                                </div>
                                {group.items.map((item, ii) => (
                                  <div key={ii} className={styles.changeGroupItem}>{item}</div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {isChatting && !isGenerating && (
                <div className={styles.thinking}>
                  <div className={styles.thinkingDots}>
                    <span className={styles.thinkingDot} />
                    <span className={styles.thinkingDot} />
                    <span className={styles.thinkingDot} />
                  </div>
                  <span className={styles.thinkingText}>
                    Claude is thinking...
                  </span>
                </div>
              )}

              {isGenerating && (
                <div className={styles.generatingBanner}>
                  <div className={styles.generatingSpinner} />
                  <div className={styles.generatingContent}>
                    <span className={styles.generatingTitle}>Generating updated file...</span>
                    <span className={styles.generatingHint}>This can take a minute or two. Claude is rewriting the full file with your changes.</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}

          {/* Chat Input */}
          <div className={styles.chatInputArea}>
            <textarea
              ref={inputRef}
              className={styles.chatInput}
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value);
                // Auto-resize: reset height then set to scrollHeight
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 300)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={selectedCrew ? 'Paste conversation feedback or describe what you want to change...' : 'Select a crew member first'}
              disabled={!selectedCrew || isChatting || isGenerating || isApplying || isLoadingSource}
              rows={3}
            />
            <div className={styles.chatInputButtons}>
              <button
                className={styles.sendButton}
                onClick={handleSend}
                disabled={!inputValue.trim() || isChatting || isGenerating || !selectedCrew || isApplying || isLoadingSource}
              >
                Send
              </button>
              <button
                className={styles.generateButton}
                onClick={handleGenerate}
                disabled={messages.length === 0 || isChatting || isGenerating || !selectedCrew || isApplying}
                title="Generate the updated file based on the discussion"
              >
                {isGenerating ? (
                  <>
                    <div className={styles.spinner} style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                    Generate Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className={styles.actionBar}>
        <div className={styles.actionBarLeft}>
          <button
            className={styles.exportButton}
            onClick={handleExport}
            disabled={!source && !proposedSource}
            title="Download the current file"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export
          </button>

          <div className={styles.versionsWrapper} ref={versionsRef}>
            <button
              className={`${styles.exportButton} ${showVersions ? styles.versionsButtonActive : ''}`}
              onClick={handleLoadVersions}
              disabled={!selectedCrew}
              title="View backup history"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              History
            </button>

            {showVersions && (
              <div className={styles.versionsDropdown}>
                <div className={styles.versionsHeader}>Backup History</div>
                {isLoadingVersions ? (
                  <div className={styles.versionsLoading}>
                    <div className={styles.spinner} style={{ width: 18, height: 18, borderWidth: 2 }} />
                    <span>Loading...</span>
                  </div>
                ) : versions.length === 0 ? (
                  <div className={styles.versionsEmpty}>No backups found</div>
                ) : (
                  <div className={styles.versionsList}>
                    {versions.map(v => (
                      <div key={v.timestamp} className={`${styles.versionItem} ${v.isDefault ? styles.versionItemDefault : ''}`}>
                        <button
                          className={`${styles.versionStar} ${v.isDefault ? styles.versionStarActive : ''}`}
                          onClick={() => handleSetDefault(v.timestamp)}
                          disabled={!!settingDefault}
                          title={v.isDefault ? 'Unset default (revert to project file)' : 'Set as default'}
                        >
                          {settingDefault === v.timestamp ? '...' : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={v.isDefault ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          )}
                        </button>
                        <div className={styles.versionInfo}>
                          {v.versionName ? (
                            <>
                              <span className={styles.versionDate}>
                                {v.versionName}
                                {v.isDefault && <span className={styles.defaultBadge}>(active)</span>}
                              </span>
                              <span className={styles.versionSize}>{formatTimestamp(v.timestamp)}</span>
                            </>
                          ) : (
                            <>
                              <span className={styles.versionDate}>
                                {formatTimestamp(v.timestamp)}
                                {v.isDefault && <span className={styles.defaultBadge}>(active)</span>}
                              </span>
                              <span className={styles.versionSize}>{(v.size / 1024).toFixed(1)} KB</span>
                            </>
                          )}
                        </div>
                        <div className={styles.versionActions}>
                          <button
                            className={styles.versionRestore}
                            onClick={() => handleRestore(v.timestamp)}
                            disabled={!!restoringVersion || !!deletingVersion}
                            title="Load this version"
                          >
                            {restoringVersion === v.timestamp ? '...' : 'Load'}
                          </button>
                          <button
                            className={styles.versionDelete}
                            onClick={() => handleDeleteVersion(v.timestamp)}
                            disabled={!!restoringVersion || !!deletingVersion}
                            title="Delete this backup"
                          >
                            {deletingVersion === v.timestamp ? '...' : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Project File entry — always shown */}
                    <div className={`${styles.versionItem} ${styles.versionItemProject} ${!defaultVersionInfo ? styles.versionItemDefault : ''}`}>
                      <button
                        className={`${styles.versionStar} ${!defaultVersionInfo ? styles.versionStarActive : ''}`}
                        onClick={handleUnsetDefault}
                        disabled={!!settingDefault || !defaultVersionInfo}
                        title={!defaultVersionInfo ? 'Project file is the current default' : 'Unset GCS default (revert to project file)'}
                      >
                        {settingDefault === 'project' ? '...' : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={!defaultVersionInfo ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        )}
                      </button>
                      <div className={styles.versionInfo}>
                        <span className={styles.versionDate}>
                          📁 Project File
                          {!defaultVersionInfo && <span className={styles.defaultBadge}>(active)</span>}
                        </span>
                        {projectFile?.exists && (
                          <span className={styles.versionSize}>{(projectFile.size / 1024).toFixed(1)} KB</span>
                        )}
                      </div>
                      <div className={styles.versionActions}>
                        <button
                          className={styles.versionRestore}
                          onClick={handleLoadProjectFile}
                          disabled={!!restoringVersion || !!deletingVersion}
                          title="Load project file"
                        >
                          {restoringVersion === 'project' ? '...' : 'Load'}
                        </button>
                        {/* spacer matching delete button width for alignment */}
                        <span style={{ width: 20 }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {loadedVersionTimestamp && proposedSource && (() => {
            const isAlreadyDefault = versions.find(
              v => v.timestamp === loadedVersionTimestamp
            )?.isDefault;

            return isAlreadyDefault ? (
              <button
                className={`${styles.setDefaultButton} ${styles.setDefaultButtonActive}`}
                disabled
                title="This version is already the default"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Default ✓
              </button>
            ) : (
              <button
                className={styles.setDefaultButton}
                onClick={() => handleSetDefault(loadedVersionTimestamp)}
                disabled={!!settingDefault}
                title="Mark this version as the default (auto-loads on server start)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {settingDefault ? 'Setting...' : 'Set as Default'}
              </button>
            );
          })()}

          {proposedSource && (
            <button
              className={styles.discardButton}
              onClick={handleDiscard}
              disabled={isApplying}
            >
              Discard Changes
            </button>
          )}

          {statusMessage && (
            <span className={statusMessage.type === 'success' ? styles.successMessage : styles.errorMessage}>
              {statusMessage.text}
            </span>
          )}
        </div>

        <div className={styles.actionBarRight}>
          {proposedSource && (
            <button
              className={styles.applyButton}
              onClick={handleApply}
              disabled={isApplying || !proposedSource}
            >
              {isApplying ? (
                <>
                  <div className={styles.spinner} style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Applying...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Apply Changes
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Apply prompt dialog */}
      {showApplyPrompt && (
        <div className={styles.applyPromptOverlay} onClick={() => setShowApplyPrompt(false)}>
          <div className={styles.applyPromptDialog} onClick={e => e.stopPropagation()}>
            <h3 className={styles.applyPromptTitle}>Apply Changes</h3>
            <p className={styles.applyPromptHint}>
              Name this version so you can find it later in backup history.
            </p>
            <input
              type="text"
              className={styles.applyPromptInput}
              value={versionName}
              onChange={e => setVersionName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirmApply()}
              placeholder="e.g. &quot;friendlier tone&quot; or &quot;added follow-up questions&quot;"
              autoFocus
            />
            <div className={styles.applyPromptActions}>
              <button
                className={styles.applyPromptSkip}
                onClick={handleConfirmApply}
              >
                Skip — apply without name
              </button>
              <button
                className={styles.applyButton}
                onClick={handleConfirmApply}
                disabled={!versionName.trim()}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
