import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

type ConfirmationOptions = {
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'warning' | 'danger';
  signal?: AbortSignal;
};
type Request = ConfirmationOptions & {
  id: number;
  message: string;
  finish: (answer: boolean) => void;
};
const listeners = new Set<() => void>();
let requests: Request[] = [];
let sequence = 0;
const publish = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => requests[0] ?? null;

/** Resolve only after the user chooses. No mutation runs while the modal is open. */
export function confirmAction(
  message: string,
  options: ConfirmationOptions,
): Promise<boolean> {
  if (options.signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const abort = () => request.finish(false);
    const request: Request = {
      ...options,
      id: ++sequence,
      message,
      finish: (answer) => {
        if (!requests.includes(request)) return;
        options.signal?.removeEventListener('abort', abort);
        requests = requests.filter((item) => item !== request);
        publish();
        resolve(answer);
      },
    };
    requests.push(request);
    options.signal?.addEventListener('abort', abort, { once: true });
    publish();
  });
}

export function ConfirmationHost() {
  const request = useSyncExternalStore(subscribe, snapshot, () => null);
  useEffect(() => {
    const cancel = () => [...requests].forEach((item) => item.finish(false));
    window.addEventListener('popstate', cancel);
    window.addEventListener('hashchange', cancel);
    window.addEventListener('goease-auth-invalid', cancel);
    return () => {
      window.removeEventListener('popstate', cancel);
      window.removeEventListener('hashchange', cancel);
      window.removeEventListener('goease-auth-invalid', cancel);
      cancel();
    };
  }, []);
  return request
    ? createPortal(
        <ConfirmationModal key={request.id} request={request} />,
        document.body,
      )
    : null;
}

function ConfirmationModal({ request }: { request: Request }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    cancel.current?.focus();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  function finish(answer: boolean) {
    ref.current?.close();
    request.finish(answer);
  }
  return (
    <dialog
      ref={ref}
      className={`app-confirmation ${request.tone === 'danger' ? 'is-danger' : ''}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          ref.current?.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)',
          ) ?? [],
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      }}
    >
      <button
        type="button"
        className="app-confirmation-close"
        aria-label="Đóng xác nhận"
        onClick={() => finish(false)}
      >
        <X size={19} />
      </button>
      <div className="app-confirmation-icon" aria-hidden="true">
        {request.tone === 'danger' ? (
          <Trash2 size={25} />
        ) : (
          <AlertTriangle size={25} />
        )}
      </div>
      <h2 id={`${id}-title`}>{request.title}</h2>
      <p id={`${id}-message`}>{request.message}</p>
      <div className="app-confirmation-actions">
        <button
          type="button"
          ref={cancel}
          className="app-confirmation-cancel"
          onClick={() => finish(false)}
        >
          {request.cancelLabel ?? 'Hủy'}
        </button>
        <button
          type="button"
          className="app-confirmation-accept"
          onClick={() => finish(true)}
        >
          {request.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
