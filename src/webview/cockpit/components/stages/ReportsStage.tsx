import * as React from 'react';
import { CockpitState } from '../../../../types/cockpit';
import { ReportList } from '../ReportList';

export const ReportsStage: React.FC<{ cockpitState: CockpitState; vscode: any }> = ({
  cockpitState,
  vscode,
}) => (
  <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
    <ReportList state={cockpitState} vscode={vscode} />
  </div>
);
