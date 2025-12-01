import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';
import { CommitList } from './CommitList';

interface CommitsTabContentProps {
  state: CockpitState;
  vscode: any;
  updateCommitsFilterText: (text: string) => void;
  toggleCommitsScope: (scope: keyof CockpitState['commitsFilterScopes']) => void;
  formatDate: (date?: string | null) => string;
}

export const CommitsTabContent: React.FC<CommitsTabContentProps> = ({
  state,
  vscode,
  updateCommitsFilterText,
  toggleCommitsScope,
  formatDate,
}) => {
  return (
    <div className="cockpit__tab-body">
      <div className="cockpit__actions">
        <button
          className="cockpit__button ghost"
          onClick={() => vscode.postMessage({ type: 'clearSelection' })}
        >
          Clear selection
        </button>
        <button
          className="cockpit__button ghost"
          onClick={() => {
            const value = prompt('Add commit by SHA or ref');
            if (value) {
              vscode.postMessage({ type: 'addCommitBySha', shaOrRef: value });
            }
          }}
        >
          Add commit by SHA
        </button>
      </div>
      <div className="cockpit__actions">
        <input
          className="cockpit__input"
          placeholder="Filter commits..."
          value={state.commitsFilterText}
          onChange={e => updateCommitsFilterText(e.target.value)}
        />
        <button
          className="cockpit__button ghost small"
          onClick={() => toggleCommitsScope('staged')}
          title="Show staged commits"
        >
          {state.commitsFilterScopes.staged ? 'Staged ✓' : 'Staged ✕'}
        </button>
        <button
          className="cockpit__button ghost small"
          onClick={() => toggleCommitsScope('unstaged')}
          title="Show unstaged commits"
        >
          {state.commitsFilterScopes.unstaged ? 'Unstaged ✓' : 'Unstaged ✕'}
        </button>
        <button
          className="cockpit__button ghost small"
          onClick={() => toggleCommitsScope('history')}
          title="Show history commits"
        >
          {state.commitsFilterScopes.history ? 'History ✓' : 'History ✕'}
        </button>
      </div>
      <div className="cockpit__actions">
        {state.hasMoreCommits ? (
          <button
            className="cockpit__button ghost"
            onClick={() => vscode.postMessage({ type: 'loadMoreCommits' })}
          >
            Load more
          </button>
        ) : (
          <span className="cockpit__dim">Showing {state.commits.length} commits</span>
        )}
      </div>
      <CommitList state={state} vscode={vscode} formatDate={formatDate} />
    </div>
  );
};
