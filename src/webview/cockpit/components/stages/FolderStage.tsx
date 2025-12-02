import * as React from 'react';
import { CockpitState } from '../../../../types/cockpit';
import { HotspotList } from './templates/HotspotList';
import { RisksList } from './templates/RisksList';
import { SummaryStats } from './templates/SummaryStats';
import { TreemapView } from './templates/TreemapView';

export const FolderStage: React.FC<{
  frame: any;
  onZoomIn: (frame: any) => void;
  cockpitState?: CockpitState;
}> = ({ frame, onZoomIn, cockpitState }) => {
  const handleFileClick = (file: any) => {
    onZoomIn({
      level: 'file',
      id: file.path,
      name: file.name || file.path.split('/').pop(),
      status: 'scanning',
    });
  };

  // Filter bundle data to only show files within this folder's path
  const folderPath = frame.id;
  const bundleData = cockpitState?.bundleView;

  const filteredHotspots = React.useMemo(() => {
    if (!bundleData?.hotspots) return [];
    return bundleData.hotspots.filter((file: any) => file.path.startsWith(folderPath));
  }, [bundleData?.hotspots, folderPath]);

  const filteredTreemap = React.useMemo(() => {
    if (!bundleData?.treemap) return [];
    return bundleData.treemap.filter((node: any) => {
      const nodePath = node.path || node.id;
      return nodePath && nodePath.startsWith(folderPath);
    });
  }, [bundleData?.treemap, folderPath]);

  const filteredRisks = React.useMemo(() => {
    if (!bundleData?.risks) return [];
    return bundleData.risks.filter(
      (risk: any) => risk.path && risk.path.startsWith(folderPath)
    );
  }, [bundleData?.risks, folderPath]);

  // Calculate folder-scoped stats
  const fileCount = filteredHotspots.length;
  const symbolCount = filteredHotspots.reduce(
    (sum: number, file: any) => sum + (file.symbols || 0),
    0
  );

  // Debug logging
  console.log('[FolderStage] folderPath:', folderPath);
  console.log('[FolderStage] filteredHotspots:', filteredHotspots);
  console.log('[FolderStage] filteredTreemap:', filteredTreemap);

  return (
    <div style={{ width: '100%', padding: '10px', overflow: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <h3 style={{ fontSize: '1.2em', margin: 0 }}>{frame.name}</h3>
        <div style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }}>
          {folderPath}
        </div>
      </div>

      {cockpitState?.bundleSummary && (
        <SummaryStats
          commitCount={cockpitState.bundleSummary.commitCount}
          fileCount={fileCount}
          symbolCount={symbolCount > 0 ? symbolCount : undefined}
        />
      )}

      <TreemapView
        treemap={filteredTreemap}
        isAnalyzing={cockpitState?.isAnalyzing}
        hasHotspots={filteredHotspots.length > 0}
      />

      {filteredHotspots.length > 0 && (
        <HotspotList
          hotspots={filteredHotspots}
          onFileClick={handleFileClick}
          isAnalyzing={cockpitState?.isAnalyzing}
        />
      )}

      {filteredRisks.length > 0 && <RisksList risks={filteredRisks} />}

      {filteredHotspots.length === 0 && !cockpitState?.isAnalyzing && (
        <p style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }}>
          No hotspots found in this folder. Files may not have been modified recently.
        </p>
      )}
    </div>
  );
};
