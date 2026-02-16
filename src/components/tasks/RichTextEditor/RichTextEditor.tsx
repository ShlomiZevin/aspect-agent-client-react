import { useRef, useCallback, useEffect, useState } from 'react';
import styles from './RichTextEditor.module.css';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  expanded?: boolean;
}

type FormatCommand = 'bold' | 'underline' | 'insertUnorderedList';

interface ActiveFormats {
  bold: boolean;
  underline: boolean;
  list: boolean;
  code: boolean;
  heading: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, expanded }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    underline: false,
    list: false,
    code: false,
    heading: false,
  });

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
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    // Paste as plain text to avoid messy HTML
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
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
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
}
