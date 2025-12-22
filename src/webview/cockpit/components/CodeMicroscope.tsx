import * as React from 'react';
import { CockpitState, ContextFrame } from '../../../types/cockpit';
import { useFileAnalysisData } from '../hooks/useFileAnalysisData';
import { BlastRadiusStage } from './stages/BlastRadiusStage';
import { BundleStage } from './stages/BundleStage';
import { CodeEditor } from './stages/CodeEditor';
import { DriftBrowserPanel } from './stages/DriftBrowserPanel';
import { FolderStage } from './stages/FolderStage';
import { PortalsRail } from './stages/PortalsRail';
import { ReportsStage } from './stages/ReportsStage';
import { SignatureView } from './stages/SignatureView';
import { StageHeader } from './stages/StageHeader';
import { SymbolBlock } from './stages/SymbolBlock';
import { SymbolStage } from './stages/SymbolStage';
import { TimeScrubber } from './stages/TimeScrubber';

interface CodeMicroscopeProps {
  frame: ContextFrame;
  onZoomIn: (frame: ContextFrame) => void;
  onZoomOut: () => void;
  cockpitState?: CockpitState;
  vscode?: any;
}

const MicroscopeContainer: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--vscode-editor-background)',
  overflow: 'hidden',
  position: 'relative',
  height: '100%',
};

const DeepEditorLayout: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  overflow: 'hidden',
};

