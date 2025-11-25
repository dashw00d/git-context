import * as React from 'react';
import { CockpitState, SymbolChangeType } from '../../../types/cockpit';
import { formatDate, getSymbolKindIcon, getChangeTypeBadge } from '../utils';

interface SymbolListProps {
    state: CockpitState;
    vscode: any;
}

export const SymbolList: React.FC<SymbolListProps> = ({ state, vscode }) => {
    const filter = state.symbolFilterText.toLowerCase();
    const list = state.symbols.filter(
        (s) =>
            (!filter || s.name.toLowerCase().includes(filter) || s.path.toLowerCase().includes(filter)) &&
            (state.symbolKindFilter === 'all' || s.kind === state.symbolKindFilter) &&
            (state.symbolChangeFilter === 'all' || (s.changeType || 'modified') === state.symbolChangeFilter)
    );

    if (!list.length) {
        const hasFilters = state.symbolFilterText || state.symbolKindFilter !== 'all' || state.symbolChangeFilter !== 'all';
        return (
            <div className="cockpit__empty">
                {hasFilters ? (
                    <>
                        <div>No symbols match current filters</div>
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#8a8f98' }}>
                            Try adjusting filters or clearing the search
                        </div>
                    </>
                ) : (
                    <>
                        <div>No symbols yet</div>
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#8a8f98' }}>
                            Symbols will appear after analyzing commits
                        </div>
                    </>
                )}
            </div>
        );
    }

    return (
        <ul className="cockpit__list">
            {list.map((s) => (
                <li key={s.id} className="cockpit__list-item">
                    <div className="cockpit__row">
                        <span className="cockpit__codicon" data-icon={getSymbolKindIcon(s.kind)} title={s.kind}></span>
                        <span>{s.name}</span>
                        {s.changeType && (
                            <span className="cockpit__badge" title={`${s.changeType} symbol`}>
                                {getChangeTypeBadge(s.changeType)}
                            </span>
                        )}
                        <span className="cockpit__dim">{s.kind || ''}</span>
                        <span className="cockpit__mono">{formatDate(s.lastChangedAt)}</span>
                    </div>
                    <div className="cockpit__message">{s.path}</div>
                    <div className="cockpit__actions">
                        <button
                            className="cockpit__button ghost small"
                            onClick={() => vscode.postMessage({ type: 'openSymbolHistory', symbolId: s.id })}
                        >
                            Open history
                        </button>
                        <button
                            className="cockpit__button ghost small"
                            onClick={() => vscode.postMessage({ type: 'openSymbolInEditor', symbolId: s.id })}
                        >
                            Open latest
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
};
