import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';
import { formatDate } from '../utils';

interface ReportListProps {
    state: CockpitState;
    vscode: any;
}

export const ReportList: React.FC<ReportListProps> = ({ state, vscode }) => {
    const filter = state.reportsFilterText.toLowerCase();
    const list = state.reports.filter(
        (r) =>
            (!filter ||
                (r.title || '').toLowerCase().includes(filter) ||
                (r.summary || '').toLowerCase().includes(filter)) &&
            (!state.reportsShowPinnedOnly || r.pinned) &&
            (state.reportsBranchFilter === 'all' || r.branch === state.reportsBranchFilter)
    );

    if (!list.length) {
        return (
            <div className="cockpit__empty">
                <div>No reports yet</div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#8a8f98' }}>
                    Generate a report by analyzing commits or staged/unstaged changes
                </div>
            </div>
        );
    }

    return (
        <ul className="cockpit__list">
            {list.map((r) => (
                <li
                    key={r.id}
                    className="cockpit__list-item cockpit__list-item--clickable"
                    onClick={() => vscode.postMessage({ type: 'openReport', reportId: r.id })}
                >
                    <div className="cockpit__row">
                        <span>{r.title || 'Untitled report'}</span>
                        {r.branch && (
                            <span className="cockpit__badge" title={`Branch: ${r.branch}`}>
                                🌿 {r.branch}
                            </span>
                        )}
                        <span className="cockpit__dim">{r.pinned ? '📌' : ''}</span>
                        <span className="cockpit__dim">{formatDate(r.createdAt)}</span>
                    </div>
                    {r.summary ? <div className="cockpit__message">{r.summary}</div> : null}
                    <div className="cockpit__actions">
                        <button
                            className="cockpit__button ghost small"
                            onClick={(e) => {
                                e.stopPropagation();
                                vscode.postMessage({ type: 'regenerateReport', reportId: r.id });
                            }}
                        >
                            Regenerate
                        </button>
                        <button
                            className="cockpit__button ghost small"
                            onClick={(e) => {
                                e.stopPropagation();
                                vscode.postMessage({ type: 'togglePinReport', reportId: r.id });
                            }}
                        >
                            {r.pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                            className="cockpit__button ghost small danger"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to delete the report "${r.title || 'Untitled'}"? This cannot be undone.`)) {
                                    vscode.postMessage({ type: 'deleteReport', reportId: r.id });
                                }
                            }}
                        >
                            Delete
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
};
