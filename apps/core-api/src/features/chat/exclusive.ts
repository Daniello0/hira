const tails = new Map<string, Promise<void>>();

/** Runs `task` after the previous task for `key`. A rejection does not block the next one. */
export function exclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  tails.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}
