const tails = new Map<string, Promise<void>>();

/**
 * Runs work for one user after that user's previous tail finishes.
 * A failure does not block the next tail. Other users are not queued behind this one.
 */
export function enqueueUser<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(userId) ?? Promise.resolve();
  const run = previous.then(task, task);
  tails.set(userId, run.then(clear, clear));
  return run;
}

function clear(): void {
  return undefined;
}
