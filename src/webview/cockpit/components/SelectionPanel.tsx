import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';

interface SelectionPanelProps {
    state: CockpitState;
    vscode: any;
}

export const SelectionPanel: React.FC<SelectionPanelProps> = ({ state, vscode }) => {
    const totalSelected = state.selectedCommitShas.length + state.selectedStagedPaths.length + state.selectedUnstagedPaths.length;

    if (totalSelected === 0) {
        return (
            <div className="cockpit__card cockpit__card--selection">
                <div className="cockpit__card-title">Selection</div>
                <div className="cockpit__empty" style={{ padding: '12px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', opacity: 0.3 }}>📋</div>
                    <div style={{ marginTop: '8px' }}>No items selected</div>
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                        Select commits or files to analyze
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="cockpit__card cockpit__card--selection">
            <div className="cockpit__card-title">
                Selection ({totalSelected} item{totalSelected !== 1 ? 's' : ''})
            </div>

            {state.selectedCommitShas.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#8a8f98', marginBottom: '4px' }}>
                        COMMITS ({state.selectedCommitShas.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {state.selectedCommitShas.slice(0, 3).map((sha) => {
                            const commit = state.commits.find(c => c.sha === sha);
                            return (
                                <div
                                    key={sha}
                                    style={{
                                        fontSize: '12px',
                                        padding: '4px 6px',
                                        background: '#14171c',
                                        borderRadius: '3px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <span className="cockpit__mono" style={{ color: '#4fc3f7' }}>
                                        {sha.slice(0, 7)}
                                    </span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {commit?.message || ''}
                                    </span>
                                </div>
                            );
                        })}
                        {state.selectedCommitShas.length > 3 && (
                            <div style={{ fontSize: '11px', color: '#8a8f98', paddingLeft: '6px' }}>
                                +{state.selectedCommitShas.length - 3} more
                            </div>
                        )}
                    </div>
                </div>
            )}

            {state.selectedStagedPaths.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#8a8f98', marginBottom: '4px' }}>
                        STAGED FILES ({state.selectedStagedPaths.length})
                    </div>
                    <div style={{ fontSize: '12px' }}>
                        {state.selectedStagedPaths.slice(0, 3).map((path, i) => (
                            <div key={i} style={{ padding: '2px 0 ', color: '#81c784' }}>
                                📄 {path.split('/').pop()}
                            </div>
                        ))}
                        {state.selectedStagedPaths.length > 3 && (
                            <div style={{ fontSize: '11px', color: '#8a8f98' }}>
                                +{state.selectedStagedPaths.length - 3} more
                            </div>
                        )}
                    </div>
                </div>
            )}

            {state.selectedUnstagedPaths.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#8a8f98', marginBottom: '4px' }}>
                        UNSTAGED FILES ({state.selectedUnstagedPaths.length})
                    </div>
                    <div style={{ fontSize: '12px' }}>
                        {state.selectedUnstagedPaths.slice(0, 3).map((path, i) => (
                            <div key={i} style={{ padding: '2px 0', color: '#ffb74d' }}>
                                📄 {path.split('/').pop()}
                            </div>
                        ))}
                        {state.selectedUnstagedPaths.length > 3 && (
                            <div style={{ fontSize: '11px', color: '#8a8f98' }}>
                                +{state.selectedUnstagedPaths.length - 3} more
                            </div>
                        )}
                    </div>
                </div>
            )}

            <button
                className="cockpit__button ghost small"
                onClick={() => vscode.postMessage({ type: 'clearSelection' })}
                style={{ marginTop: '12px', width: '100%' }}
            >
                Clear Selection
            </button>
        </div>
    );
};
