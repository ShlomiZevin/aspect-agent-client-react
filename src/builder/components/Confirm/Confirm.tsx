/**
 * Confirm — custom replacement for window.confirm().
 *
 * Imperative API via a React context:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Remove addon?',
 *     message: 'This deletes the addon from this crew.',
 *     confirmLabel: 'Remove',
 *     danger: true,
 *   });
 *   if (ok) doTheThing();
 *
 * One <ConfirmProvider> wraps the builder; the modal is rendered
 * once and reused. Promise resolves true on confirm, false on cancel
 * (overlay click, Esc, or Cancel button).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal } from '../Modal/Modal';
import styles from './Confirm.module.css';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmCtx);
  if (!fn) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return fn;
}

interface ProviderProps {
  children: ReactNode;
}

export function ConfirmProvider({ children }: ProviderProps) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(opts => {
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve;
      setState(opts);
    });
  }, []);

  const finish = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState(null);
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmCtx.Provider value={value}>
      {children}
      <Modal
        open={state !== null}
        onClose={() => finish(false)}
        width={420}
        title={state?.title ?? ''}
        footer={
          <>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => finish(false)}
            >
              {state?.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={`${styles.confirm} ${state?.danger ? styles.confirmDanger : ''}`}
              onClick={() => finish(true)}
              autoFocus
            >
              {state?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        {state?.message && <div className={styles.message}>{state.message}</div>}
      </Modal>
    </ConfirmCtx.Provider>
  );
}
