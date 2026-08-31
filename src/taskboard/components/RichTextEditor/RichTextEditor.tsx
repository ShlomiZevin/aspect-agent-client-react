import { useCallback, useEffect, useRef } from 'react';
import type { ClipboardEvent } from 'react';
import styles from './RichTextEditor.module.css';

/**
 * The description editor: heading, bold, underline, bullets, checklist, code,
 * and pasted screenshots — the same toolbar the original board has.
 *
 * That one is 824 lines. This is a fraction of it because it does not try to
 * own the selection: `document.execCommand` already implements every one of
 * these against the browser's own selection model, and re-implementing that by
 * hand is where the length went. It is formally deprecated and has no
 * replacement for contentEditable formatting; every rich text editor in the
 * wild still uses it.
 *
 * The value is HTML, as it is there, so existing descriptions keep working. The
 * difference is on the way out: `sanitize()` is applied before anything is
 * rendered, instead of handing raw stored markup to dangerouslySetInnerHTML.
 */
interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const MAX_IMAGE_BYTES = 1_500_000;

export function RichTextEditor({ value, onChange, placeholder, minHeight }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Written to the DOM only when the incoming value differs from what is
  // already there. Assigning innerHTML on every render would move the caret to
  // the start on every keystroke, which is the classic contentEditable bug.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // A contentEditable emptied by the user leaves <br> behind, which is not
    // empty to any `!value` check downstream.
    const html = el.innerHTML === '<br>' ? '' : el.innerHTML;
    onChange(html);
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  /** A checklist item, which execCommand has no command for. */
  const insertChecklist = () => {
    ref.current?.focus();
    document.execCommand(
      'insertHTML',
      false,
      '<div class="checklist-item"><input type="checkbox"> <span></span></div>',
    );
    emit();
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const file = [...e.clipboardData.items].find(i => i.type.startsWith('image/'))?.getAsFile();

    if (file) {
      e.preventDefault();
      if (file.size > MAX_IMAGE_BYTES) return;
      const reader = new FileReader();
      reader.onload = () => {
        document.execCommand('insertHTML', false, `<img src="${reader.result}" alt="pasted">`);
        emit();
      };
      reader.readAsDataURL(file);
      return;
    }

    // Plain text for everything else: pasting from a browser or Word otherwise
    // drags in fonts, colours and class names that then live in the database.
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    emit();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <ToolButton label="H"  title="Heading"   onClick={() => exec('formatBlock', '<h3>')} />
        <ToolButton label="B"  title="Bold"      onClick={() => exec('bold')} bold />
        <ToolButton label="U"  title="Underline" onClick={() => exec('underline')} underline />
        <ToolButton label="•"  title="Bullets"   onClick={() => exec('insertUnorderedList')} />
        <ToolButton label="☑"  title="Checklist" onClick={insertChecklist} />
        <ToolButton label="</>" title="Code"     onClick={() => exec('formatBlock', '<pre>')} mono />
      </div>

      <div
        ref={ref}
        className={styles.editor}
        style={minHeight ? { minHeight } : undefined}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
      />
    </div>
  );
}

function ToolButton({ label, title, onClick, bold, underline, mono }: {
  label: string;
  title: string;
  onClick: () => void;
  bold?: boolean;
  underline?: boolean;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      className={[styles.tool, bold && styles.bold, underline && styles.underline, mono && styles.mono]
        .filter(Boolean).join(' ')}
      title={title}
      // mousedown, not click: click fires after the editor has already lost the
      // selection, so the command would apply to nothing.
      onMouseDown={e => { e.preventDefault(); onClick(); }}
    >
      {label}
    </button>
  );
}
