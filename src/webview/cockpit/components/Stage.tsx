import * as React from 'react';
import { StageProps } from '../types/superWebviewTypes';
import { ZoomLevel, CockpitState } from '../../../types/cockpit';
import { BlastRadiusStage } from './stages/BlastRadiusStage';
import { BundleStage } from './stages/BundleStage';
import { FileStage } from './stages/FileStage';
import { FolderStage } from './stages/FolderStage';
import { ReportsStage } from './stages/ReportsStage';
import { SymbolStage } from './stages/SymbolStage';

const StageContainer: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--vscode-editor-background)',
  overflow: 'hidden',
  position: 'relative',
};

const HeaderStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: 'var(--vscode-editor-background)',
};

const ContentStyle: React.CSSProperties = {
  flex: 1,
  padding: '20px',
  overflow: 'auto',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

export const Stage: React.FC<StageProps & { cockpitState?: CockpitState; vscode?: any }> = ({
  frame,
  onZoomIn,
  onZoomOut,
  cockpitState,
  vscode,
}) => {
  const handleZoomIn = (id: string, name: string) => {
    let nextLevel: ZoomLevel = 'bundle';
    if (frame.level === 'bundle') nextLevel = 'blast_radius';
    else if (frame.level === 'blast_radius') nextLevel = 'file';
    else if (frame.level === 'file') nextLevel = 'symbol';
    else return;

    onZoomIn({
      level: nextLevel,
      id,
      name,
      parentId: frame.id,
      status: 'ready',
    });
  };

  // For bundle frames, prefer bundleView from global state (always up-to-date)
  // For other frames, use frame.data (populated by tier analysis)
  const frameData = frame.level === 'bundle' ? cockpitState?.bundleView || frame.data : frame.data;
  const tier = frame.tier || frameData?.tier;
  const renderFrame = frame.level === 'bundle' ? { ...frame, data: frameData } : frame;

  return (
    <div style={StageContainer}>
      <div style={HeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={onZoomOut}
            disabled={!frame.parentId}
            style={{
              marginRight: '6px',
              background: 'none',
              border: 'none',
              color: 'var(--vscode-button-foreground)',
              cursor: 'pointer',
              opacity: !frame.parentId ? 0.5 : 1,
            }}
          >
            ← Back
          </button>
          <strong>{frame.name}</strong> <span style={{ opacity: 0.7 }}>({frame.level})</span>
          {frame.breadcrumbs && (
            <span style={{ fontSize: '0.8em', opacity: 0.7 }}>{frame.breadcrumbs.join(' / ')}</span>
          )}
          {tier && (
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                background:
                  tier === 'structure'
                    ? 'var(--vscode-badge-background)'
                    : tier === 'hybrid'
                      ? 'var(--vscode-inputValidation-warningBackground)'
                      : 'var(--vscode-charts-green)',
                color:
                  tier === 'structure'
                    ? 'var(--vscode-badge-foreground)'
                    : 'var(--vscode-foreground)',
                fontSize: '0.75em',
                textTransform: 'uppercase',
              }}
            >
              {tier}
            </span>
          )}
          {frame.level === 'bundle' && frameData?.summary && (
            <span style={{ fontSize: '0.8em', opacity: 0.7 }}>
              • {frameData.summary.files} files • {frameData.summary.symbols} symbols
            </span>
          )}
        </div>
      </div>
      <div style={ContentStyle}>
        {frame.status === 'scanning' ? (
          <div style={{ textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
            <div style={{ fontSize: '2em', marginBottom: '10px' }}>⏳</div>
            <h3>Scanning {frame.name}...</h3>
            <p>Analyzing history, drift, and risks.</p>
          </div>
        ) : (
          <>
            {renderFrame.id === 'reports-root' && cockpitState && vscode ? (
              <ReportsStage cockpitState={cockpitState} vscode={vscode} />
            ) : (
              <>
                {renderFrame.level === 'bundle' && (
                  <BundleStage
                    frame={renderFrame}
                    onZoomIn={f => onZoomIn(f)}
                    cockpitState={cockpitState}
                    vscode={vscode}
                  />
                )}
                {renderFrame.level === 'folder' && (
                  <FolderStage
                    frame={renderFrame}
                    onZoomIn={f => onZoomIn(f)}
                    cockpitState={cockpitState}
                  />
                )}
                {renderFrame.level === 'blast_radius' && (
                  <BlastRadiusStage frame={renderFrame} onZoomIn={f => onZoomIn(f)} />
                )}
                {renderFrame.level === 'file' && (
                  <FileStage frame={renderFrame} onZoomIn={f => onZoomIn(f)} />
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
