import * as React from 'react';
import { CockpitState, ContextFrame, ExplorerNode } from '../../../types/cockpit';
import { getMessageTracer, postMessageWithTracing } from '../utils/messageUtils';
import { Assistant } from './Assistant';
import { Inspector } from './Inspector';
import { Sidebar } from './Sidebar';
import { Stage } from './Stage';

const LayoutStyle: React.CSSProperties = {
  display: 'flex',
  height: '94vh',
  width: '100%',
  overflow: 'hidden',
  flexDirection: 'column',
};

const MainAreaStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0, // Critical for flex overflow
  overflow: 'hidden',
};

export const SuperWebview: React.FC<{ vscode: any; cockpitState: CockpitState }> = ({
  vscode,
  cockpitState,
}) => {
  // Local state only for UI responsiveness (tabs, width) and ephemeral chat
  // Navigation state (activeFrame, history) now comes from cockpitState via Redux
  const [assistantMessages, setAssistantMessages] = React.useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [width, setWidth] = React.useState(window.innerWidth);
  const [activeTab, setActiveTab] = React.useState<
    'explorer' | 'stage' | 'inspector' | 'assistant'
  >('stage');
  const [isAssistantOpen, setIsAssistantOpen] = React.useState(true);

  // Derived state
  const activeFrame = cockpitState.activeFrame;
  const history = cockpitState.history;
  const explorerData = cockpitState.explorerData;
  // Selection is now handled via store actions if needed, or local to Stage if ephemeral.
  // For now, let's assume selection is ephemeral to the Stage component or we add it to store.
  // The original code had `selection` in state. Let's use a local state for selection for now as it's often transient.
  const [selection, setSelection] = React.useState<any>(null);

  React.useEffect(() => {
    // Request explorer tree and bundle data on mount
    postMessageWithTracing(vscode, 'getExplorerTree');
    postMessageWithTracing(vscode, 'getBundleData');

    const handler = (event: MessageEvent) => {
      const message = event.data;
      getMessageTracer().logIncoming(message.type, message.payload, 'extension');

      if (message?.type === 'analysisError' && message.payload) {
        console.warn('[SuperWebview] Analysis error', message.payload);
      } else if (message?.type === 'assistantResponse' && message.payload) {
        setAssistantMessages(prev => [
          ...prev,
          { role: 'assistant', content: message.payload.text },
        ]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [vscode]);

  React.useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleZoomIn = (frame: ContextFrame) => {
    postMessageWithTracing(vscode, 'dispatch', {
      action: { type: 'NAVIGATE_TO', payload: { frame } },
    });
    setSelection(null);
  };

  const handleSendAssistant = (text: string) => {
    setAssistantMessages(prev => [...prev, { role: 'user', content: text }]);
    postMessageWithTracing(vscode, 'askAssistant', { text, frame: activeFrame });
  };

  const handleZoomOut = () => {
    postMessageWithTracing(vscode, 'dispatch', {
      action: { type: 'NAVIGATE_BACK' },
    });
    setSelection(null);
  };

  const handleSelect = (item: any) => {
    setSelection(item);
  };

  const handleSidebarSelect = (node: ExplorerNode) => {
    // Handle Reports
    if (node.id === 'reports-root') {
      const newFrame: ContextFrame = {
        level: 'bundle',
        id: 'reports-root',
        name: 'Reports',
        status: 'ready',
        parentId: 'root',
      };
      vscode.postMessage({
        type: 'dispatch',
        action: { type: 'NAVIGATE_TO', payload: { frame: newFrame } },
      });
      return;
    }

    // Handle Bundle Selection
    if (node.id.startsWith('bundle-')) {
      const bundleId = node.id.replace('bundle-', '');

      // Switch active bundle
      postMessageWithTracing(vscode, 'switchBundle', { id: bundleId });

      // Navigate to root of this new bundle
      const newFrame: ContextFrame = {
        level: 'bundle',
        id: 'root', // The bundle itself is the root context
        name: node.name,
        status: 'ready',
        parentId: undefined, // It is the root
      };

      postMessageWithTracing(vscode, 'dispatch', {
        action: { type: 'NAVIGATE_TO', payload: { frame: newFrame } },
      });
      return;
    }

    // Determine level based on node type
    let level: ContextFrame['level'] = 'bundle';
    switch (node.type) {
      case 'file':
        level = 'file';
        break;
      case 'symbol':
        level = 'symbol';
        break;
      default:
        level = 'bundle';
    }

    // Trigger analysis for files and symbols
    if (level === 'file' || level === 'symbol') {
      // Optimistic update is handled by the reducer responding to NAVIGATE_TO with 'scanning'
      // We dispatch NAVIGATE_TO first, then trigger analysis
      const newFrame: ContextFrame = {
        level,
        id: node.id,
        name: node.name,
        status: 'scanning',
        parentId: 'root',
      };
      postMessageWithTracing(vscode, 'dispatch', {
        action: { type: 'NAVIGATE_TO', payload: { frame: newFrame } },
      });

      postMessageWithTracing(vscode, 'analyzeFrame', { frameId: node.id });
    } else {
      const newFrame: ContextFrame = {
        level,
        id: node.id,
        name: node.name,
        status: 'ready',
        parentId: level === 'bundle' ? undefined : 'root',
      };
      postMessageWithTracing(vscode, 'dispatch', {
        action: { type: 'NAVIGATE_TO', payload: { frame: newFrame } },
      });
    }
  };

  // Breakpoints
  const isNarrow = width < 800;
  const isMedium = width >= 800 && width < 1200;
  const isWide = width >= 1200;

  const handleSidebarSelectWrapper = (node: ExplorerNode) => {
    handleSidebarSelect(node);
    if (isNarrow) {
      setActiveTab('stage');
    }
  };

  return (
    <div style={LayoutStyle}>
      <div style={MainAreaStyle}>
        {/* Wide: Show all 3 columns */}
        {isWide && (
          <>
            <Sidebar
              data={explorerData}
              activeId={activeFrame.id}
              onSelect={handleSidebarSelect}
              repoName={cockpitState.repoName || undefined}
              branchName={cockpitState.branchName || undefined}
            />
            <Stage
              frame={activeFrame}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onSelect={handleSelect}
              cockpitState={cockpitState}
              vscode={vscode}
            />
            <Inspector frame={activeFrame} selection={selection} />
            {/* Debug / Cache Stats Footer */}
            {cockpitState.bundleSummary &&
              (cockpitState.bundleSummary as any).cacheHits !== undefined && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '5px',
                    right: '20px',
                    fontSize: '0.7em',
                    color: 'var(--vscode-descriptionForeground)',
                    opacity: 0.7,
                  }}
                >
                  Cache: {(cockpitState.bundleSummary as any).cacheHits} hits /{' '}
                  {(cockpitState.bundleSummary as any).cacheMisses} misses (
                  {Math.round((cockpitState.bundleSummary as any).cacheHitRate * 100)}%)
                </div>
              )}
          </>
        )}

        {/* Medium: Show Sidebar + Stage (hide Inspector) */}
        {isMedium && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
              {activeTab === 'inspector' ? (
                <Inspector frame={activeFrame} selection={selection} />
              ) : activeTab === 'assistant' ? (
                <Assistant
                  frame={activeFrame}
                  contextData={{}}
                  messages={assistantMessages}
                  onSend={handleSendAssistant}
                />
              ) : (
                <>
                  <Sidebar
                    data={explorerData}
                    activeId={activeFrame.id}
                    onSelect={handleSidebarSelect}
                    repoName={cockpitState.repoName || undefined}
                    branchName={cockpitState.branchName || undefined}
                  />
                  <Stage
                    frame={activeFrame}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onSelect={handleSelect}
                    cockpitState={cockpitState}
                    vscode={vscode}
                  />
                </>
              )}
            </div>

            {/* Bottom Navigation Bar for medium mode */}
            <div
              style={{
                display: 'flex',
                borderTop: '1px solid var(--vscode-panel-border)',
                backgroundColor: 'var(--vscode-editor-background)',
                flexShrink: 0,
                height: '40px',
              }}
            >
              <div
                onClick={() => setActiveTab('stage')}
                style={{
                  flex: 1,
                  padding: '8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderTop:
                    activeTab !== 'inspector'
                      ? '2px solid var(--vscode-activityBar-foreground)'
                      : '2px solid transparent',
                  color:
                    activeTab !== 'inspector'
                      ? 'var(--vscode-activityBar-foreground)'
                      : 'var(--vscode-activityBar-inactiveForeground)',
                  fontSize: '0.85em',
                }}
              >
                Explorer + Stage
              </div>
              <div
                onClick={() => setActiveTab('inspector')}
                style={{
                  flex: 1,
                  padding: '8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderTop:
                    activeTab === 'inspector'
                      ? '2px solid var(--vscode-activityBar-foreground)'
                      : '2px solid transparent',
                  color:
                    activeTab === 'inspector'
                      ? 'var(--vscode-activityBar-foreground)'
                      : 'var(--vscode-activityBar-inactiveForeground)',
                  fontSize: '0.85em',
                }}
              >
                Inspector
              </div>
              <div
                onClick={() => setActiveTab('assistant')}
                style={{
                  flex: 1,
                  padding: '8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderTop:
                    activeTab === 'assistant'
                      ? '2px solid var(--vscode-activityBar-foreground)'
                      : '2px solid transparent',
                  color:
                    activeTab === 'assistant'
                      ? 'var(--vscode-activityBar-foreground)'
                      : 'var(--vscode-activityBar-inactiveForeground)',
                  fontSize: '0.85em',
                }}
              >
                Assistant
              </div>
            </div>
          </div>
        )}

        {/* Mobile: Show only active tab */}
        {isNarrow && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
              {activeTab === 'explorer' && (
                <Sidebar
                  data={explorerData}
                  activeId={activeFrame.id}
                  onSelect={handleSidebarSelectWrapper}
                  repoName={cockpitState.repoName || undefined}
                  branchName={cockpitState.branchName || undefined}
                />
              )}
              {activeTab === 'stage' && (
                <Stage
                  frame={activeFrame}
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  onSelect={handleSelect}
                  cockpitState={cockpitState}
                  vscode={vscode}
                />
              )}
              {activeTab === 'inspector' && <Inspector frame={activeFrame} selection={selection} />}
              {activeTab === 'assistant' && (
                <Assistant
                  frame={activeFrame}
                  contextData={{}}
                  messages={assistantMessages}
                  onSend={handleSendAssistant}
                />
              )}
            </div>

            {/* Bottom Navigation Bar */}
            <div
              style={{
                display: 'flex',
                borderTop: '1px solid var(--vscode-panel-border)',
                backgroundColor: 'var(--vscode-editor-background)',
                flexShrink: 0,
                height: '40px',
              }}
            >
              {['explorer', 'stage', 'inspector', 'assistant'].map(tab => (
                <div
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    borderTop:
                      activeTab === tab
                        ? '2px solid var(--vscode-activityBar-foreground)'
                        : '2px solid transparent',
                    color:
                      activeTab === tab
                        ? 'var(--vscode-activityBar-foreground)'
                        : 'var(--vscode-activityBar-inactiveForeground)',
                    textTransform: 'capitalize',
                    fontSize: '0.8em',
                  }}
                >
                  {tab === 'explorer'
                    ? '📁'
                    : tab === 'stage'
                      ? '🎯'
                      : tab === 'inspector'
                        ? '🔍'
                        : '🤖'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Assistant - only show in wide mode, otherwise it's in tabs */}
      {isAssistantOpen && isWide && (
        <Assistant
          frame={activeFrame}
          contextData={{}}
          messages={assistantMessages}
          onSend={handleSendAssistant}
        />
      )}
    </div>
  );
};
