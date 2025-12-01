import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';
import { ReportList } from './ReportList';

interface ReportsTabContentProps {
  state: CockpitState;
  vscode: any;
  updateReportsFilterText: (text: string) => void;
  updateReportsBranchFilter: (branch: string | 'all') => void;
  updateReportsPinned: (value: boolean) => void;
}

export const ReportsTabContent: React.FC<ReportsTabContentProps> = ({
  state,
  vscode,
  updateReportsFilterText,
  updateReportsBranchFilter,
  updateReportsPinned,
}) => {
  const reportBranches = Array.from(
    new Set(state.reports.map(r => r.branch).filter(Boolean))
  ) as string[];

  return (
    <div className="cockpit__tab-body">
      <div className="cockpit__actions">
        <input
          className="cockpit__input"
          placeholder="Filter reports..."
          value={state.reportsFilterText}
          onChange={e => updateReportsFilterText(e.target.value)}
        />
        <select
          className="cockpit__input"
          value={state.reportsBranchFilter}
          onChange={e => updateReportsBranchFilter(e.target.value)}
        >
          <option value="all">All branches</option>
          {reportBranches.map(branch => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>
        <label className="cockpit__row">
          <input
            type="checkbox"
            checked={state.reportsShowPinnedOnly}
            onChange={e => updateReportsPinned(e.target.checked)}
          />
          <span className="cockpit__dim">Pinned only</span>
        </label>
      </div>
      <ReportList state={state} vscode={vscode} />
    </div>
  );
};
