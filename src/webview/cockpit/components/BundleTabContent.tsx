import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';
import { ExpandableSection } from './ExpandableSection';

interface BundleTabContentProps {
  state: CockpitState;
  vscode: any;
  formatDate: (date?: string | null) => string;
}

export const BundleTabContent: React.FC<BundleTabContentProps> = ({
  state,
  vscode,
  formatDate,
}) => {
  const facts = state.bundleFacts;

  if (!facts || facts.scope.files === 0) {
    return (
      <div className="cockpit__tab-body">
        <div className="cockpit__warning" style={{ padding: '20px', textAlign: 'center' }}>
          {state.analysisStep ? (
            <div>
              <span className="codicon codicon-loading spin" /> {state.analysisStep}
            </div>
          ) : (
            <>
              <div style={{ fontSize: '32px', opacity: 0.3 }}>📭</div>
              <div style={{ marginTop: '12px' }}>No symbols indexed</div>
              <div style={{ marginTop: '8px', color: '#8a8f98' }}>
                CLI: ct analyze {state.bundleFacts?.bundle?.shas[0]?.slice(0, 8)}...
              </div>
            </>
          )}
          <button
            className="cockpit__button primary"
            onClick={() => vscode.postMessage({ type: 'bundleRegenerate' })}
          >
            Reanalyze
          </button>
        </div>
      </div>
    );
  }

  const evidence = facts.evidence || {};
  const findings = facts.findings;

  // Get evidence arrays
  const missingEvidence = evidence['findings.incompleteness']?.missing || [];
  const zombiesEvidence = evidence['findings.incompleteness']?.zombies || [];
  const deadEvidence = evidence['findings.legacyAudit']?.dead || [];
  const driftEvidence = evidence['findings.patternDrift.conventionDrift']?.driftSymbols || [];
  const legacyUsedEvidence = evidence['findings.legacyAudit']?.legacyUsed || [];
  const replacedEvidence = findings?.legacyAudit?.replacedLeftovers || [];

  return (
    <div className="cockpit__tab-body">
      {/* Bundle summary */}
      <div className="cockpit__message">
        {state.bundleSummary ? (
          <>
            <div>Commits: {state.bundleSummary.commitCount}</div>
            <div>Files: {state.bundleSummary.fileCount}</div>
            <div>Symbols: {state.bundleSummary.symbolCount}</div>
            <div>Created: {formatDate(state.bundleSummary.createdAt || '')}</div>
          </>
        ) : (
          'No active bundle yet'
        )}
      </div>

      {/* Action buttons */}
      <div className="cockpit__actions">
        <button
          className="cockpit__button ghost"
          onClick={() => vscode.postMessage({ type: 'bundleRegenerate' })}
        >
          Regenerate
        </button>
        <button
          className="cockpit__button ghost"
          onClick={() => vscode.postMessage({ type: 'bundleExport' })}
        >
          Export JSON
        </button>
        <button
          className="cockpit__button ghost"
          onClick={() => vscode.postMessage({ type: 'openSuperReport' })}
        >
          Super Report
        </button>
        <button
          className="cockpit__button ghost"
          onClick={() => vscode.postMessage({ type: 'openActiveReport' })}
        >
          Open full report
        </button>
        <button
          className="cockpit__button ghost"
          onClick={() => vscode.postMessage({ type: 'bundleClear' })}
        >
          Clear bundle
        </button>
        {state.isAnalyzing && (
          <button
            className="cockpit__button ghost danger"
            onClick={() => vscode.postMessage({ type: 'cancelAnalysis' })}
          >
            Cancel analysis
          </button>
        )}
      </div>

      {/* Quick links */}
      {state.bundleSummary && (
        <div className="cockpit__actions">
          <span className="cockpit__dim">Quick links:</span>
          <button
            className="cockpit__button ghost small"
            onClick={() =>
              vscode.postMessage({ type: 'scrollReportToSection', sectionId: 'overview' })
            }
          >
            Overview
          </button>
          <button
            className="cockpit__button ghost small"
            onClick={() =>
              vscode.postMessage({ type: 'scrollReportToSection', sectionId: 'incompleteness' })
            }
          >
            Incompleteness
          </button>
          <button
            className="cockpit__button ghost small"
            onClick={() =>
              vscode.postMessage({ type: 'scrollReportToSection', sectionId: 'drift' })
            }
          >
            Drift
          </button>
          <button
            className="cockpit__button ghost small"
            onClick={() =>
              vscode.postMessage({ type: 'scrollReportToSection', sectionId: 'legacy' })
            }
          >
            Legacy
          </button>
          <button
            className="cockpit__button ghost small"
            onClick={() =>
              vscode.postMessage({ type: 'scrollReportToSection', sectionId: 'timeline' })
            }
          >
            Timeline
          </button>
        </div>
      )}

      {/* Evidence sections - all start collapsed */}
      <ExpandableSection title="Missing Symbols" count={missingEvidence.length} variant="critical">
        {missingEvidence.map((item: any, i: number) => (
          <div key={i} className="cockpit__evidence-item">
            <div className="cockpit__mono">{item.symbol_id}</div>
            <div className="cockpit__dim">Expected but not found</div>
          </div>
        ))}
      </ExpandableSection>

      <ExpandableSection title="Zombie Symbols" count={zombiesEvidence.length} variant="critical">
        {zombiesEvidence.map((item: any, i: number) => (
          <div key={i} className="cockpit__evidence-item">
            <div className="cockpit__mono">{item.symbol_id}</div>
            <div className="cockpit__dim">
              {item.found?.name} ({item.found?.kind})
            </div>
          </div>
        ))}
      </ExpandableSection>

      <ExpandableSection title="Dead Code Paths" count={deadEvidence.length} variant="critical">
        {deadEvidence.map((item: any, i: number) => (
          <div
            key={i}
            className="cockpit__evidence-item cockpit__evidence-item--clickable"
            onClick={() =>
              vscode.postMessage({
                type: 'openEvidence',
                evidenceId: item.symbol_id,
              })
            }
          >
            <div className="cockpit__mono">{item.name}</div>
            <div className="cockpit__dim">{item.kind} • No incoming edges</div>
          </div>
        ))}
      </ExpandableSection>

      <ExpandableSection title="Convention Drift" count={driftEvidence.length} variant="warning">
        {driftEvidence.map((item: any, i: number) => (
          <div key={i} className="cockpit__evidence-item">
            <div className="cockpit__mono">
              {item.name} → {item.suggestedName}
            </div>
            <div className="cockpit__dim">{item.path}</div>
            <div className="cockpit__dim">Convention: {item.convention}</div>
          </div>
        ))}
      </ExpandableSection>

      <ExpandableSection
        title="Legacy References"
        count={legacyUsedEvidence.length}
        variant="warning"
      >
        {legacyUsedEvidence.map((item: any, i: number) => (
          <div key={i} className="cockpit__evidence-item">
            <div className="cockpit__mono">{item.name}</div>
            <div className="cockpit__dim">{item.kind}</div>
          </div>
        ))}
      </ExpandableSection>

      <ExpandableSection
        title="Replacement Leftovers"
        count={replacedEvidence.length}
        variant="warning"
      >
        {replacedEvidence.map((item: any, i: number) => (
          <div key={i} className="cockpit__evidence-item">
            <div className="cockpit__mono">
              {item.old} → {item.new}
            </div>
            <div className="cockpit__dim">Confidence: {Math.round(item.confidence * 100)}%</div>
          </div>
        ))}
      </ExpandableSection>
    </div>
  );
};
