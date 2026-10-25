/** A small I/O pool; atomic Mongo leases remain the authority for claiming a place. */
export function sourceWorkerPool(
  tick: () => Promise<void>,
  concurrency: number,
) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
    throw new Error('Source concurrency must be between 1 and 8');
  let timer: ReturnType<typeof setInterval> | undefined;
  const running = new Set<Promise<void>>();
  function start() {
    if (timer) return;
    const poll = () => {
      while (running.size < concurrency) {
        const task = tick()
          .catch(() => {})
          .finally(() => {
            running.delete(task);
          });
        running.add(task);
      }
    };
    timer = setInterval(poll, 1000);
    timer.unref();
    poll();
  }
  async function stop() {
    clearInterval(timer);
    timer = undefined;
    await Promise.allSettled([...running]);
  }
  return { start, stop };
}
