import { ActionPayloadSchemas } from '../state/schemas';
import { logError } from '../utils/logger';

export interface StateLogEntry {
  timestamp: string;
  actionType: string;
  payload?: string; // Trimmed string
  diff?: any;
  sizeDelta?: number;
  repeatCount?: number;
  validationErrors?: string[];
}

export class StateLogger {
  private static instance: StateLogger;
  private enabled = true;

  private constructor() {
    // Singleton: use getInstance()
  }

  static getInstance(): StateLogger {
    if (!StateLogger.instance) {
      StateLogger.instance = new StateLogger();
    }
    return StateLogger.instance;
  }

  public log(data: { actionType: string; payload: any; stateBefore: any; stateAfter: any }) {
    if (!this.enabled) return;

    // Validate payload if schema exists
    const schema = ActionPayloadSchemas[data.actionType];
    if (schema) {
      const result = schema.safeParse(data.payload);
      if (!result.success) {
        // Log validation error using our nice logger
        // We pass the ZodError directly so logError can format it
        logError(`[StateLogger] Action ${data.actionType} failed validation`, result.error);
      }
    }
  }

  public getLogPath(): string | null {
    return null;
  }
}

export function getStateLogger(): StateLogger {
  return StateLogger.getInstance();
}
