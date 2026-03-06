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
}

function avatarColor(name: string): string {
  const colors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
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

  // Check which formats are active at current selection
  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      underline: document.queryCommandState('underline'),
      list: document.queryCommandState('insertUnorderedList'),
      code: isInElement('CODE'),
      heading: isInHeading(),
    });
  }, [isInElement, isInHeading]);

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
        const match = text.match(/@([\w\u0080-\uFFFF]*)$/);
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
