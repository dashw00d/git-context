import * as React from 'react';
import { CockpitState, ContextFrame, ExplorerNode } from '../../../types/cockpit';
import { postMessageWithTracing } from '../utils/messageUtils';
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
  minHeight: 0,
  overflow: 'hidden',
};

export const SuperWebview: React.FC<{ vscode: any; cockpitState: CockpitState }> = ({
  vscode,
  cockpitState,
}) => {
  const [assistantMessages, setAssistantMessages] = React.useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [width, setWidth] = React.useState(window.innerWidth);
  const [activeTab, setActiveTab] = React.useState<'explorer' | 'stage' | 'assistant'>('stage');
  const [isAssistantOpen, setIsAssistantOpen] = React.useState(true);

  const activeFrame = cockpitState.activeFrame;
  const history = cockpitState.history;
  const explorerData = cockpitState.explorerData;

  const [selection, setSelection] = React.useState<any>(null);

  React.useEffect(() => {
    postMessageWithTracing(vscode, { type: 'getExplorerTree' });
    postMessageWithTracing(vscode, { type: 'getBundleData' });

    const handler = (event: MessageEvent) => {
      const raw = event.data;

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

    if (node.id.startsWith('bundle-')) {
      const bundleId = node.id.replace('bundle-', '');

      postMessageWithTracing(vscode, { type: 'switchBundle', id: bundleId });

      const newFrame: ContextFrame = {
        level: 'bundle',
        id: 'root',
        name: node.name,
        status: 'ready',
        parentId: undefined,
      };

      postMessageWithTracing(vscode, {
        type: 'navigateToFrame',
        frame: newFrame,
      });
      return;
    }

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

    if (level === 'file' || level === 'symbol') {
      // Fix: Only set to scanning if not already ready
      const status = node.status === 'ready' ? 'ready' : 'scanning';
      const newFrame: ContextFrame = {
        level,
        id: node.id,
        name: node.name,
        status,
        parentId: 'root',
      };
      postMessageWithTracing(vscode, {
        type: 'navigateToFrame',
        frame: newFrame,
      });

      // Analysis is now triggered automatically by CockpitProvider when navigating to a frame with 'scanning' status
      // postMessageWithTracing(vscode, { type: 'analyzeFrame', frameId: node.id });
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

  const isNarrow = width < 800;
  const isMedium = width >= 800 && width < 1200;
  const isWide = width >= 1200;

  const handleSidebarSelectWrapper = (node: ExplorerNode) => {
    handleSidebarSelect(node);
    if (isNarrow) {
      setActiveTab('stage');
    }
  };

  // Error banner component
  const ErrorBanner: React.FC<{ error: string; onDismiss: () => void }> = ({
    error,
    onDismiss,
  }) => (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
        color: 'var(--vscode-inputValidation-errorForeground)',
        borderBottom: '1px solid var(--vscode-inputValidation-errorBorder)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        zIndex: 1000,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <span>❌</span>
        <span>{error}</span>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--vscode-inputValidation-errorForeground)',
          cursor: 'pointer',
          padding: '4px 8px',
          fontSize: '16px',
          lineHeight: 1,
        }}
        title="Dismiss error"
      >
        ×
      </button>
    </div>
  );

  const handleDismissError = () => {
    postMessageWithTracing(vscode, { type: 'clearError' });
  };

  return (
    <div style={LayoutStyle}>
      {cockpitState.error && (
        <ErrorBanner error={cockpitState.error} onDismiss={handleDismissError} />
      )}
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
                  {tab === 'explorer' ? '📁' : tab === 'stage' ? '🎯' : '🤖'}
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