export const CodeMicroscope: React.FC<CodeMicroscopeProps> = ({
  frame,
  onZoomIn,
  onZoomOut,
  cockpitState,
  vscode,
}) => {
  const handleZoomIn = (nextFrame: ContextFrame) => {
    onZoomIn({
      ...nextFrame,
      parentId: frame.id,
    });
  };

  const handleCommitIndexChange = (index: number) => {
    vscode.postMessage({ type: 'updateCommitIndex', value: index });
  };

  const frameData = frame.level === 'bundle' ? cockpitState?.bundleView || frame.data : frame.data;
  const renderFrame = frame.level === 'bundle' ? { ...frame, data: frameData } : frame;

  const [zoomLevel, setZoomLevel] = React.useState<'focus' | 'normal' | 'overview'>('focus');
  const [focusedSymbolId, setFocusedSymbolId] = React.useState<string | null>(
    renderFrame.data?.symbolId || null
  );

  // Effect to sync focusedSymbolId when frame changes (e.g. navigation to symbol)
  React.useEffect(() => {
    if (renderFrame.data?.symbolId) {
      setFocusedSymbolId(renderFrame.data.symbolId);
      setZoomLevel('focus');
    }
  }, [renderFrame.data?.symbolId, renderFrame.id]);

  // Unconditional hook call
  const handleRequestFileDetails = React.useCallback(
    (filePath: string) => {
      if (vscode) {
        vscode.postMessage({ type: 'requestFileDetails', payload: { filePath } });
      }
    },
    [vscode]
  );

  const analysisData = useFileAnalysisData(
    renderFrame.level === 'file' ? renderFrame.id : '',
    cockpitState?.bundleFacts,
    cockpitState?.currentCommitIndex,
    cockpitState?.bundleFactsSkeleton,
    cockpitState?.fileEvidenceCache,
    handleRequestFileDetails
  );

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      if (e.deltaY > 0) {
        setZoomLevel(prev => {
          if (prev === 'focus') {
            setFocusedSymbolId(null); // Clear focus when zooming out
            return 'normal';
          }
          return 'overview';
        });
      } else {
        setZoomLevel(prev => (prev === 'overview' ? 'normal' : 'focus'));
      }
    }
  };

  // Calculate values at top level for useEffect
  const totalCommits = cockpitState?.bundleFacts?.bundle?.totalCommits || 0;
  const headInfo = cockpitState?.headInfo;
  const fileDataHistory = renderFrame.data?.history;
  const selectedCommitShas = cockpitState?.selectedCommitShas || [];

  React.useEffect(() => {
    if (
      renderFrame.level === 'file' &&
      selectedCommitShas.length === 0 &&
      !fileDataHistory &&
      totalCommits > 0 &&
      !headInfo
    ) {
      // Request HEAD info from extension host
      vscode.postMessage({ type: 'getHeadInfo' });
    }
  }, [
    renderFrame.level,
    selectedCommitShas.length,
    fileDataHistory,
    totalCommits,
    headInfo,
    vscode,
  ]);

  if (renderFrame.level === 'file') {
    const metrics = cockpitState?.nodeMetrics?.[renderFrame.id] || renderFrame.data?.metrics;
    const content = renderFrame.data?.content || '';
    const symbols = renderFrame.data?.symbols || [];
    const lineCommits = renderFrame.data?.lineCommits || [];
    const blastRadius = renderFrame.data?.blastRadius;
    const driftIssues = renderFrame.data?.drift || [];

    // Get ordered commits from state (for commit index calculation)
    let orderedCommits = cockpitState?.selectedCommitShas || [];
    let commits: any[] = [];

    const optimisticHead = cockpitState?.headInfo || null;

    if (orderedCommits.length > 0) {
      // Use global selection
      commits = (cockpitState?.commits || [])
        .filter(c => orderedCommits.includes(c.sha))
        .sort((a, b) => {
          const aIndex = orderedCommits.indexOf(a.sha);
          const bIndex = orderedCommits.indexOf(b.sha);
          return aIndex - bIndex;
        })
        .map(c => ({
          sha: c.sha,
          date: c.authoredAt,
          message: c.message,
          author: c.author,
        }));
    } else if (renderFrame.data?.history && Array.isArray(renderFrame.data.history)) {
      // Fallback to file history
      // History is usually newest to oldest, so we reverse for the timeline (oldest to newest)
      const fileHistory = [...renderFrame.data.history].reverse();
      orderedCommits = fileHistory.map((c: any) => c.hash || c.sha);
      commits = fileHistory.map((c: any) => ({
        sha: c.hash || c.sha,
        date: c.date,
        message: c.message,
        author: c.author_name || c.author,
      }));
    } else if (optimisticHead) {
      // Optimistic: Use HEAD commit for time travel
      orderedCommits = [optimisticHead.sha];
      commits = [optimisticHead];
    }

    // Default to latest commit if index is undefined
    const currentCommitIndex =
      cockpitState?.currentCommitIndex !== undefined
        ? cockpitState.currentCommitIndex
        : orderedCommits.length > 0
          ? orderedCommits.length - 1
          : undefined;

    const handleNeighborClick = (filePath: string) => {
      if (vscode) {
        const neighborFrame: ContextFrame = {
          level: 'file',
          id: filePath,
          name: filePath.split('/').pop() || filePath,
          status: 'scanning',
          parentId: frame.id,
        };
        vscode.postMessage({ type: 'navigateToFrame', frame: neighborFrame });
        vscode.postMessage({ type: 'analyzeFrame', frameId: filePath });
      }
    };

    return (
      <div style={MicroscopeContainer} onWheel={handleWheel}>
        <StageHeader
          fileName={renderFrame.name}
          filePath={renderFrame.id}
          metrics={metrics}
          onNavigate={() => onZoomOut()}
          explorerData={cockpitState?.explorerData}
          bundleFacts={cockpitState?.bundleFacts}
          onNeighborClick={handleNeighborClick}
        />

        {/* Zoom Controls (Temporary UI) */}
        <div
          style={{
            position: 'absolute',
            top: '50px',
            right: '240px',
            zIndex: 10,
            display: 'flex',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setZoomLevel('overview')}
            style={{ opacity: zoomLevel === 'overview' ? 1 : 0.5 }}
          >
            -
          </button>
          <button
            onClick={() => setZoomLevel('normal')}
            style={{ opacity: zoomLevel === 'normal' ? 1 : 0.5 }}
          >
            =
          </button>
          <button
            onClick={() => setZoomLevel('focus')}
            style={{ opacity: zoomLevel === 'focus' ? 1 : 0.5 }}
          >
            +
          </button>
        </div>

        <div style={DeepEditorLayout}>
          {zoomLevel === 'focus' ? (
            <CodeEditor
              content={content}
              language={renderFrame.data?.language || 'text'}
              driftIssues={driftIssues}
              symbols={symbols}
              focusedSymbolId={focusedSymbolId}
              onSymbolClick={(symbolId: string) => setFocusedSymbolId(symbolId)}
              onClearFocus={() => setFocusedSymbolId(null)}
              lineCommits={lineCommits}
              orderedCommits={orderedCommits}
              currentCommitIndex={currentCommitIndex}
              filePath={renderFrame.id}
              bundleFacts={cockpitState?.bundleFacts}
              movedBlocks={analysisData.movedBlocks}
              showLineNumbers={true}
              showAgeGutter={true}
              showMovedGutter={true}
              metrics={metrics}
            />
          ) : zoomLevel === 'overview' ? (
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
              {symbols.length > 0 ? (
                symbols.map((sym: any) => {
                  const symbolDriftIssues = driftIssues.filter(
                    (issue: any) => issue.symbol === sym.name
                  );
                  const hasDrift = symbolDriftIssues.length > 0;
                  return (
                    <SignatureView
                      key={sym.id || sym.name}
                      name={sym.name}
                      kind={sym.kind}
                      signature={sym.signature}
                      startLine={sym.location?.start?.line || sym.startLine || 0}
                      endLine={sym.location?.end?.line || sym.endLine || 0}
                      hasDrift={hasDrift}
                      riskScore={metrics?.riskScore}
                      onClick={() => {
                        setZoomLevel('focus');
                        setFocusedSymbolId(sym.id || sym.name);
                      }}
                    />
                  );
                })
              ) : (
                <div style={{ opacity: 0.5, textAlign: 'center', marginTop: '40px' }}>
                  No symbols found. Switch to Focus view.
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {symbols.length > 0 ? (
                symbols.map((sym: any) => (
                  <SymbolBlock
                    key={sym.id || sym.name}
                    name={sym.name}
                    kind={sym.kind}
                    startLine={sym.location?.start?.line || sym.startLine || 0}
                    endLine={sym.location?.end?.line || sym.endLine || 0}
                    complexity={metrics?.complexity || 0} // Mock
                    onClick={() => {
                      setZoomLevel('focus');
                      setFocusedSymbolId(sym.id || sym.name);
                    }}
                  />
                ))
              ) : (
                <div style={{ opacity: 0.5, textAlign: 'center', marginTop: '40px' }}>
                  No symbols found. Switch to Focus view.
                </div>
              )}
            </div>
          )}

          <PortalsRail
            incomingRefs={metrics?.incomingRefs}
            outgoingRefs={metrics?.outgoingRefs}
            blastRadius={blastRadius}
            focusedSymbolId={focusedSymbolId}
            currentFilePath={renderFrame.id}
            currentCommitIndex={currentCommitIndex}
            orderedCommits={orderedCommits}
            bundleFacts={cockpitState?.bundleFacts}
            vscode={vscode}
            commits={commits}
          />
        </div>

        <TimeScrubber
          commits={commits}
          currentCommitIndex={currentCommitIndex}
          onCommitIndexChange={handleCommitIndexChange}
          bundleFacts={cockpitState?.bundleFacts}
          lineCommits={lineCommits}
        />

        <DriftBrowserPanel
          bundleFacts={cockpitState?.bundleFacts || null}
          onNavigate={(fileId: string, line?: number) => {
            if (vscode) {
              const targetFrame: ContextFrame = {
                level: 'file',
                id: fileId,
                name: fileId.split('/').pop() || fileId,
                status: 'ready',
                parentId: renderFrame.id,
              };
              vscode.postMessage({ type: 'navigateToFrame', frame: targetFrame });
              vscode.postMessage({ type: 'analyzeFrame', frameId: fileId });
              if (line !== undefined) {
                // Could add line navigation here if supported
              }
            }
          }}
        />
      </div>
    );
  }

  return (
    <div style={MicroscopeContainer}>
      {/* Standard Header for non-file views (Back button etc) */}
      {renderFrame.level !== 'bundle' && (
        <div style={{ padding: '8px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
          <button onClick={onZoomOut} disabled={!frame.parentId}>
            ← Back
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderFrame.status === 'scanning' ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <div>Scanning {renderFrame.name}...</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>Tier {renderFrame.tier || 1}/3</div>
          </div>
        ) : (
          <>
            {renderFrame.id === 'reports-root' ? (
              cockpitState ? (
                <ReportsStage cockpitState={cockpitState} vscode={vscode} />
              ) : (
                <div>Loading state...</div>
              )
            ) : (
              <>
                {renderFrame.level === 'bundle' && (
                  <BundleStage
                    frame={renderFrame}
                    onZoomIn={handleZoomIn}
                    cockpitState={cockpitState}
                    vscode={vscode}
                  />
                )}
                {renderFrame.level === 'folder' && (
                  <FolderStage
                    frame={renderFrame}
                    onZoomIn={handleZoomIn}
                    cockpitState={cockpitState}
                  />
                )}
                {renderFrame.level === 'blast_radius' && (
                  <BlastRadiusStage frame={renderFrame} onZoomIn={handleZoomIn} />
                )}
                {renderFrame.level === 'symbol' && (
                  <SymbolStage frame={renderFrame} vscode={vscode} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
