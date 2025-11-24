import { LlmAnalysis, AnalysisBlock, Claim, Action, EvidenceLink } from '../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../facts/types';

/**
 * Props for the RefactorReportView component
 */
interface RefactorReportViewProps {
  analysis: LlmAnalysis;
  facts: RefactorBundleFacts;
  onEvidenceClick: (evidence: EvidenceLink) => void;
}

/**
 * Main refactor report webview component with three-panel layout
 */
export class RefactorReportView {
  private analysis: LlmAnalysis;
  private facts: RefactorBundleFacts;
  private onEvidenceClick: (evidence: EvidenceLink) => void;
  private selectedBlock: AnalysisBlock | null = null;
  private selectedEvidence: EvidenceLink | null = null;
  private activeTab: 'analysis' | 'facts' = 'analysis';

  constructor(props: RefactorReportViewProps) {
    this.analysis = props.analysis;
    this.facts = props.facts;
    this.onEvidenceClick = props.onEvidenceClick;

    // Auto-select first block
    if (this.analysis.blocks.length > 0) {
      this.selectedBlock = this.analysis.blocks[0];
    }
  }
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
          <span>Bundle: {facts.bundle.shas.length} commits</span>
          <span>Analysis: {analysis.metadata.model}</span>
          <span>Generated: {new Date(analysis.metadata.timestamp).toLocaleString()}</span>
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
              <div className="stat-item">
                <span className="stat-label">Missing</span>
                <span className="stat-value">{facts.findings.incompleteness.missing}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Zombies</span>
                <span className="stat-value">{facts.findings.incompleteness.zombies}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Dead Code</span>
                <span className="stat-value">{facts.findings.legacyAudit.dead}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Replaced</span>
                <span className="stat-value">{facts.findings.legacyAudit.replacedLeftovers.length}</span>
              </div>
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
                          onClick={() => {
                            setSelectedEvidence(evidence);
                            onEvidenceClick(evidence);
                          }}
                        >
                          {evidence.description}
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
                          onClick={() => {
                            setSelectedEvidence(evidence);
                            onEvidenceClick(evidence);
                          }}
                        >
                          {evidence.description}
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
}> = ({ facts, onEvidenceClick }) => {
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
        </div>
      </div>

      <div className="facts-json">
        <h3>🔧 Full Facts JSON</h3>
        <pre>{JSON.stringify(facts, null, 2)}</pre>
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
