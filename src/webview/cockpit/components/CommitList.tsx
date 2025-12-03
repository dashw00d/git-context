import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';
import { postMessageWithTracing } from '../utils/messageUtils';

interface CommitListProps {
  state: CockpitState;
  vscode: any;
  formatDate: (date?: string | null) => string;
}

export const CommitList: React.FC<CommitListProps> = ({ state, vscode, formatDate }) => {
  const [expandedCommits, setExpandedCommits] = React.useState<Set<string>>(new Set());

  const toggleCommitExpanded = (sha: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(expandedCommits);
    if (newSet.has(sha)) {
      newSet.delete(sha);
    } else {
      newSet.add(sha);
    }
    setExpandedCommits(newSet);
  };

  const filter = state.commitsFilterText.toLowerCase();

  const selectedCommits = state.commits.filter(c => state.selectedCommitShas.includes(c.sha));

  const alreadyAnalyzedSelection =
    selectedCommits.length > 0 && selectedCommits.every(c => c.analyzed);

  let scopedCommits = state.commits.filter(c => {
    if (c.scope === 'staged' && !state.commitsFilterScopes.staged) return false;
    if (c.scope === 'unstaged' && !state.commitsFilterScopes.unstaged) return false;
    if (c.scope === 'history' && !state.commitsFilterScopes.history) return false;
    return true;
  });

  const list = scopedCommits.filter(
    c =>
      !filter ||
      c.message.toLowerCase().includes(filter) ||
      c.sha.toLowerCase().includes(filter) ||
      c.shortSha.toLowerCase().includes(filter)
  );

  if (!list.length) {
    const hasScopeFilters =
      !state.commitsFilterScopes.staged ||
      !state.commitsFilterScopes.unstaged ||
      !state.commitsFilterScopes.history;
    return (
      <div className="cockpit__empty">
        {hasScopeFilters ? (
          <>
            <div>No commits match current filters</div>
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#8a8f98' }}>
              Try adjusting scope toggles or clearing the search filter
            </div>
          </>
        ) : (
          <>
            <div>No commits yet</div>
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#8a8f98' }}>
              Start by clicking "Analyze last N" to analyze recent commits
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {alreadyAnalyzedSelection && (
        <div
          className="cockpit__warning"
          style={{
            marginBottom: '12px',
            padding: '8px 12px',
            background: '#3a1f1f',
            border: '1px solid #b73a3a',
            borderRadius: '4px',
            color: '#ffb3b3',
            fontSize: '12px',
          }}
        >
          ⚠️ Selected commits have already been analyzed. Reanalyzing will regenerate report only.
        </div>
      )}
      <ul className="cockpit__list">
        {list.map(c => {
          const isExpanded = expandedCommits.has(c.sha);
          const isSelected = state.selectedCommitShas.includes(c.sha);

          return (
            <li
              key={c.sha}
              className={`cockpit__list-item ${isSelected ? 'cockpit__list-item--active' : ''}`}
              onClick={() => postMessageWithTracing(vscode, { type: 'toggleCommit', sha: c.sha })}
            >
              <div className="cockpit__row">
                <span
                  className={`cockpit__codicon codicon-${isExpanded ? 'chevron-down' : 'chevron-right'}`}
                  onClick={e => toggleCommitExpanded(c.sha, e)}
                  style={{ cursor: 'pointer', marginRight: '4px', fontSize: '12px' }}
                />
                <span className="cockpit__mono">{c.shortSha}</span>
                <span>{c.author || '—'}</span>
                <span className="cockpit__dim">{formatDate(c.authoredAt)}</span>
                {c.inBundle ? <span className="cockpit__dim">In bundle</span> : null}
                {typeof c.changes === 'number' && c.changes > 0 ? (
                  <span className="cockpit__dim">{c.changes} changes</span>
                ) : null}
              </div>
              <div className="cockpit__message" style={{ paddingLeft: '20px' }}>
                {c.message}
              </div>

              {isExpanded && c.files && (
                <div
                  className="cockpit__file-list"
                  style={{ paddingLeft: '20px', marginTop: '4px' }}
                >
                  {c.files.length > 0 ? (
                    c.files.map((f, i) => (
                      <div
                        key={i}
                        className="cockpit__row"
                        style={{ fontSize: '12px', padding: '2px 0' }}
                      >
                        <span
                          className={`cockpit__file-status status-${f.status.toLowerCase()}`}
                          style={{ width: '12px', display: 'inline-block', textAlign: 'center' }}
                        >
                          {f.status}
                        </span>
                        <span className="cockpit__dim">{f.path}</span>
                      </div>
                    ))
                  ) : (
                    <div className="cockpit__dim" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                      No files changed
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
};
