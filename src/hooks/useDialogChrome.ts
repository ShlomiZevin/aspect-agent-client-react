import { useEffect, useRef } from 'react';

/**
 * The keyboard behaviour every `aria-modal` dialog promises and none of ours
 * delivered.
 *
 * Declaring `role="dialog" aria-modal="true"` tells a screen reader that the
 * rest of the page is inert. Nothing enforced that: Tab walked straight out of
 * the dialog into the page behind it, and Escape did nothing, so a keyboard
 * user who opened one had no way back out except finding the Cancel button
 * again. The markup was making a claim the behaviour did not honour.
 *
 * Attach the returned ref to the dialog element -- the panel, not the overlay:
 *
 *   const dialogRef = useDialogChrome<HTMLDivElement>(onClose);
 *   <div className={styles.overlay}>
 *     <div ref={dialogRef} role="dialog" aria-modal="true"> ... </div>
 *   </div>
 *
 * `onClose` is held in a ref, so passing an inline arrow -- which every caller
 * does -- does not tear the listeners down and rebuild them on every render.
 */
export function useDialogChrome<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);

  // Declared BEFORE the listener effect so it has run by the time anything can
  // fire, and in an effect rather than during render because a ref written
  // mid-render is a ref two concurrent renders can disagree about.
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Where focus came from, so it can go back there. Returning focus to the
    // body would drop a keyboard user at the top of the page, having lost the
    // control they were on.
    const opener = document.activeElement as HTMLElement | null;

    const focusable = () => Array.from(
      node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
        + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(el => el.offsetParent !== null || el === document.activeElement);

    // The first control, or the panel itself when there is nothing to focus --
    // a dialog nothing inside can hold is still better than focus left behind
    // it on the page.
    const first = focusable()[0];
    if (first) first.focus();
    else { node.tabIndex = -1; node.focus(); }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      // Recomputed per keystroke rather than captured once: these dialogs
      // enable and disable controls while they are open (a run in flight, a
      // save in progress), and a list captured at mount would send focus to a
      // button that is now disabled.
      const items = focusable();
      if (items.length === 0) { e.preventDefault(); return; }

      const active = document.activeElement as HTMLElement | null;
      const at = active ? items.indexOf(active) : -1;
      const goingBack = e.shiftKey;

      // Wrap only at the ends, so Tab still moves normally in between and the
      // dialog does not feel like it is fighting the browser.
      if (!goingBack && (at === items.length - 1 || at === -1)) {
        e.preventDefault();
        items[0].focus();
      } else if (goingBack && (at === 0 || at === -1)) {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = priorOverflow;
      // Guarded: by now the opener may have been unmounted along with the row
      // the dialog was opened from.
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return ref;
}
