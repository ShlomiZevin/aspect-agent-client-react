import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { CreateTaskData, TaskPriority } from '../../../types/task';
import type { Message } from '../../../types/chat';
import type { CrewMember, FieldToCollect } from '../../../types/crew';
import { getFields } from '../../../services/fieldsService';
import styles from './AgentBugModal.module.css';

// Bug categories for agent issues
export type AgentBugCategory =
  | 'wrong_reply'
  | 'didnt_use_kb'
  | 'false_transition_early'
  | 'false_no_transition'
  | 'false_wrong_crew'
  | 'field_not_caught'
  | 'field_falsely_caught'
  | 'other';

interface BugCategoryOption {
  value: AgentBugCategory;
  label: string;
  description: string;
}

const BUG_CATEGORIES: BugCategoryOption[] = [
  { value: 'wrong_reply', label: 'Wrong Reply', description: 'LLM hallucination, made things up, or gave false info' },
  { value: 'didnt_use_kb', label: "Didn't Use KB", description: 'Should have used knowledge base but didn\'t' },
  { value: 'false_transition_early', label: 'Transitioned Too Early', description: 'Falsely transitioned to next crew before completing' },
  { value: 'false_no_transition', label: "Didn't Transition", description: 'Should have transitioned but didn\'t' },
  { value: 'false_wrong_crew', label: 'Wrong Crew Transition', description: 'Transitioned to the wrong crew member' },
  { value: 'field_not_caught', label: 'Field Not Caught', description: 'Failed to extract a field it should have' },
  { value: 'field_falsely_caught', label: 'Field Falsely Caught', description: 'Incorrectly extracted a field value' },
  { value: 'other', label: 'Other', description: 'Other agent-related bug' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

interface FieldIssue {
  fieldName: string;
  actualValue: string;
  expectedValue: string;
}

interface AgentBugModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskData) => Promise<void>;
  message: Message;
  currentDomain: string;
  conversationUrl: string;
  crewMembers: CrewMember[];
  conversationId?: string | null;
}

// Truncate message content for preview
function truncateMessage(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}

