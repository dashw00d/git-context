import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { HybridFact, SymbolInfo } from '../types';
import { getSupportedLanguages } from '../utils/config';
import { logError, logInfo, logWarn } from '../utils/logger';

// TODO: Future improvements for priority handling:
// - AbortController to cancel in-flight background work when on-demand arrives
// - Chunked processing with yield points in pipeline steps (not just parser)
// - Request-level priority queue for entire pipeline, not just tree-sitter
// - Eager partial results: return available data immediately, fill gaps async
export class TreeSitterParser {
  // Separate pools: reserved workers for on-demand, rest for background
  private onDemandWorkers: Worker[] = [];
  private backgroundWorkers: Worker[] = [];
  private totalWorkers = Math.max(2, os.cpus().length - 1);
  private reservedForOnDemand = Math.max(1, Math.min(2, Math.floor(this.totalWorkers / 3)));

  private highPriorityQueue: Array<{
    message: any;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  private lowPriorityQueue: Array<{
    message: any;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  private activeTasks = new Map<
    number,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  >();
  private nextTaskId = 1;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  async initializeParsers(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    const wasmDir = path.join(__dirname, '..', '..', 'out', 'wasm');
    const languages = getSupportedLanguages();

    const backgroundWorkerCount = this.totalWorkers - this.reservedForOnDemand;
    logInfo(
      `Initializing ${this.totalWorkers} workers (${this.reservedForOnDemand} reserved for on-demand, ${backgroundWorkerCount} for background)...`
    );

    let workerPath = path.join(__dirname, 'parserWorker.js');
    if (!fs.existsSync(workerPath)) {
      const outWorkerPath = path.join(__dirname, '..', '..', 'out', 'analysis', 'parserWorker.js');
      if (fs.existsSync(outWorkerPath)) {
        workerPath = outWorkerPath;
      } else {
        logWarn(
          `Warning: parserWorker.js not found. Looked at: ${workerPath} and ${outWorkerPath}`
        );
      }
    }

    this.initializationPromise = new Promise<void>(resolve => {
      let initializedCount = 0;

      const createWorker = (isOnDemand: boolean): Worker => {
        const worker = new Worker(workerPath);

        worker.on('message', msg => {
          if (msg.type === 'initialized') {
            initializedCount++;
            if (initializedCount === this.totalWorkers) {
              this.initialized = true;
              logInfo(`All ${this.totalWorkers} workers initialized.`);
              resolve();
              // Kickstart queue processing for any tasks that were queued during init
              this.dispatchAll();
            }
          } else if (msg.type === 'result') {
            const task = this.activeTasks.get(msg.id);
            if (task) {
              this.activeTasks.delete(msg.id);
              if (msg.error) {
                task.reject(new Error(msg.error));
              } else {
                task.resolve(msg.data);
              }
              this.processQueue(worker, isOnDemand);
            }
          }
        });

        worker.on('error', err => {
          logError(`Worker error: ${err}`);
        });

        worker.postMessage({ type: 'init', wasmDir, languages });
        return worker;
      };

      // Create reserved on-demand workers
      for (let i = 0; i < this.reservedForOnDemand; i++) {
        this.onDemandWorkers.push(createWorker(true));
      }

      // Create background workers
      for (let i = 0; i < backgroundWorkerCount; i++) {
        this.backgroundWorkers.push(createWorker(false));
      }
    });

    return this.initializationPromise;
  }

  private processQueue(worker: Worker, isOnDemandWorker: boolean) {
    // On-demand workers only process high priority queue
    // Background workers only process low priority queue
    if (isOnDemandWorker && this.highPriorityQueue.length > 0) {
      const task = this.highPriorityQueue.shift()!;
      const id = this.nextTaskId++;
      this.activeTasks.set(id, { resolve: task.resolve, reject: task.reject });
      worker.postMessage({ ...task.message, id });
    } else if (!isOnDemandWorker && this.lowPriorityQueue.length > 0) {
      const task = this.lowPriorityQueue.shift()!;
      const id = this.nextTaskId++;
      this.activeTasks.set(id, { resolve: task.resolve, reject: task.reject });
      worker.postMessage({ ...task.message, id });
    }
  }

  async parse(_content: string, _languageId: string): Promise<any | undefined> {
    logError(
      'Direct parse() not supported with worker threads. Use extractHybridFacts() or extractSymbols().'
    );
    return undefined;
  }

  async extractHybridFacts(
    content: string,
    filePath: string,
    languageId: string,
    existingSymbols?: SymbolInfo[],
    priority: boolean = false
  ): Promise<HybridFact[]> {
    if (!this.initialized) await this.initializeParsers();

    return new Promise((resolve, reject) => {
      const message = {
        type: 'parse',
        content,
        languageId,
        filePath,
        extractHybrid: true,
        existingSymbols,
      };

      const task = {
        message,
        resolve: (data: any) => resolve(data.hybridFacts),
        reject,
      };

      if (priority) {
        this.highPriorityQueue.push(task);
      } else {
        this.lowPriorityQueue.push(task);
      }
      this.dispatch();
    });
  }

  async serializeFile(content: string, languageId: string, maxDepth: number = 5): Promise<any> {
    if (!this.initialized) await this.initializeParsers();

    return new Promise((resolve, reject) => {
      const message = {
        type: 'serialize',
        content,
        languageId,
        maxDepth,
      };

      this.lowPriorityQueue.push({ message, resolve, reject });
      this.dispatch();
    });
  }

  private dispatch() {
    // Process high priority tasks first (they jump the queue)
    // Try to use all available on-demand workers for parallel processing
    if (this.highPriorityQueue.length > 0 && this.onDemandWorkers.length > 0) {
      // Process one high priority task per dispatch
      // When workers finish, they'll automatically process the next task via processQueue callback
      const worker = this.onDemandWorkers[Math.floor(Math.random() * this.onDemandWorkers.length)];
      this.processQueue(worker, true);
    }
    // Dispatch low priority to background workers (only one per dispatch)
    if (this.lowPriorityQueue.length > 0 && this.backgroundWorkers.length > 0) {
      const worker =
        this.backgroundWorkers[Math.floor(Math.random() * this.backgroundWorkers.length)];
      this.processQueue(worker, false);
    }
  }

  /**
   * Dispatch tasks to ALL available workers - called after init to kickstart processing
   */
  private dispatchAll() {
    // Dispatch to all on-demand workers if high priority tasks exist
    for (const worker of this.onDemandWorkers) {
      if (this.highPriorityQueue.length > 0) {
        this.processQueue(worker, true);
      }
    }
    // Dispatch to all background workers if low priority tasks exist
    for (const worker of this.backgroundWorkers) {
      if (this.lowPriorityQueue.length > 0) {
        this.processQueue(worker, false);
      }
    }
  }

  dispose(): void {
    this.onDemandWorkers.forEach(w => w.terminate());
    this.backgroundWorkers.forEach(w => w.terminate());
    this.onDemandWorkers = [];
    this.backgroundWorkers = [];
  }
}

let parserInstance: TreeSitterParser | null = null;

export function getTreeSitterParser(): TreeSitterParser {
  if (!parserInstance) {
    parserInstance = new TreeSitterParser();
  }
  return parserInstance;
}
