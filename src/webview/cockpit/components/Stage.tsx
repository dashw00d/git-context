import * as React from 'react';
import { StageProps } from '../types/superWebviewTypes';
import { CockpitState } from '../../../types/cockpit';
import { CodeMicroscope } from './CodeMicroscope';

export const Stage: React.FC<StageProps & { cockpitState?: CockpitState; vscode?: any }> = ({
  frame,
  onZoomIn,
  onZoomOut,
  cockpitState,
  vscode,
}) => {
  return (
    <CodeMicroscope
      frame={frame}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      cockpitState={cockpitState}
      vscode={vscode}
    />
  );
};
