export interface PipelineState {
  // Inputs
  selectedCommitShas: string[];
  includeWorkspace: boolean;

  // Intermediates
  commitFacts?: any[];
  workspaceFacts?: any;
  bundleFacts?: any;
  history?: any;
  llmOutputs?: any;

  // Progress tracking
  currentStepId?: string | null;
  completedSteps: Set<string>;
  errors: Array<{ stepId: string; error: unknown }>;
}

export interface PipelineStep {
  id: string;
  label: string;
  run: (state: PipelineState) => Promise<void> | void;
}

export type PipelineEvent =
  | { type: 'start'; step: PipelineStep; state: PipelineState }
  | { type: 'complete'; step: PipelineStep; state: PipelineState }
  | { type: 'error'; step: PipelineStep; error: unknown; state: PipelineState }
  | { type: 'finished'; state: PipelineState };

export type PipelineEventHandler = (event: PipelineEvent) => void;
