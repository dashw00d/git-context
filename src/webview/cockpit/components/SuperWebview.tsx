import * as React from 'react';
import { CockpitState, ContextFrame, ExplorerNode } from '../../../types/cockpit';
import { CockpitHostMessageSchema } from '../../../state/schemas';
import { getMessageTracer, postMessageWithTracing } from '../utils/messageUtils';
import { Assistant } from './Assistant';
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
    'explorer' | 'stage' | 'assistant'
  >('stage');
  const [isAssistantOpen, setIsAssistantOpen] = React.useState(true);

  // Derived state
  const activeFrame = cockpitState.activeFrame;
  const history = cockpitState.history;
  const explorerData = cockpitState.explorerData;
  // Selection is now handled via store actions if needed, or local to Stage if ephemeral.
  const [selection, setSelection] = React.useState<any>(null);

  React.useEffect(() => {
    // Request explorer tree and bundle data on mount
    postMessageWithTracing(vscode, { type: 'getExplorerTree' });
    postMessageWithTracing(vscode, { type: 'getBundleData' });

    const handler = (event: MessageEvent) => {
      const raw = event.data;

      // Handle specific SuperWebview messages only
      if (raw?.type === 'analysisError' && raw.payload) {
        console.warn('[SuperWebview] Analysis error', raw.payload);
        return;
      }

      if (raw?.type === 'assistantResponse' && raw.payload) {
        setAssistantMessages(prev => [
          ...prev,
          { role: 'assistant', content: raw.payload.text || '' },
        ]);
        return;
      }

      // All other messages (updateState, etc.) are handled by parent App component
      // No need to validate or warn about them here
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
    postMessageWithTracing(vscode, { type: 'navigateToFrame', frame });
    setSelection(null);
  };

  const handleSendAssistant = (text: string) => {
    setAssistantMessages(prev => [...prev, { role: 'user', content: text }]);
    postMessageWithTracing(vscode, { type: 'askAssistant', payload: { text, frame: activeFrame } });
  };

  const handleZoomOut = () => {
    postMessageWithTracing(vscode, { type: 'navigateBack' });
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
      postMessageWithTracing(vscode, {
        type: 'navigateToFrame',
        frame: newFrame,
      });
      return;
    }

    // Handle Bundle Selection
    if (node.id.startsWith('bundle-')) {
      const bundleId = node.id.replace('bundle-', '');

      // Switch active bundle
      postMessageWithTracing(vscode, { type: 'switchBundle', id: bundleId });

      // Navigate to root of this new bundle
      const newFrame: ContextFrame = {
        level: 'bundle',
        id: 'root', // The bundle itself is the root context
        name: node.name,
        status: 'ready',
        parentId: undefined, // It is the root
      };

      postMessageWithTracing(vscode, {
        type: 'navigateToFrame',
        frame: newFrame,
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
      case 'folder':
        level = 'folder';
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
      postMessageWithTracing(vscode, {
        type: 'navigateToFrame',
        frame: newFrame,
      });

      postMessageWithTracing(vscode, { type: 'analyzeFrame', frameId: node.id });
    } else {
      const newFrame: ContextFrame = {
        level,
        id: node.id,
        name: node.name,
        status: 'ready',
        parentId: level === 'bundle' ? undefined : 'root',
      };
      postMessageWithTracing(vscode, {
        type: 'navigateToFrame',
        frame: newFrame,
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

  const handleTimeFilterChange = (value: number) => {
    postMessageWithTracing(vscode, { type: 'updateTimeFilter', value });
  };

  return (
    <div style={LayoutStyle}>
      <div style={MainAreaStyle}>
        {/* Wide: Show Sidebar + Stage + Assistant */}
        {isWide && (
          <>
            <Sidebar
              data={explorerData}
              activeId={activeFrame.id}
              onSelect={handleSidebarSelect}
              repoName={cockpitState.repoName || undefined}
              branchName={cockpitState.branchName || undefined}
              allMetrics={cockpitState.nodeMetrics}
              currentTimeFilter={cockpitState.currentTimeFilter}
              onTimeFilterChange={handleTimeFilterChange}
            />
            <Stage
              frame={activeFrame}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onSelect={handleSelect}
              cockpitState={cockpitState}
              vscode={vscode}
            />
            {/* Inspector removed, Assistant is separate or integrated? 
                Plan says "Inspector is gone". 
                Let's keep Assistant visible in wide mode if open.
            */}
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

        {/* Medium: Show Sidebar + Stage */}
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
              {activeTab === 'assistant' ? (
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
                    allMetrics={cockpitState.nodeMetrics}
                    currentTimeFilter={cockpitState.currentTimeFilter}
                    onTimeFilterChange={handleTimeFilterChange}
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
                    activeTab !== 'assistant'
                      ? '2px solid var(--vscode-activityBar-foreground)'
                      : '2px solid transparent',
                  color:
                    activeTab !== 'assistant'
                      ? 'var(--vscode-activityBar-foreground)'
                      : 'var(--vscode-activityBar-inactiveForeground)',
                  fontSize: '0.85em',
                }}
              >
                Explorer + Stage
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
                  allMetrics={cockpitState.nodeMetrics}
                  currentTimeFilter={cockpitState.currentTimeFilter}
                  onTimeFilterChange={handleTimeFilterChange}
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
              {['explorer', 'stage', 'assistant'].map(tab => (
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
