import { ContextFrame, ExplorerNode, NodeMetrics } from '../../../types/cockpit';

export interface SidebarProps {
  data: ExplorerNode[];
  activeId: string;
  onSelect: (node: ExplorerNode) => void;
  repoName?: string;
  branchName?: string;
  allMetrics?: Record<string, NodeMetrics>;
}

export interface StageProps {
  frame: ContextFrame;
  onZoomIn: (frame: ContextFrame) => void;
  onZoomOut: () => void;
  onSelect: (item: any) => void;
  cockpitState: any;
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
