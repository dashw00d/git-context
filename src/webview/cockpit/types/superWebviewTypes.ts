import { ContextFrame, ExplorerNode } from '../../../types/cockpit';

export interface SidebarProps {
  data: ExplorerNode[];
  activeId: string;
  onSelect: (node: ExplorerNode) => void;
  repoName?: string;
  branchName?: string;
}

export interface StageProps {
  frame: ContextFrame;
  onZoomIn: (frame: ContextFrame) => void;
  onZoomOut: () => void;
  onSelect: (item: any) => void;
  cockpitState: any; // Using any to avoid circular dependency or deep import if not needed, or import CockpitState
  vscode: any;
}

export interface InspectorProps {
  frame: ContextFrame;
  selection: any | null;
}

export interface AssistantProps {
  frame: ContextFrame;
  contextData: any;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  onSend: (text: string) => void;
}
