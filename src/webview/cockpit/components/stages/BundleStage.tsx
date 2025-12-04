import * as React from 'react';
import { CockpitState } from '../../../../types/cockpit';
import { postMessageWithTracing } from '../../utils/messageUtils';
import { StatsSection } from '../StatsSection';
import { BundleConfig, ConfigPanel } from './templates/ConfigPanel';
import { HotspotList } from './templates/HotspotList';
import { RisksList } from './templates/RisksList';
import { TreemapView } from './templates/TreemapView';

export const BundleStage: React.FC<{
  frame: any;
  onZoomIn: (frame: any) => void;
  cockpitState?: CockpitState;
  vscode?: any;
}> = ({ frame, onZoomIn, cockpitState, vscode }) => {
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const defaultConfig: BundleConfig = {
    mode: 'repo',
    roots: [],
    includeConnected: false,
    exclusions: [],
  };
  const [formConfig, setFormConfig] = React.useState<BundleConfig>(
    cockpitState?.bundleConfig || defaultConfig
  );
  const [depth, setDepth] = React.useState<number>(cockpitState?.lastNCommits || 20);

  React.useEffect(() => {
    setFormConfig(
      cockpitState?.bundleConfig || {
        mode: 'repo',
        roots: [],
        includeConnected: false,
        exclusions: [],
      }
    );
    setDepth(cockpitState?.lastNCommits || 20);
  }, [cockpitState?.bundleConfig, cockpitState?.lastNCommits]);

  const handleConfigChange = (updates: Partial<BundleConfig>) => {
    setFormConfig(prev => ({ ...prev, ...updates }));
  };

  const applyConfig = () => {
    if (!vscode) return;
    postMessageWithTracing(vscode, { type: 'updateBundleConfig', config: formConfig });
    postMessageWithTracing(vscode, { type: 'setLastNCommits', value: depth });
    const mode = formConfig.mode === 'changes' ? ('changes' as const) : ('selection' as const);
    postMessageWithTracing(vscode, { type: 'generateReport', mode, force: true });
  };

  const handleFileClick = (file: any) => {
    onZoomIn({
      level: 'file',
      id: file.path,
      name: file.name || file.path.split('/').pop(),
      status: 'scanning',
    });
  };

  console.log('[BundleStage] frame.data:', frame.data);
  console.log('[BundleStage] frame.data.hotspots:', frame.data?.hotspots);
  console.log('[BundleStage] frame.data.treemap:', frame.data?.treemap);

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
        <h3 style={{ fontSize: '1.2em', margin: 0 }}>Hotspots</h3>
        <button
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--vscode-textLink-foreground)',
            cursor: 'pointer',
            fontSize: '0.9em',
          }}
        >
          {isConfigOpen ? 'Hide Scope' : 'Configure Scope'}
        </button>
      </div>

      {isConfigOpen && (
        <ConfigPanel
          config={formConfig}
          depth={depth}
          isAnalyzing={cockpitState?.isAnalyzing}
          onConfigChange={handleConfigChange}
          onDepthChange={setDepth}
          onApply={applyConfig}
          onClose={() => setIsConfigOpen(false)}
        />
      )}

      {cockpitState && <StatsSection state={cockpitState} vscode={vscode} />}

      <TreemapView
        treemap={frame.data?.treemap}
        isAnalyzing={cockpitState?.isAnalyzing}
        hasHotspots={frame.data?.hotspots && frame.data.hotspots.length > 0}
      />

      {frame.data?.hotspots && frame.data.hotspots.length > 0 && (
        <HotspotList
          hotspots={frame.data.hotspots}
          onFileClick={handleFileClick}
          isAnalyzing={cockpitState?.isAnalyzing}
        />
      )}

      {frame.data?.risks && frame.data.risks.length > 0 && <RisksList risks={frame.data.risks} />}
    </div>
  );
};
