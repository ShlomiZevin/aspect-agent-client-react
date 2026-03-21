import { useRef, useCallback, useEffect, useState } from 'react';
import type { Assignee } from '../../../types/task';
import styles from './RichTextEditor.module.css';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  expanded?: boolean;
  assignees?: Assignee[];
}

type FormatCommand = 'bold' | 'underline' | 'insertUnorderedList';

interface ActiveFormats {
  bold: boolean;
  underline: boolean;
  list: boolean;
  code: boolean;
  heading: boolean;
  checklist: boolean;
}

function avatarColor(name: string): string {
  const colors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// Check if text is mostly Hebrew (RTL) by comparing Hebrew vs Latin letter counts
function isMostlyHebrew(html: string): boolean {
  // Strip HTML tags to get plain text
  const text = html.replace(/<[^>]*>/g, '');
  const hebrew = text.match(/[\u0590-\u05FF]/g)?.length || 0;
  const latin = text.match(/[a-zA-Z]/g)?.length || 0;
  return hebrew > latin;
}

export function RichTextEditor({ value, onChange, placeholder, expanded, assignees }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    underline: false,
    list: false,
    code: false,
    heading: false,
    checklist: false,
  });
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<{ query: string; bottom: number; left: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const filteredMentions = mentionAnchor !== null && assignees
    ? assignees.filter(a => a.name.toLowerCase().startsWith(mentionAnchor.query.toLowerCase()))
    : [];

  // Check if selection is inside a specific element
  const isInElement = useCallback((tagName: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    let node: Node | null = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeName === tagName) return true;
      node = node.parentNode;
    }
    return false;
  }, []);

  // Check if selection is inside a heading span
  const isInHeading = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    let node: Node | null = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'SPAN' && (node as HTMLElement).classList?.contains('heading')) return true;
      node = node.parentNode;
    }
    return false;
  }, []);

  // Check if cursor is inside a checklist label
  const isInChecklist = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    let node: Node | null = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if ((node as HTMLElement).classList?.contains('checklist-item')) return true;
      node = node.parentNode;
    }
    return false;
  }, []);

  // Check which formats are active at current selection
  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      underline: document.queryCommandState('underline'),
      list: document.queryCommandState('insertUnorderedList'),
      code: isInElement('CODE'),
      heading: isInHeading(),
      checklist: isInChecklist(),
    });
  }, [isInElement, isInHeading, isInChecklist]);

  // Set initial value and sync external changes (but not our own changes)
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    isInternalChange.current = false;
  }, [value]);

  // Listen for selection changes to update active formats
  useEffect(() => {
    const handleSelectionChange = () => {
      if (editorRef.current?.contains(document.activeElement)) {
        updateActiveFormats();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateActiveFormats]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightboxImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  const execCommand = useCallback((command: FormatCommand, val?: string) => {
    document.execCommand(command, false, val);
    // Update parent with new content
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Find parent element of given tag name
  const findParentElement = (tagName: string): HTMLElement | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    let node: Node | null = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeName === tagName) return node as HTMLElement;
      node = node.parentNode;
    }
    return null;
  };

  // Toggle wrap/unwrap for inline elements (code)
  const toggleInlineElement = (tagName: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    const parent = findParentElement(tagName);
    if (parent) {
      // Unwrap - replace element with its text content
      const text = document.createTextNode(parent.textContent || '');
      parent.parentNode?.replaceChild(text, parent);
    } else {
      // Wrap selected text
      const selectedText = range.toString();
      if (selectedText) {
        const element = document.createElement(tagName.toLowerCase());
        element.textContent = selectedText;
        range.deleteContents();
        range.insertNode(element);
        range.setStartAfter(element);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  // Toggle heading (larger font size span)
  const toggleHeading = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    // Check if we're inside a heading span
    let headingParent: HTMLElement | null = null;
    let node: Node | null = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'SPAN' && (node as HTMLElement).classList?.contains('heading')) {
        headingParent = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }

    if (headingParent) {
      // Unwrap - replace heading span with its text content
      const text = document.createTextNode(headingParent.textContent || '');
      headingParent.parentNode?.replaceChild(text, headingParent);
    } else {
      // Wrap selected text in heading span
      const selectedText = range.toString();
      if (selectedText) {
        const span = document.createElement('span');
        span.className = 'heading';
        span.textContent = selectedText;
        range.deleteContents();
        range.insertNode(span);
        range.setStartAfter(span);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  // Toggle checklist: wraps current line in a label with checkbox
  const toggleChecklist = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Check if already in a checklist label
    let checklistParent: HTMLElement | null = null;
    let node: Node | null = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if ((node as HTMLElement).classList?.contains?.('checklist-item')) {
        checklistParent = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }

    if (checklistParent) {
      // Remove checklist — extract text, remove the label
      const text = checklistParent.textContent || '';
      const textNode = document.createTextNode(text);
      checklistParent.parentNode?.replaceChild(textNode, checklistParent);
    } else {
      // Create checklist item at current line
      const range = selection.getRangeAt(0);

      // Find the current block element (div, p, or li)
      let block: Node | null = selection.anchorNode;
      while (block && block !== editorRef.current && block.parentNode !== editorRef.current) {
        block = block.parentNode;
      }

      const label = document.createElement('div');
      label.className = 'checklist-item';
      label.style.cssText = 'display:flex;align-items:flex-start;gap:6px;padding:2px 0;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.cssText = 'margin-top:3px;cursor:pointer;accent-color:#2563eb;flex-shrink:0;';
      const span = document.createElement('span');

      label.appendChild(checkbox);
      label.appendChild(span);

      if (block && block !== editorRef.current && block.parentNode === editorRef.current) {
        // Wrap existing block content
        span.innerHTML = (block as HTMLElement).innerHTML || block.textContent || '';
        if (!span.innerHTML.trim()) span.innerHTML = '<br>';
        (block as HTMLElement).innerHTML = '';
        block.appendChild(label);
      } else {
        // Insert at cursor
        const text = range.toString() || '';
        span.textContent = text || '';
        if (!span.innerHTML.trim()) span.innerHTML = '<br>';
        range.deleteContents();
        const div = document.createElement('div');
        div.appendChild(label);
        range.insertNode(div);
      }

      // Place cursor inside the span
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleFormat = (format: string) => {
    switch (format) {
      case 'bold':
        execCommand('bold');
        break;
      case 'underline':
        execCommand('underline');
        break;
      case 'heading':
        toggleHeading();
        break;
      case 'list':
        execCommand('insertUnorderedList');
        break;
      case 'code':
        toggleInlineElement('CODE');
        break;
      case 'checklist':
        toggleChecklist();
        break;
    }
    // Keep focus on editor and update active formats
    editorRef.current?.focus();
    setTimeout(updateActiveFormats, 0);
  };

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
    // Check for @mention trigger
    if (assignees?.length) {
      const editor = editorRef.current;
      const sel = window.getSelection();
      if (editor && sel && sel.rangeCount > 0 && sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.setStart(editor, 0);
        preRange.setEnd(range.startContainer, range.startOffset);
        const text = preRange.toString();
        const match = text.match(/@([\w\u00C0-\uFFFF]*)$/);
        if (match) {
          // Use editor element position — cursor rect can return zeros for collapsed ranges
          const editorRect = editor.getBoundingClientRect();
          setMentionAnchor({ query: match[1], bottom: window.innerHeight - editorRect.top + 4, left: editorRect.left });
          setMentionIndex(0);
          return;
        }
      }
    }
    setMentionAnchor(null);
  };

  const insertMention = (name: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const cursorRange = sel.getRangeAt(0);
    const startContainer = cursorRange.startContainer;
    const startOffset = cursorRange.startOffset;
    let atNode: Node | null = null;
    let atOffset = -1;
    // Check current text node first
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const idx = (startContainer.textContent || '').lastIndexOf('@', startOffset - 1);
      if (idx !== -1) { atNode = startContainer; atOffset = idx; }
    }
    // Walk previous text nodes if not found
    if (!atNode) {
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      const nodes: Node[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) {
        if (n === startContainer) break;
        nodes.push(n);
      }
      for (let i = nodes.length - 1; i >= 0; i--) {
        const idx = (nodes[i].textContent || '').lastIndexOf('@');
        if (idx !== -1) { atNode = nodes[i]; atOffset = idx; break; }
      }
    }
    if (!atNode) { setMentionAnchor(null); return; }
    const range = document.createRange();
    range.setStart(atNode, atOffset);
    range.setEnd(startContainer, startOffset);
    range.deleteContents();
    const textNode = document.createTextNode(`@${name} `);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    setMentionAnchor(null);
    isInternalChange.current = true;
    onChange(editor.innerHTML);
  };

  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter inside checklist — create new checklist line or exit on empty
    if (e.key === 'Enter' && !e.shiftKey && isInChecklist()) {
      e.preventDefault();

      // Check if current checklist item text is empty — if so, exit checklist mode
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let checklistItem: HTMLElement | null = null;
        let node: Node | null = selection.anchorNode;
        while (node && node !== editorRef.current) {
          if ((node as HTMLElement).classList?.contains?.('checklist-item')) {
            checklistItem = node as HTMLElement;
            break;
          }
          node = node.parentNode;
        }

        const itemText = checklistItem?.querySelector('span')?.textContent?.trim() || '';
        if (!itemText) {
          // Empty line — exit checklist, replace with plain div
          let block: Node | null = checklistItem;
          while (block && block.parentNode !== editorRef.current) {
            block = block.parentNode;
          }
          if (block && block.parentNode === editorRef.current) {
            const plainDiv = document.createElement('div');
            plainDiv.innerHTML = '<br>';
            block.parentNode?.replaceChild(plainDiv, block);
            const newRange = document.createRange();
            newRange.selectNodeContents(plainDiv);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        } else {
          // Non-empty — create new checklist item
          const div = document.createElement('div');
          const label = document.createElement('div');
          label.className = 'checklist-item';
          label.style.cssText = 'display:flex;align-items:flex-start;gap:6px;padding:2px 0;';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.style.cssText = 'margin-top:3px;cursor:pointer;accent-color:#2563eb;flex-shrink:0;';
          const span = document.createElement('span');
          span.innerHTML = '<br>';
          label.appendChild(checkbox);
          label.appendChild(span);
          div.appendChild(label);

          let block: Node | null = selection.anchorNode;
          while (block && block.parentNode !== editorRef.current) {
            block = block.parentNode;
          }
          if (block && block.parentNode === editorRef.current) {
            block.parentNode!.insertBefore(div, block.nextSibling);
          } else {
            editorRef.current?.appendChild(div);
          }
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }

      if (editorRef.current) {
        isInternalChange.current = true;
        onChange(editorRef.current.innerHTML);
      }
      return;
    }

    if (!mentionAnchor || filteredMentions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(i => (i + 1) % filteredMentions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(i => (i - 1 + filteredMentions.length) % filteredMentions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      insertMention(filteredMentions[mentionIndex]?.name ?? filteredMentions[0].name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMentionAnchor(null);
    }
  };

  // Handle clicks on links and images
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Handle checkbox clicks inside checklist items — three-state cycle
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      e.preventDefault();
      e.stopPropagation();
      const cb = target as HTMLInputElement;
      const item = cb.closest('.checklist-item') as HTMLElement;
      if (!item) return;

      const currentState = item.getAttribute('data-state') || 'unchecked';
      let nextState: string;

      // Get or create the state indicator span
      let indicator = item.querySelector('.checklist-state') as HTMLElement;
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'checklist-state';
        indicator.style.cssText = 'flex-shrink:0;font-size:14px;cursor:pointer;user-select:none;width:18px;text-align:center;';
        // Replace the checkbox with the indicator
        cb.style.display = 'none';
        cb.parentNode?.insertBefore(indicator, cb.nextSibling);
      }

      if (currentState === 'unchecked') {
        nextState = 'pass';
        indicator.textContent = '✅';
        indicator.title = 'Pass — click to mark as fail';
        cb.setAttribute('checked', '');
        const textSpan = item.querySelector('span:not(.checklist-state):not(.checklist-note-text)');
        if (textSpan) (textSpan as HTMLElement).style.textDecoration = 'line-through';
        // Remove fail note if exists
        const note = item.querySelector('.checklist-note');
        if (note) note.remove();
        const noteWrap = item.parentNode?.nextSibling;
        if (noteWrap && (noteWrap as HTMLElement).classList?.contains('checklist-note-wrap')) noteWrap.remove();
        const noteText = item.querySelector('.checklist-note-text');
        if (noteText) noteText.remove();
      } else if (currentState === 'pass') {
        nextState = 'fail';
        indicator.textContent = '❌';
        indicator.title = 'Fail — click to reset';
        cb.setAttribute('checked', '');
        const textSpan = item.querySelector('span:not(.checklist-state):not(.checklist-note-text)');
        if (textSpan) (textSpan as HTMLElement).style.textDecoration = 'none';
        // Add note input below the text
        if (!item.querySelector('.checklist-note')) {
          const noteWrap = document.createElement('div');
          noteWrap.className = 'checklist-note-wrap';
          noteWrap.style.cssText = 'width:100%;padding-left:24px;margin-top:2px;';
          const noteInput = document.createElement('input');
          noteInput.type = 'text';
          noteInput.className = 'checklist-note';
          noteInput.placeholder = 'What failed?';
          noteInput.style.cssText = 'width:100%;border:1px solid #fca5a5;border-radius:4px;padding:2px 6px;font-size:11px;color:#ef4444;background:#fef2f2;outline:none;';
          noteInput.onclick = (ev) => ev.stopPropagation();
          noteInput.onmousedown = (ev) => ev.stopPropagation();
          noteInput.oninput = () => {
            noteInput.setAttribute('value', noteInput.value);
            if (editorRef.current) {
              isInternalChange.current = true;
              onChange(editorRef.current.innerHTML);
            }
          };
          noteWrap.appendChild(noteInput);
          // Insert after the checklist-item's parent div
          const parentDiv = item.parentNode;
          if (parentDiv && parentDiv.parentNode) {
            parentDiv.parentNode.insertBefore(noteWrap, parentDiv.nextSibling);
          } else {
            item.appendChild(noteWrap);
          }
          noteInput.focus();
        }
      } else {
        // fail → unchecked
        nextState = 'unchecked';
        indicator.textContent = '☐';
        indicator.title = 'Unchecked — click to pass';
        cb.removeAttribute('checked');
        const textSpan = item.querySelector('span:not(.checklist-state):not(.checklist-note-text)');
        if (textSpan) (textSpan as HTMLElement).style.textDecoration = 'none';
        const note = item.querySelector('.checklist-note');
        if (note) note.remove();
        const noteWrap = item.parentNode?.nextSibling;
        if (noteWrap && (noteWrap as HTMLElement).classList?.contains('checklist-note-wrap')) noteWrap.remove();
        const noteText = item.querySelector('.checklist-note-text');
        if (noteText) noteText.remove();
      }

      item.setAttribute('data-state', nextState);
      if (editorRef.current) {
        isInternalChange.current = true;
        onChange(editorRef.current.innerHTML);
      }
      return;
    }

    // Handle state indicator clicks (for already-converted items)
    if (target.classList?.contains('checklist-state')) {
      // Find the hidden checkbox and simulate click on it
      const item = target.closest('.checklist-item') as HTMLElement;
      const cb = item?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (cb) {
        // Create a synthetic event that hits the checkbox handler above
        const syntheticEvent = { ...e, target: cb, preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.MouseEvent;
        handleClick(syntheticEvent);
      }
      return;
    }

    // Handle click on checklist note input — prevent propagation
    if (target.classList?.contains('checklist-note')) {
      return;
    }

    // Check if clicked on an image - open lightbox
    if (target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();
      const imgSrc = (target as HTMLImageElement).src;
      if (imgSrc) {
        setLightboxImage(imgSrc);
      }
      return;
    }

    // Check if clicked on a link or inside a link
    const link = target.closest('a');
    if (link && link.href) {
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener,noreferrer');
    }
  };

  const compressImage = (dataUrl: string, maxWidth = 1600, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const insertImageAtCursor = (src: string) => {
    const img = document.createElement('img');
    img.src = src;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '4px';
    img.style.margin = '4px 0';

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (editorRef.current) {
      editorRef.current.appendChild(img);
    }

    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Check for images in clipboard
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            const compressed = await compressImage(base64);
            insertImageAtCursor(compressed);
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }

    // No image - paste as plain text to avoid messy HTML
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <>
      <div className={`${styles.editor} ${expanded ? styles.expanded : ''}`}>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${activeFormats.heading ? styles.active : ''}`}
            onClick={() => handleFormat('heading')}
            title="Heading (larger text)"
          >
            H
          </button>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${activeFormats.bold ? styles.active : ''}`}
            onClick={() => handleFormat('bold')}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${activeFormats.underline ? styles.active : ''}`}
            onClick={() => handleFormat('underline')}
            title="Underline"
          >
            <u>U</u>
          </button>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${activeFormats.list ? styles.active : ''}`}
            onClick={() => handleFormat('list')}
            title="Bullet List"
          >
            &bull;
          </button>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${activeFormats.checklist ? styles.active : ''}`}
            onClick={() => handleFormat('checklist')}
            title="Checklist"
          >
            ☑
          </button>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${activeFormats.code ? styles.active : ''}`}
            onClick={() => handleFormat('code')}
            title="Code"
          >
            {'</>'}
          </button>
        </div>
        <div
          ref={editorRef}
          className={`${styles.content} ${expanded ? styles.expandedContent : ''}`}
          contentEditable
          dir={isMostlyHebrew(value) ? 'rtl' : 'ltr'}
          onInput={handleInput}
          onPaste={handlePaste}
          onClick={handleClick}
          onKeyDown={handleContentKeyDown}
          onBlur={() => setTimeout(() => setMentionAnchor(null), 100)}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>

      {/* @mention autocomplete dropdown */}
      {mentionAnchor && filteredMentions.length > 0 && (
        <div
          className={styles.mentionDropdown}
          style={{ position: 'fixed', bottom: mentionAnchor.bottom, left: mentionAnchor.left }}
        >
          {filteredMentions.map((a, idx) => (
            <button
              key={a.id}
              type="button"
              className={`${styles.mentionOption}${idx === mentionIndex ? ` ${styles.mentionOptionActive}` : ''}`}
              onMouseDown={(e) => { e.preventDefault(); insertMention(a.name); }}
            >
              <span className={styles.mentionAvatar} style={{ background: avatarColor(a.name) }}>
                {a.name[0].toUpperCase()}
              </span>
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxImage(null)}>
          <button
            className={styles.lightboxClose}
            onClick={() => setLightboxImage(null)}
            title="Close"
          >
            ×
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className={styles.lightboxImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
