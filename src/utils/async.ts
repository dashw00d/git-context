import { logError } from './logger';

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
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
  console.error(`⏰ [withTimeout] Starting timeout for: ${description}`);
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      console.error(`⏰ [withTimeout] TIMEOUT REACHED: ${description}`);
      reject(new TimeoutError(`${description} timed out (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    console.error(`⏰ [withTimeout] Racing promise vs timeout`);
    const result = await Promise.race([promise, timeoutPromise]);
    console.error(`⏰ [withTimeout] Promise won the race`);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    console.error(`⏰ [withTimeout] Promise rejected:`, error);
    clearTimeout(timeoutHandle!);
    throw error;
  }
}
