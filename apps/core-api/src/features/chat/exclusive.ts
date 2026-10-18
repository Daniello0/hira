const tails = new Map<string, Promise<void>>();

/** Runs `task` after the previous task for `key`. A rejection does not block the next one. */
export function exclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}

/** Session keys that still have a queued turn. Idle keys are dropped. */
export function exclusiveQueueSize(): number {
  return tails.size;
}
