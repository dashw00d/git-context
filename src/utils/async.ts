import { logError, logInfo } from './logger';

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface AsyncStat {
  totalTime: number;
  count: number;
  failures: number;
  timeouts: number;
}

const stats: Record<string, AsyncStat> = {};
let statsInterval: NodeJS.Timeout | null = null;

function startStatsLogger() {
  if (statsInterval) return;
  statsInterval = setInterval(() => {
    const entries = Object.entries(stats);
    if (entries.length === 0) return;

    const summary = entries
      .map(([type, stat]) => {
        const avg = Math.round(stat.totalTime / stat.count);
        return `${type}: ${stat.count} runs, avg ${avg}ms, ${stat.failures} err, ${stat.timeouts} timeout`;
      })
      .join('\n');

    logInfo(`\n📊 [AsyncStats] Summary:\n${summary}\n`);
  }, 30000); // Log every 30s
}

/**
 * Wraps a promise with a timeout.
 * @param promise The promise to wrap
 * @param timeoutMs The timeout in milliseconds
 * @param errorMessage The error message to throw on timeout
 * @returns The result of the promise
 * @throws TimeoutError if the timeout is reached
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  description: string
): Promise<T> {
  startStatsLogger();

  if (!stats[description]) {
    stats[description] = { totalTime: 0, count: 0, failures: 0, timeouts: 0 };
  }

  const startTime = Date.now();
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      stats[description].timeouts++;
      reject(new TimeoutError(`${description} timed out (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);

    const duration = Date.now() - startTime;
    stats[description].totalTime += duration;
    stats[description].count++;

    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);

    const duration = Date.now() - startTime;
    stats[description].totalTime += duration;
    stats[description].count++;

    if (error instanceof TimeoutError) {
      // Already handled in timeout callback, but we need to rethrow
    } else {
      stats[description].failures++;
      logError(`[withTimeout] ${description} failed: ${(error as Error).message}`);
    }

    // eslint-disable-next-line no-restricted-syntax
    throw error;
  }
}
