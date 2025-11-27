/**
 * Run multiple async tasks with concurrency limit
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  const queue = items.map((item, index) => ({ item, index }));
  const workers: Promise<void>[] = [];

  async function runWorker() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      await worker(next.item, next.index);
    }
  }

  const workerCount = Math.min(limit, queue.length);

  for (let i = 0; i < workerCount; i++) {
    workers.push(runWorker());
  }

  await Promise.all(workers);
}
