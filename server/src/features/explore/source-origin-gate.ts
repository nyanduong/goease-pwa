import { setTimeout as delay } from 'node:timers/promises';

/** Serialize requests per origin while unrelated websites can proceed independently. */
export function sourceOriginGate(intervalMs = 1000) {
  const origins = new Map<
    string,
    { tail: Promise<void>; lastStart: number; pending: number }
  >();
  return async (origin: string) => {
    let entry = origins.get(origin);
    if (!entry) {
      entry = { tail: Promise.resolve(), lastStart: 0, pending: 0 };
      origins.set(origin, entry);
    }
    const current = entry,
      previous = current.tail;
    let unlock!: () => void;
    current.tail = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    current.pending++;
    await previous;
    const wait = current.lastStart + intervalMs - Date.now();
    if (wait > 0) await delay(wait);
    current.lastStart = Date.now();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      current.pending--;
      unlock();
      const cleanup = setTimeout(() => {
        if (
          current.pending === 0 &&
          origins.get(origin) === current &&
          Date.now() >= current.lastStart + intervalMs
        )
          origins.delete(origin);
      }, intervalMs);
      cleanup.unref();
    };
  };
}
export const acquireSourceOrigin = sourceOriginGate();
