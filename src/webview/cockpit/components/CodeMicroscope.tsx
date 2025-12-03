import * as React from 'react';
import { CockpitState, ContextFrame } from '../../../types/cockpit';
import { BlastRadiusStage } from './stages/BlastRadiusStage';
import { BundleStage } from './stages/BundleStage';
import { FolderStage } from './stages/FolderStage';
import { ReportsStage } from './stages/ReportsStage';
import { SymbolStage } from './stages/SymbolStage';

import { CodeEditor } from './stages/CodeEditor';
import { PortalsRail } from './stages/PortalsRail';
import { SedimentGutter } from './stages/SedimentGutter';
import { StageHeader } from './stages/StageHeader';
import { SymbolBlock } from './stages/SymbolBlock';
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

  const handleTimeFilterChange = (value: number) => {
    vscode.postMessage({ type: 'updateTimeFilter', value });
  };

  const frameData = frame.level === 'bundle' ? cockpitState?.bundleView || frame.data : frame.data;
  const renderFrame = frame.level === 'bundle' ? { ...frame, data: frameData } : frame;

  const [zoomLevel, setZoomLevel] = React.useState<'focus' | 'normal' | 'overview'>('focus');

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      if (e.deltaY > 0) {
        setZoomLevel(prev => (prev === 'focus' ? 'normal' : 'overview'));
      } else {
        setZoomLevel(prev => (prev === 'overview' ? 'normal' : 'focus'));
      }
    }
  };

  if (renderFrame.level === 'file') {
    const metrics = cockpitState?.nodeMetrics?.[renderFrame.id] || renderFrame.data?.metrics;
    const content = renderFrame.data?.content || '';
    const lineCount = renderFrame.data?.lineCount || content.split('\n').length;

    // Mock symbols for zoom view (in real app, get from frame.data.symbols)
    const symbols = renderFrame.data?.symbols || [];

    return (
      <div style={MicroscopeContainer} onWheel={handleWheel}>
        <StageHeader fileName={renderFrame.name} metrics={metrics} onNavigate={() => {}} />

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
          <SedimentGutter
            lineCount={lineCount}
            currentTimeFilter={cockpitState?.currentTimeFilter}
          />

          {zoomLevel === 'focus' ? (
            <CodeEditor content={content} language={renderFrame.data?.language || 'text'} />
          ) : (
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {symbols.length > 0 ? (
                symbols.map((sym: any) => (
                  <SymbolBlock
                    key={sym.id}
                    name={sym.name}
                    kind={sym.kind}
                    startLine={sym.startLine}
                    endLine={sym.endLine}
                    complexity={metrics?.complexity || 0} // Mock
                    onClick={() => setZoomLevel('focus')}
                  />
                ))
              ) : (
                <div style={{ opacity: 0.5, textAlign: 'center', marginTop: '40px' }}>
                  No symbols found. Switch to Focus view.
                </div>
              )}
            </div>
          )}

          <PortalsRail incomingRefs={metrics?.incomingRefs} outgoingRefs={metrics?.outgoingRefs} />
        </div>

        <TimeScrubber
          currentTimeFilter={cockpitState?.currentTimeFilter}
          onTimeFilterChange={handleTimeFilterChange}
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
          <div style={{ padding: '20px', textAlign: 'center' }}>Scanning...</div>
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
