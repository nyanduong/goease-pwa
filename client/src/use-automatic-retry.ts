import { useEffect, useRef } from 'react';

/** Retry failed reads, never successful reads or user-initiated writes. */
export function useAutomaticRetry(status: string, retry: () => void) {
  const callback = useRef(retry);
  const failures = useRef(0);
  useEffect(() => {
    callback.current = retry;
  }, [retry]);
  useEffect(() => {
    if (status === 'ready' || status === 'idle') failures.current = 0;
    if (status !== 'error') return;
    const delay = Math.min(30000, 2000 * 2 ** Math.min(failures.current++, 4));
    let running = false;
    const run = () => {
      if (running || !navigator.onLine || document.visibilityState === 'hidden')
        return;
      running = true;
      window.clearTimeout(timer);
      callback.current();
    };
    const timer = window.setTimeout(run, delay);
    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', run);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [status]);
}
