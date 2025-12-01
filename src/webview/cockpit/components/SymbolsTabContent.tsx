import * as React from 'react';
import { CockpitState, SymbolChangeType } from '../../../types/cockpit';
import { SymbolList } from './SymbolList';

interface SymbolsTabContentProps {
  state: CockpitState;
  vscode: any;
  updateSymbolFilterText: (text: string) => void;
  updateSymbolKind: (kind: string | 'all') => void;
  updateSymbolChangeFilter: (change: 'all' | SymbolChangeType) => void;
}

export const SymbolsTabContent: React.FC<SymbolsTabContentProps> = ({
  state,
  vscode,
  updateSymbolFilterText,
  updateSymbolKind,
  updateSymbolChangeFilter,
}) => {
  return (
    <div className="cockpit__tab-body">
      <div className="cockpit__actions">
        <input
          className="cockpit__input"
          placeholder="Search symbols..."
          value={state.symbolFilterText}
          onChange={e => updateSymbolFilterText(e.target.value)}
        />
        <select
          className="cockpit__input"
          value={state.symbolKindFilter}
          onChange={e => updateSymbolKind(e.target.value)}
        >
          <option value="all">All kinds</option>
          <option value="function">function</option>
          <option value="class">class</option>
          <option value="method">method</option>
          <option value="component">component</option>
        </select>
        <select
          className="cockpit__input"
          value={state.symbolChangeFilter}
          onChange={e => updateSymbolChangeFilter(e.target.value as 'all' | SymbolChangeType)}
        >
          <option value="all">All changes</option>
          <option value="added">added</option>
          <option value="modified">modified</option>
          <option value="removed">removed</option>
        </select>
      </div>
      <SymbolList state={state} vscode={vscode} />
    </div>
  );
};