export function AgentBugModal({
  isOpen,
  onClose,
  onSubmit,
  message,
  currentDomain,
  conversationUrl,
  crewMembers,
  conversationId,
}: AgentBugModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<AgentBugCategory>('wrong_reply');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Source crew - the crew that generated the message (editable, defaults to message.crewMember)
  const [sourceCrew, setSourceCrew] = useState('');

  // For transition bugs - target crew they should have transitioned to
  const [targetCrew, setTargetCrew] = useState('');

  // For field bugs
  const [fieldIssues, setFieldIssues] = useState<FieldIssue[]>([{ fieldName: '', actualValue: '', expectedValue: '' }]);
  const [fieldSearch, setFieldSearch] = useState('');
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const [highlightedFieldIndex, setHighlightedFieldIndex] = useState(-1);
  const [activeFieldIssueIndex, setActiveFieldIssueIndex] = useState(0);
  const fieldInputRef = useRef<HTMLInputElement>(null);

  // Collected field values (fetched when modal opens)
  const [collectedFields, setCollectedFields] = useState<Record<string, string>>({});

  // Get the selected source crew member object
  const sourceCrewMember = useMemo(() => {
    return crewMembers.find(c => c.name === sourceCrew) || null;
  }, [crewMembers, sourceCrew]);

  // Get available fields from ALL crew members (not just current)
  const availableFields = useMemo(() => {
    const allFields: FieldToCollect[] = [];
    const seenNames = new Set<string>();

    for (const crew of crewMembers) {
      if (crew.fieldsToCollect) {
        for (const field of crew.fieldsToCollect) {
          if (!seenNames.has(field.name)) {
            seenNames.add(field.name);
            allFields.push(field);
          }
        }
      }
    }

    return allFields;
  }, [crewMembers]);

  // Field autocomplete suggestions
  const fieldSuggestions = useMemo(() => {
    if (fieldSearch.length < 1) return [];
    const search = fieldSearch.toLowerCase();
    return availableFields.filter(f =>
      f.name.toLowerCase().includes(search) ||
      f.description.toLowerCase().includes(search)
    ).slice(0, 6);
  }, [fieldSearch, availableFields]);

  // Fetch collected fields when modal opens
  useEffect(() => {
    if (isOpen && conversationId) {
      getFields(conversationId)
        .then(response => {
          setCollectedFields(response.collectedFields || {});
        })
        .catch(err => {
          console.error('Failed to fetch fields:', err);
          setCollectedFields({});
        });
    }
  }, [isOpen, conversationId]);

  // Reset form when opened - use message.crewMember as default source crew
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setCategory('wrong_reply');
      setPriority('medium');
      setNotes('');
      // Default to the crew that generated this message
      const messageCrewName = message.crewMember || '';
      const matchingCrew = crewMembers.find(c =>
        c.name === messageCrewName || c.displayName === messageCrewName
      );
      setSourceCrew(matchingCrew?.name || messageCrewName);
      setTargetCrew('');
      setFieldIssues([{ fieldName: '', actualValue: '', expectedValue: '' }]);
      setFieldSearch('');
      setCollectedFields({});
    }
  }, [isOpen, message.crewMember, crewMembers]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close field dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fieldInputRef.current && !fieldInputRef.current.contains(e.target as Node)) {
        setShowFieldDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFieldSelect = useCallback((field: FieldToCollect) => {
    const newIssues = [...fieldIssues];
    // Auto-fill actualValue with collected value if available
    const collectedValue = collectedFields[field.name] || '';
    newIssues[activeFieldIssueIndex] = {
      ...newIssues[activeFieldIssueIndex],
      fieldName: field.name,
      actualValue: collectedValue,
    };
    setFieldIssues(newIssues);
    setFieldSearch('');
    setShowFieldDropdown(false);
    setHighlightedFieldIndex(-1);
  }, [fieldIssues, activeFieldIssueIndex, collectedFields]);

  const handleFieldKeyDown = (e: React.KeyboardEvent, _index: number) => {
    if (e.key === 'Escape') {
      setShowFieldDropdown(false);
      setHighlightedFieldIndex(-1);
      return;
    }

    if (!showFieldDropdown || fieldSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedFieldIndex(prev =>
          prev < fieldSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedFieldIndex(prev =>
          prev > 0 ? prev - 1 : fieldSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedFieldIndex >= 0 && fieldSuggestions[highlightedFieldIndex]) {
          handleFieldSelect(fieldSuggestions[highlightedFieldIndex]);
        }
        break;
    }
  };

  const addFieldIssue = () => {
    setFieldIssues([...fieldIssues, { fieldName: '', actualValue: '', expectedValue: '' }]);
  };

  const removeFieldIssue = (index: number) => {
    if (fieldIssues.length > 1) {
      setFieldIssues(fieldIssues.filter((_, i) => i !== index));
    }
  };

  const updateFieldIssue = (index: number, field: keyof FieldIssue, value: string) => {
    const newIssues = [...fieldIssues];
    newIssues[index] = { ...newIssues[index], [field]: value };
    setFieldIssues(newIssues);
  };

  // Build description from form data - structured HTML for rich display
  const buildDescription = (): string => {
    const categoryInfo = BUG_CATEGORIES.find(c => c.value === category);

    let html = `<h3 style="margin:0 0 12px 0;font-size:16px;">Bug Details</h3>
<table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
<tr>
  <td style="padding:6px 12px 6px 0;font-weight:600;width:140px;vertical-align:top;">Type</td>
  <td style="padding:6px 0;">${categoryInfo?.label || category}</td>
</tr>
<tr>
  <td style="padding:6px 12px 6px 0;font-weight:600;vertical-align:top;">Category</td>
  <td style="padding:6px 0;">${categoryInfo?.description || ''}</td>
</tr>`;

    // Crew info for transition bugs
    if (['false_transition_early', 'false_no_transition', 'false_wrong_crew'].includes(category)) {
      html += `
<tr>
  <td style="padding:6px 12px 6px 0;font-weight:600;vertical-align:top;">Source Crew</td>
  <td style="padding:6px 0;">${sourceCrewMember?.displayName || sourceCrewMember?.name || sourceCrew || 'Unknown'}</td>
</tr>`;
      if (category === 'false_wrong_crew' && targetCrew) {
        const targetCrewMember = crewMembers.find(c => c.name === targetCrew);
        html += `
<tr>
  <td style="padding:6px 12px 6px 0;font-weight:600;vertical-align:top;">Should Transition To</td>
  <td style="padding:6px 0;">${targetCrewMember?.displayName || targetCrew}</td>
</tr>`;
      }
    }

    html += '\n</table>';

    // Field issues
    if (['field_not_caught', 'field_falsely_caught'].includes(category)) {
      const validIssues = fieldIssues.filter(issue => issue.fieldName);
      if (validIssues.length > 0) {
        html += `\n<h3 style="margin:16px 0 12px 0;font-size:16px;">Field Issues</h3>
<table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
<tr style="background:#f1f5f9;">
  <th style="padding:8px 12px;text-align:left;font-weight:600;">Field</th>
  <th style="padding:8px 12px;text-align:left;font-weight:600;">Actual</th>`;
        if (category === 'field_falsely_caught') {
          html += '\n  <th style="padding:8px 12px;text-align:left;font-weight:600;">Expected</th>';
        }
        html += '\n</tr>';
        validIssues.forEach(issue => {
          html += `\n<tr>
  <td style="padding:8px 12px;border-top:1px solid #e2e8f0;"><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${issue.fieldName}</code></td>
  <td style="padding:8px 12px;border-top:1px solid #e2e8f0;">${issue.actualValue || '-'}</td>`;
          if (category === 'field_falsely_caught') {
            html += `\n  <td style="padding:8px 12px;border-top:1px solid #e2e8f0;">${issue.expectedValue || '-'}</td>`;
          }
          html += '\n</tr>';
        });
        html += '\n</table>';
      }
    }

    // User notes
    if (notes.trim()) {
      html += `\n<h3 style="margin:16px 0 12px 0;font-size:16px;">Notes</h3>
<p style="margin:0;padding:12px;background:#f8fafc;border-radius:6px;line-height:1.5;">${notes.replace(/\n/g, '<br>')}</p>`;
    }

    // Message context
    html += `\n\n<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
<h4 style="margin:0 0 12px 0;font-size:14px;color:#64748b;">Message Context</h4>
<table style="border-collapse:collapse;width:100%;margin-bottom:12px;">
<tr>
  <td style="padding:4px 12px 4px 0;font-weight:600;width:120px;">Message ID</td>
  <td style="padding:4px 0;"><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${message.dbId || message.id}</code></td>
</tr>
<tr>
  <td style="padding:4px 12px 4px 0;font-weight:600;">Crew Member</td>
  <td style="padding:4px 0;">${message.crewMember || 'Unknown'}</td>
</tr>
<tr>
  <td style="padding:4px 12px 4px 0;font-weight:600;">Conversation</td>
  <td style="padding:4px 0;"><a href="${conversationUrl}" style="color:#3b82f6;word-break:break-all;">${conversationUrl}</a></td>
</tr>
</table>

<details style="margin-top:12px;">
<summary style="cursor:pointer;font-weight:600;color:#64748b;font-size:13px;">Message Preview</summary>
<blockquote style="margin:8px 0 0 0;padding:12px;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:0 6px 6px 0;font-size:13px;line-height:1.5;">${truncateMessage(message.content, 300).replace(/\n/g, '<br>')}</blockquote>
</details>`;

    return html;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: buildDescription(),
        type: 'bug',
        priority,
        domain: currentDomain,
        status: 'todo',
        tags: ['agent-bug', category, sourceCrew || 'unknown-crew'].filter(Boolean),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isTransitionBug = ['false_transition_early', 'false_no_transition', 'false_wrong_crew'].includes(category);
  const isFieldBug = ['field_not_caught', 'field_falsely_caught'].includes(category);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className={styles.header}>
            <h3>Report Agent Bug</h3>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              ×
            </button>
          </div>

          <div className={styles.body}>
            {/* Message Preview */}
            <div className={styles.messagePreview}>
              <div className={styles.previewHeader}>
                <span className={styles.crewBadge}>{message.crewMember || 'Assistant'}</span>
                <span className={styles.messageId}>ID: {message.dbId || message.id}</span>
              </div>
              <div className={styles.previewContent}>
                {truncateMessage(message.content, 150)}
              </div>
            </div>

            {/* Title */}
            <div className={styles.field}>
              <label htmlFor="ab-title">Title *</label>
              <input
                id="ab-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief description of the issue..."
                autoFocus
                required
              />
            </div>

            {/* Category */}
            <div className={styles.field}>
              <label htmlFor="ab-category">Bug Category</label>
              <select
                id="ab-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as AgentBugCategory)}
              >
                {BUG_CATEGORIES.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className={styles.categoryHint}>
                {BUG_CATEGORIES.find(c => c.value === category)?.description}
              </span>
            </div>

            {/* Transition-specific: Crew selector */}
            {isTransitionBug && (
              <div className={styles.conditionalSection}>
                <div className={styles.field}>
                  <label htmlFor="ab-source-crew">Source Crew (who generated this message)</label>
                  <select
                    id="ab-source-crew"
                    value={sourceCrew}
                    onChange={(e) => setSourceCrew(e.target.value)}
                  >
                    <option value="">Select crew...</option>
                    {crewMembers.map(crew => (
                      <option key={crew.name} value={crew.name}>
                        {crew.displayName || crew.name}
                      </option>
                    ))}
                  </select>
                </div>
                {category === 'false_wrong_crew' && (
                  <div className={styles.field}>
                    <label htmlFor="ab-target-crew">Should Have Transitioned To</label>
                    <select
                      id="ab-target-crew"
                      value={targetCrew}
                      onChange={(e) => setTargetCrew(e.target.value)}
                    >
                      <option value="">Select crew...</option>
                      {crewMembers
                        .filter(c => c.name !== sourceCrew)
                        .map(crew => (
                          <option key={crew.name} value={crew.name}>
                            {crew.displayName || crew.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Field-specific: Field issues */}
            {isFieldBug && (
              <div className={styles.conditionalSection}>
                <div className={styles.sectionHeader}>
                  <span>Field Issues</span>
                  <button
                    type="button"
                    className={styles.addFieldBtn}
                    onClick={addFieldIssue}
                  >
                    + Add Field
                  </button>
                </div>
                {fieldIssues.map((issue, index) => (
                  <div key={index} className={styles.fieldIssueRow}>
                    <div className={styles.fieldIssueFields}>
                      <div className={styles.fieldAutocomplete} ref={index === activeFieldIssueIndex ? fieldInputRef : undefined}>
                        <input
                          type="text"
                          placeholder="Field name (type or select)..."
                          value={activeFieldIssueIndex === index && fieldSearch ? fieldSearch : issue.fieldName}
                          onChange={(e) => {
                            setFieldSearch(e.target.value);
                            setActiveFieldIssueIndex(index);
                            setShowFieldDropdown(e.target.value.length > 0);
                            // Also update the field name directly for free-form typing
                            updateFieldIssue(index, 'fieldName', e.target.value);
                          }}
                          onFocus={() => {
                            setActiveFieldIssueIndex(index);
                            setFieldSearch(issue.fieldName);
                            if (issue.fieldName.length > 0) {
                              setShowFieldDropdown(true);
                            }
                          }}
                          onBlur={() => {
                            // Small delay to allow click on suggestion
                            setTimeout(() => {
                              setShowFieldDropdown(false);
                              setFieldSearch('');
                            }, 150);
                          }}
                          onKeyDown={(e) => handleFieldKeyDown(e, index)}
                        />
                        {issue.fieldName && (
                          <button
                            type="button"
                            className={styles.clearFieldBtn}
                            onClick={() => {
                              updateFieldIssue(index, 'fieldName', '');
                              setFieldSearch('');
                            }}
                          >
                            ×
                          </button>
                        )}
                        {showFieldDropdown && activeFieldIssueIndex === index && fieldSuggestions.length > 0 && (
                          <div className={styles.fieldDropdown}>
                            {fieldSuggestions.map((field, i) => (
                              <div
                                key={field.name}
                                className={`${styles.fieldOption} ${i === highlightedFieldIndex ? styles.highlighted : ''}`}
                                onClick={() => handleFieldSelect(field)}
                                onMouseEnter={() => setHighlightedFieldIndex(i)}
                              >
                                <span className={styles.fieldName}>{field.name}</span>
                                <span className={styles.fieldDesc}>{field.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder={category === 'field_not_caught' ? 'Value that should have been caught...' : 'Actual (wrong) value...'}
                        value={issue.actualValue}
                        onChange={(e) => updateFieldIssue(index, 'actualValue', e.target.value)}
                      />
                      {category === 'field_falsely_caught' && (
                        <input
                          type="text"
                          placeholder="Expected (correct) value..."
                          value={issue.expectedValue}
                          onChange={(e) => updateFieldIssue(index, 'expectedValue', e.target.value)}
                        />
                      )}
                    </div>
                    {fieldIssues.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeFieldBtn}
                        onClick={() => removeFieldIssue(index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Priority */}
            <div className={styles.field}>
              <label htmlFor="ab-priority">Priority</label>
              <select
                id="ab-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Additional Notes */}
            <div className={styles.field}>
              <label htmlFor="ab-notes">Additional Notes</label>
              <textarea
                id="ab-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional context..."
                rows={3}
              />
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Bug Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
