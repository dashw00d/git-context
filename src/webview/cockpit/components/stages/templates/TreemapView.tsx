import * as React from 'react';
import { TreemapNode } from '../TreemapNode';

export const TreemapView: React.FC<{
  treemap: any[];
  isAnalyzing?: boolean;
  hasHotspots?: boolean;
}> = ({ treemap, isAnalyzing, hasHotspots }) => {
  if (treemap && treemap.length > 0) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '15px' }}>
        {treemap.map((node: any, index: number) => (
          <TreemapNode key={node.id || node.path || `${node.name}-${index}`} node={node} />
        ))}
      </div>
    );
  }

  return (
    <p style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }}>
      {isAnalyzing
        ? 'Loading heatmap...'
        : hasHotspots
          ? '' // Don't show "No churn data" if we have hotspots (fallback to list)
          : 'No churn data yet. Run Analyze to populate the heatmap.'}
    </p>
  );
};
