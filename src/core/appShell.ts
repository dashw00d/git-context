import * as vscode from 'vscode';
import { RefactorPipeline } from '../analysis/refactorPipeline';
import { PipelineFactory } from '../services/pipelineFactory';
import {
  CockpitOrchestrator,
  CockpitStateChange,
  getCockpitOrchestrator,
} from '../state/cockpitOrchestrator';
import type { CockpitState } from '../types/cockpit';
import { logError } from '../utils/logger';

export type CommandHandler = (context: vscode.ExtensionContext, ...args: any[]) => any;
export type WatcherFactory = (
  orchestrator: CockpitOrchestrator,
  pipeline: RefactorPipeline
) => vscode.Disposable;

export interface FeatureRegistration {
  commands?: Array<{
    command: string;
    handler: CommandHandler;
  }>;
  watchers?: Array<WatcherFactory>;
  effects?: Array<{
    key?: keyof CockpitState | Array<keyof CockpitState>;
    handler: (change: CockpitStateChange) => void | Promise<void>;
    priority?: number;
  }>;
  onActivate?: (shell: AppShell) => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
}

export class AppShell {
  private orchestrator: CockpitOrchestrator;
  private pipelineFactory: PipelineFactory;
  private registeredCommands: vscode.Disposable[] = [];
  private registeredWatchers: vscode.Disposable[] = [];
  private registeredEffects: Array<() => void> = [];
  private features: FeatureRegistration[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    orchestrator?: CockpitOrchestrator,
    pipelineFactory?: PipelineFactory
  ) {
    this.orchestrator = orchestrator || getCockpitOrchestrator();
    this.pipelineFactory = pipelineFactory || PipelineFactory.getInstance();
  }

  getOrchestrator(): CockpitOrchestrator {
    return this.orchestrator;
  }

  async getPipeline(): Promise<RefactorPipeline> {
    return this.pipelineFactory.getPipeline();
  }

  registerFeature(feature: FeatureRegistration): void {
    this.features.push(feature);

    if (feature.commands) {
      for (const cmd of feature.commands) {
        const disposable = vscode.commands.registerCommand(cmd.command, (...args) =>
          cmd.handler(this.context, ...args)
        );
        this.registeredCommands.push(disposable);
        this.context.subscriptions.push(disposable);
      }
    }

    if (feature.watchers) {
      this.pipelineFactory.getPipeline().then(pipeline => {
        for (const watcherFactory of feature.watchers!) {
          const watcher = watcherFactory(this.orchestrator, pipeline);
          this.registeredWatchers.push(watcher);
          this.context.subscriptions.push(watcher);
        }
      });
    }

    if (feature.effects) {
      for (const effect of feature.effects) {
        const unsubscribe = this.orchestrator.registerEffect({
          key: effect.key,
          handler: effect.handler,
          priority: effect.priority,
        });
        this.registeredEffects.push(unsubscribe);
      }
    }

    if (feature.onActivate) {
      Promise.resolve(feature.onActivate(this)).catch(err => {
        logError(`[AppShell] Feature onActivate error: ${err}`);
      });
    }
  }

  registerCommand(command: string, handler: CommandHandler): void {
    this.registerFeature({ commands: [{ command, handler }] });
  }

  async registerWatcher(factory: WatcherFactory): Promise<void> {
    const pipeline = await this.getPipeline();
    const watcher = factory(this.orchestrator, pipeline);
    this.registeredWatchers.push(watcher);
    this.context.subscriptions.push(watcher);
  }

  async deactivate(): Promise<void> {
    for (const unsubscribe of this.registeredEffects) {
      unsubscribe();
    }

    for (const feature of this.features) {
      if (feature.onDeactivate) {
        try {
          await Promise.resolve(feature.onDeactivate());
        } catch (err) {
          logError(`[AppShell] Feature onDeactivate error: ${err}`);
        }
      }
    }
  }
}
