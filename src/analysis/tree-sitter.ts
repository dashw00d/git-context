import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { HybridFact, SymbolInfo } from '../types';
import { getSupportedLanguages } from '../utils/config';
import { logError, logInfo, logWarn } from '../utils/logger';

export class TreeSitterParser {
  private workers: Worker[] = [];
  private workerPoolSize = Math.max(1, os.cpus().length - 1);
  private taskQueue: Array<{
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

  async initializeParsers(): Promise<void> {
    if (this.initialized) return;

    const wasmDir = path.join(__dirname, '..', '..', 'out', 'wasm');
    const languages = getSupportedLanguages();

    logInfo(`Initializing ${this.workerPoolSize} workers...`);

    // Resolve worker path - handle both production (JS) and dev (TS/ts-node) environments
    let workerPath = path.join(__dirname, 'parserWorker.js');
    if (!fs.existsSync(workerPath)) {
      // If running in ts-node (src/), the compiled worker is in out/analysis/
      const outWorkerPath = path.join(__dirname, '..', '..', 'out', 'analysis', 'parserWorker.js');
      if (fs.existsSync(outWorkerPath)) {
        workerPath = outWorkerPath;
      } else {
        logWarn(
          `Warning: parserWorker.js not found. Looked at: ${workerPath} and ${outWorkerPath}`
        );
      }
    }

    const _initPromises = [];

    for (let i = 0; i < this.workerPoolSize; i++) {
      const worker = new Worker(workerPath);
      this.workers.push(worker);

      worker.on('message', msg => {
        if (msg.type === 'initialized') {
          // Worker ready
        } else if (msg.type === 'result') {
          const task = this.activeTasks.get(msg.id);
          if (task) {
            this.activeTasks.delete(msg.id);
            if (msg.error) {
              task.reject(new Error(msg.error));
            } else {
              task.resolve(msg.data);
            }
            this.processQueue(worker);
          }
        }
      });

      worker.on('error', err => {
        logError(`Worker error: ${err}`);
        // Fail all active tasks for this worker?
        // Ideally restart worker
      });

      // Send init message
      worker.postMessage({ type: 'init', wasmDir, languages });

      // Wait for init confirmation (simplified here)
    }

    // Give workers a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    this.initialized = true;
  }

  private processQueue(worker: Worker) {
    if (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      const id = this.nextTaskId++;
      this.activeTasks.set(id, { resolve: task.resolve, reject: task.reject });
      worker.postMessage({ ...task.message, id });
    }
  }

  private getAvailableWorker(): Worker | null {
    // Simple round-robin or load balancing could be added
    // For now, just pick random or check load?
    // Since we processQueue on message return, we need to track worker load
    // Simplified: Just use random worker for now to distribute
    return this.workers[Math.floor(Math.random() * this.workers.length)];
  }

  async parse(_content: string, _languageId: string): Promise<any | undefined> {
    // This method is problematic because it returns a Tree object which is not transferrable
    // from worker to main thread (it contains C++ pointers).
    // We must change the contract to return extracted data (symbols/facts) directly.
    logError(
      'Direct parse() not supported with worker threads. Use extractHybridFacts() or extractSymbols().'
    );
    return undefined; // Return undefined instead of throwing
  }

  /**
   * Extract hybrid facts (symbols + CST facts) using worker pool
   */
  async extractHybridFacts(
    content: string,
    filePath: string,
    languageId: string,
    existingSymbols?: SymbolInfo[]
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

      this.taskQueue.push({
        message,
        resolve: data => resolve(data.hybridFacts),
        reject,
      });
      this.dispatch();
    });
  }

  /**
   * Serialize file AST for LLM context using worker pool
   */
  async serializeFile(content: string, languageId: string, maxDepth: number = 5): Promise<any> {
    if (!this.initialized) await this.initializeParsers();

    return new Promise((resolve, reject) => {
      const message = {
        type: 'serialize',
        content,
        languageId,
        maxDepth,
      };

      this.taskQueue.push({ message, resolve, reject });
      this.dispatch();
    });
  }

  private dispatch() {
    // Find a worker with low load?
    // Or just simple: iterate workers, if one is "free" (we'd need to track load), assign.
    // For now, since we want parallelism, just round-robin assign even if busy?
    // Node workers have their own message queue.

    const worker = this.workers[Math.floor(Math.random() * this.workers.length)];
    if (worker && this.taskQueue.length > 0) {
      // This is naive; it doesn't guarantee load balancing but distributes work
      this.processQueue(worker);
    }
  }

  dispose(): void {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
  }
}

// Singleton instance
let parserInstance: TreeSitterParser | null = null;

export function getTreeSitterParser(): TreeSitterParser {
  if (!parserInstance) {
    parserInstance = new TreeSitterParser();
  }
  return parserInstance;
}
