import { logDebug, logError } from './logger';

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: 'DUPLICATE' | 'LOCKED' | 'NOT_FOUND' | 'SCHEMA_ERROR',
    public recoverable: boolean = true
  ) {
    super(message);
  }
}

export class PathFilterError extends Error {
  constructor(
    message: string,
    public reason: string,
    public filePath: string
  ) {
    super(message);
  }
}

export function handleServiceError(error: any, context: string): void {
  if (error instanceof DatabaseError && error.recoverable) {
    logDebug(`[${context}] Recoverable error: ${error.message}`);
    return; // Don't throw recoverable errors - use best-effort mode
  }
  logError(`[${context}] Unrecoverable error`, error);
  return; // Don't throw unrecoverable errors either - log and continue
}
