import React, { useState, useEffect } from 'react';
import { LlmAnalysis, AnalysisBlock, Claim, Action, EvidenceLink } from '../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../facts/types';
import { formatStats } from '../utils/statsFormatter';

/**
 * Props for the RefactorReportView component
 */
interface RefactorReportViewProps {
  analysis: LlmAnalysis;
  facts: RefactorBundleFacts;
  onEvidenceClick: (evidence: EvidenceLink) => void;
  onAction?: (action: string, data: any) => void;
}

/**
 * Main refactor report webview component with three-panel layout
 */
export const RefactorReportView: React.FC<RefactorReportViewProps> = ({ analysis, facts, onEvidenceClick, onAction }) => {
  const [selectedBlock, setSelectedBlock] = useState<AnalysisBlock | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceLink | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'facts'>('analysis');

  // Auto-select first block on load
  useEffect(() => {
    if (analysis.blocks.length > 0 && !selectedBlock) {
      setSelectedBlock(analysis.blocks[0]);
    }
  }, [analysis.blocks, selectedBlock]);

  return (
    <div className="refactor-report-container">
      {/* Header */}
          <div className="header">
            <h1>🤖 Refactor Intelligence Report</h1>
            <div className="header-meta">
              <span title={`Bundle: ${facts.bundle.shas.length} commits`}>Bundle: {facts.bundle.shas.length} commits</span>
              <span title={`Analysis: ${analysis.metadata.model}`} style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis'}}>Analysis: {analysis.metadata.model}</span>
              <span>Generated: {new Date(analysis.metadata.timestamp).toLocaleString()}</span>
              <span>Health: {(analysis.metadata.healthScore || 0).toFixed(0)}/100</span>
              <span>Tokens: {analysis.metadata.totalTokens?.toLocaleString() || 'n/a'}</span>
              {analysis.metadata.totalCalls !== undefined && (
                <span>Calls: {analysis.metadata.totalCalls}</span>
              )}
            </div>
          </div>

      {/* Three-Panel Layout */}
      <div className="three-panel-layout">
        {/* Left Sidebar - Navigation */}
        <div className="sidebar">
          <div className="sidebar-section">
            <h3>📊 Analysis Blocks</h3>
            <div className="block-list">
              {analysis.blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`block-item ${selectedBlock?.id === block.id ? 'active' : ''}`}
                  onClick={() => setSelectedBlock(block)}
                >
                  <div className="block-icon">{getBlockIcon(block.type)}</div>
                  <div className="block-info">
                    <div className="block-title">{block.title}</div>
                    <div className="block-stats">
                      {block.claims.length} claims, {block.actions.length} actions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>📈 Quick Stats</h3>
            <div className="stats-grid">
              {(() => {
                const stats = formatStats(facts);
                const hybridSummary = facts.hybridSummary;
                const counts = facts.evidenceSummary?.counts;
                return (
                  <>
                    <div className="stat-item">
                      <span className="stat-label">Missing</span>
                      <span className="stat-value">{stats.missing}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Zombies</span>
                      <span className="stat-value">{stats.zombies}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Dead Code</span>
                      <span className="stat-value">{stats.dead}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Replaced</span>
                      <span className="stat-value">{stats.replaced}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Hybrid Facts</span>
                      <span className="stat-value">{hybridSummary?.totalFacts ?? 0}</span>
                    </div>
                    {counts && (
                      <div className="stat-item">
                        <span className="stat-label">Hybrid Drifts</span>
                        <span className="stat-value">{counts.hybridDrifts}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>🔍 Evidence Browser</h3>
            <div className="evidence-list">
              {selectedBlock && (
                <>
                  {selectedBlock.claims.map((claim, index) => (
                    <div key={`claim-${index}`} className="evidence-group">
                      <div className="evidence-title">Claim {index + 1}</div>
                      {claim.evidence.map((evidence, evIndex) => (
                        <div
                          key={`claim-ev-${evIndex}`}
                          className={`evidence-item ${selectedEvidence === evidence ? 'active' : ''}`}
                          title={evidence.description}
                          onClick={() => {
                            setSelectedEvidence(evidence);
                            onEvidenceClick(evidence);
                          }}
                        >
                          {evidence.description.length > 100 
                            ? `${evidence.description.slice(0, 100)}...` 
                            : evidence.description}
                        </div>
                      ))}
                    </div>
                  ))}
                  {selectedBlock.actions.map((action, index) => (
                    <div key={`action-${index}`} className="evidence-group">
                      <div className="evidence-title">Action {index + 1}</div>
                      {action.evidence.map((evidence, evIndex) => (
                        <div
                          key={`action-ev-${evIndex}`}
                          className={`evidence-item ${selectedEvidence === evidence ? 'active' : ''}`}
                          title={evidence.description}
                          onClick={() => {
                            setSelectedEvidence(evidence);
                            onEvidenceClick(evidence);
                          }}
                        >
                          {evidence.description.length > 100 
                            ? `${evidence.description.slice(0, 100)}...` 
                            : evidence.description}
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Panel - Content */}
        <div className="main-panel">
          <div className="tab-bar">
            <button
              className={`tab ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              🤖 LLM Analysis
            </button>
            <button
              className={`tab ${activeTab === 'facts' ? 'active' : ''}`}
              onClick={() => setActiveTab('facts')}
            >
              📊 Raw Facts
            </button>
          </div>

          <div className="content-area">
            {activeTab === 'analysis' ? (
              <AnalysisContent
                block={selectedBlock}
                onEvidenceClick={onEvidenceClick}
              />
            ) : (
              <FactsContent
                facts={facts}
                onEvidenceClick={onEvidenceClick}
                onAction={onAction}
              />
            )}
          </div>
        </div>

        {/* Right Panel - JSON Inspector */}
        <div className="inspector-panel">
          <div className="inspector-header">
            <h3>🔍 JSON Inspector</h3>
          </div>

          <div className="inspector-content">
            {selectedEvidence ? (
              <div className="evidence-details">
                <h4>Evidence Details</h4>
                <div className="evidence-json">
                  <pre>{JSON.stringify(selectedEvidence, null, 2)}</pre>
                </div>
                <div className="evidence-actions">
                  <button onClick={() => onEvidenceClick(selectedEvidence)}>
                    📂 Open in Editor
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-selection">
                <p>Click on evidence in the sidebar to inspect JSON details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Analysis content component
 */
const AnalysisContent: React.FC<{
  block: AnalysisBlock | null;
  onEvidenceClick: (evidence: EvidenceLink) => void;
}> = ({ block, onEvidenceClick }) => {
  if (!block) {
    return (
      <div className="empty-state">
        <h2>Select an analysis block from the sidebar</h2>
        <p>Choose an analysis block to view detailed findings and recommendations.</p>
      </div>
    );
  }

  return (
    <div className="analysis-content">
      <div className="block-header">
        <h2>{getBlockIcon(block.type)} {block.title}</h2>
        <div className="block-meta">
          <span>Confidence: {(block.confidence * 100).toFixed(0)}%</span>
          <span>Generated: {new Date(block.timestamp).toLocaleString()}</span>
        </div>
      </div>

      {block.claims.length > 0 && (
        <div className="claims-section">
          <h3>🔍 Findings</h3>
          {block.claims.map((claim, index) => (
            <div key={index} className={`claim-item severity-${claim.severity}`}>
              <div className="claim-header">
                <span className="severity-icon">{getSeverityIcon(claim.severity)}</span>
                <span className="claim-text">{claim.text}</span>
                <span className="confidence">({(claim.confidence * 100).toFixed(0)}%)</span>
              </div>
              <div className="claim-evidence">
                {claim.evidence.map((evidence, evIndex) => (
                  <button
                    key={evIndex}
                    className="evidence-link"
                    onClick={() => onEvidenceClick(evidence)}
                  >
                    {evidence.description}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {block.actions.length > 0 && (
        <div className="actions-section">
          <h3>🛠️ Recommended Actions</h3>
          {block.actions.map((action, index) => (
            <div key={index} className="action-item">
              <div className="action-header">
                <span className="priority-icon">{getPriorityIcon(action.priority)}</span>
                <span className="action-text">{action.description}</span>
                <div className="action-meta">
                  <span className="effort">[{action.effort.toUpperCase()}]</span>
                  <span className="risk">Risk: {action.risk}</span>
                </div>
              </div>
              {action.dependsOn && action.dependsOn.length > 0 && (
                <div className="action-dependencies">
                  <strong>Depends on:</strong> {action.dependsOn.join(', ')}
                </div>
              )}
              <div className="action-evidence">
                {action.evidence.map((evidence, evIndex) => (
                  <button
                    key={evIndex}
                    className="evidence-link"
                    onClick={() => onEvidenceClick(evidence)}
                  >
                    {evidence.description}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Facts content component
 */
const FactsContent: React.FC<{
  facts: RefactorBundleFacts;
  onEvidenceClick: (evidence: EvidenceLink) => void;
  onAction?: (action: string, data: any) => void;
}> = ({ facts, onEvidenceClick, onAction }) => {
  const hybridSummary = facts.hybridSummary;
  const evidenceSummary = facts.evidenceSummary || {};
  const counts = evidenceSummary.counts || {};
  const caps = facts.llmCapsApplied;
  const movedLineage = facts.bundle.movedLineage || [];

  const missing = evidenceSummary.missing || [];
  const zombies = evidenceSummary.zombies || [];
  const divergent = evidenceSummary.divergent || [];

  return (
    <div className="facts-content">
      <div className="facts-summary">
        <h2>📊 Raw Facts Summary</h2>
        <div className="facts-grid">
          <div className="fact-card">
            <h4>Bundle Info</h4>
            <p><strong>Commits:</strong> {facts.bundle.shas.length}</p>
            <p><strong>Oldest:</strong> {facts.bundle.oldestSha.substring(0, 8)}</p>
          </div>
          <div className="fact-card">
            <h4>Analysis Scope</h4>
            <p><strong>Files:</strong> {facts.scope.files}</p>
            <p><strong>Blast Radius:</strong> {facts.scope.blastRadius}</p>
          </div>
          <div className="fact-card">
            <h4>Symbols</h4>
            <p><strong>Intended:</strong> {facts.intended.present + facts.intended.absent}</p>
            <p><strong>Working:</strong> {facts.working.symbols}</p>
            <p><strong>Edges:</strong> {facts.working.edges}</p>
          </div>
          {hybridSummary && (
            <div className="fact-card">
              <h4>Hybrid Facts</h4>
              <p><strong>Total:</strong> {hybridSummary.totalFacts}</p>
              <p><strong>Files:</strong> {hybridSummary.fileCount}</p>
              <p><strong>Top Files:</strong> {hybridSummary.topFiles.slice(0, 3).map(f => `${f.file} (${f.count})`).join(', ')}</p>
            </div>
          )}
          {caps && (
            <div className="fact-card">
              <h4>LLM Caps</h4>
              <p><strong>Missing:</strong> {caps.missing}</p>
              <p><strong>Zombies:</strong> {caps.zombies}</p>
              <p><strong>Hybrid Drifts:</strong> {caps.hybridDrifts}</p>
            </div>
          )}
        </div>
      </div>

        <div className="facts-lists">
          <h3>🚧 Incompleteness</h3>
          <div className="fact-list">
            <strong>Missing ({counts.missing ?? missing.length}):</strong>
            {missing.length === 0 ? <div className="muted">None</div> : (
              <ul>
                {missing.map((m: any, idx: number) => (
                  <li key={`miss-${idx}`}>{formatSymbolRef(m)}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="fact-list">
            <strong>Zombies ({counts.zombies ?? zombies.length}):</strong>
            {zombies.length === 0 ? <div className="muted">None</div> : (
              <ul>
                {zombies.map((z: any, idx: number) => (
                  <li key={`zomb-${idx}`} className="fact-item-row">
                    <span>{formatSymbolRef(z)}</span>
                    {onAction && (
                      <button
                        className="action-button small danger"
                        onClick={() => onAction('delete', {
                          symbolId: z.symbol_id,
                          filePath: z.file || (z.symbol_id && z.symbol_id.split(':')[0]),
                          range: z.loc || z.location // Ensure we have location
                        })}
                        title="Remove this symbol"
                      >
                        🗑️
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="fact-list">
            <strong>Divergent ({counts.divergent ?? divergent.length}):</strong>
            {divergent.length === 0 ? <div className="muted">None</div> : (
              <ul>
                {divergent.map((d: any, idx: number) => (
                  <li key={`div-${idx}`}>{formatSymbolRef(d)}</li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {hybridSummary && hybridSummary.sampleFacts?.length > 0 && (
        <div className="facts-lists">
          <h3>🧬 Hybrid Facts (samples)</h3>
          <ul>
            {hybridSummary.sampleFacts.map((f, idx) => (
              <li key={`hy-${idx}`}>
                <strong>{f.file}</strong>: {f.sample.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {movedLineage.length > 0 && (
        <div className="facts-lists">
          <h3>🚚 Moved Symbols</h3>
          <ul>
            {movedLineage.slice(0, 20).map((m, idx) => (
              <li key={`mv-${idx}`}>
                {(m as any).sourceName || m.previousSymbolId} → {(m as any).destName || m.symbolId} ({m.sourceVersion} → {m.destVersion})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="facts-json">
        <h3>🔧 Full Facts JSON</h3>
        <details>
          <summary>Expand raw facts (for debugging)</summary>
          <pre>{JSON.stringify(facts, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
};

/**
 * Helper functions for icons and styling
 */
function getBlockIcon(type: AnalysisBlock['type']): string {
  switch (type) {
    case 'intent': return '🎯';
    case 'drift': return '🔍';
    case 'cleanup': return '🧹';
    case 'summary': return '📊';
    default: return '📝';
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

function getPriorityIcon(priority: string): string {
  switch (priority) {
    case 'urgent': return '🚨';
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

function formatSymbolRef(entry: any): string {
  const sym = entry.symbol || entry.symbol_id || entry.symbolId || 'unknown';
  const file = entry.file || (entry.symbol_id && entry.symbol_id.split(':')[0]);
  if (file) {
    return `${file}:${sym}`;
  }
  return sym;
}
