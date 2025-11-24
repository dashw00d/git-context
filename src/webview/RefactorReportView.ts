import { LlmAnalysis, AnalysisBlock, Claim, Action, EvidenceLink } from '../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../facts/types';

/**
 * Main refactor report webview with three-panel layout
 */
export class RefactorReportView {
  private analysis: LlmAnalysis;
  private facts: RefactorBundleFacts;
  private onEvidenceClick: (evidence: EvidenceLink) => void;
  private selectedBlock: AnalysisBlock | null = null;
  private selectedEvidence: EvidenceLink | null = null;
  private activeTab: 'analysis' | 'facts' = 'analysis';
  private container: any;

  constructor(
    container: HTMLElement,
    analysis: LlmAnalysis,
    facts: RefactorBundleFacts,
    onEvidenceClick: (evidence: EvidenceLink) => void
  ) {
    this.container = container;
    this.analysis = analysis;
    this.facts = facts;
    this.onEvidenceClick = onEvidenceClick;

    // Auto-select first block
    if (this.analysis.blocks.length > 0) {
      this.selectedBlock = this.analysis.blocks[0];
    }

    this.render();
  }

  /**
   * Render the complete UI
   */
  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'refactor-report-container';

    // Header
    const header = this.createHeader();
    this.container.appendChild(header);

    // Three-panel layout
    const layout = this.createThreePanelLayout();
    this.container.appendChild(layout);
  }

  /**
   * Create header section
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('h1');
    title.textContent = '🤖 Refactor Intelligence Report';
    header.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'header-meta';

    const span1 = document.createElement('span');
    span1.textContent = `Bundle: ${this.facts.bundle.shas.length} commits`;
    meta.appendChild(span1);

    const span2 = document.createElement('span');
    span2.textContent = `Analysis: ${this.analysis.metadata.model}`;
    meta.appendChild(span2);

    const span3 = document.createElement('span');
    span3.textContent = `Generated: ${new Date(this.analysis.metadata.timestamp).toLocaleString()}`;
    meta.appendChild(span3);
    header.appendChild(meta);

    return header;
  }

  /**
   * Create three-panel layout
   */
  private createThreePanelLayout(): HTMLElement {
    const layout = document.createElement('div');
    layout.className = 'three-panel-layout';

    // Sidebar
    const sidebar = this.createSidebar();
    layout.appendChild(sidebar);

    // Main panel
    const mainPanel = this.createMainPanel();
    layout.appendChild(mainPanel);

    // Inspector panel
    const inspector = this.createInspectorPanel();
    layout.appendChild(inspector);

    return layout;
  }

  /**
   * Create sidebar with navigation
   */
  private createSidebar(): HTMLElement {
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';

    // Analysis blocks section
    const blocksSection = document.createElement('div');
    blocksSection.className = 'sidebar-section';

    const blocksTitle = document.createElement('h3');
    blocksTitle.textContent = '📊 Analysis Blocks';
    blocksSection.appendChild(blocksTitle);

    const blockList = document.createElement('div');
    blockList.className = 'block-list';

    this.analysis.blocks.forEach((block, index) => {
      const blockItem = document.createElement('div');
      blockItem.className = `block-item ${this.selectedBlock?.id === block.id ? 'active' : ''}`;
      blockItem.onclick = () => {
        this.selectedBlock = block;
        this.render();
      };

      const icon = document.createElement('div');
      icon.className = 'block-icon';
      icon.textContent = this.getBlockIcon(block.type);
      blockItem.appendChild(icon);

      const info = document.createElement('div');
      info.className = 'block-info';

      const title = document.createElement('div');
      title.className = 'block-title';
      title.textContent = block.title;
      info.appendChild(title);

      const stats = document.createElement('div');
      stats.className = 'block-stats';
      stats.textContent = `${block.claims.length} claims, ${block.actions.length} actions`;
      info.appendChild(stats);

      blockItem.appendChild(info);
      blockList.appendChild(blockItem);
    });

    blocksSection.appendChild(blockList);
    sidebar.appendChild(blocksSection);

    // Quick stats section
    const statsSection = document.createElement('div');
    statsSection.className = 'sidebar-section';

    const statsTitle = document.createElement('h3');
    statsTitle.textContent = '📈 Quick Stats';
    statsSection.appendChild(statsTitle);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    // Missing stat
    const missingItem = document.createElement('div');
    missingItem.className = 'stat-item';
    const missingLabel = document.createElement('span');
    missingLabel.className = 'stat-label';
    missingLabel.textContent = 'Missing';
    missingItem.appendChild(missingLabel);
    const missingValue = document.createElement('span');
    missingValue.className = 'stat-value';
    missingValue.textContent = this.facts.findings.incompleteness.missing.toString();
    missingItem.appendChild(missingValue);
    statsGrid.appendChild(missingItem);

    // Zombies stat
    const zombiesItem = document.createElement('div');
    zombiesItem.className = 'stat-item';
    const zombiesLabel = document.createElement('span');
    zombiesLabel.className = 'stat-label';
    zombiesLabel.textContent = 'Zombies';
    zombiesItem.appendChild(zombiesLabel);
    const zombiesValue = document.createElement('span');
    zombiesValue.className = 'stat-value';
    zombiesValue.textContent = this.facts.findings.incompleteness.zombies.toString();
    zombiesItem.appendChild(zombiesValue);
    statsGrid.appendChild(zombiesItem);

    // Dead Code stat
    const deadItem = document.createElement('div');
    deadItem.className = 'stat-item';
    const deadLabel = document.createElement('span');
    deadLabel.className = 'stat-label';
    deadLabel.textContent = 'Dead Code';
    deadItem.appendChild(deadLabel);
    const deadValue = document.createElement('span');
    deadValue.className = 'stat-value';
    deadValue.textContent = this.facts.findings.legacyAudit.dead.toString();
    deadItem.appendChild(deadValue);
    statsGrid.appendChild(deadItem);

    // Replaced stat
    const replacedItem = document.createElement('div');
    replacedItem.className = 'stat-item';
    const replacedLabel = document.createElement('span');
    replacedLabel.className = 'stat-label';
    replacedLabel.textContent = 'Replaced';
    replacedItem.appendChild(replacedLabel);
    const replacedValue = document.createElement('span');
    replacedValue.className = 'stat-value';
    replacedValue.textContent = this.facts.findings.legacyAudit.replacedLeftovers.length.toString();
    replacedItem.appendChild(replacedValue);
    statsGrid.appendChild(replacedItem);
    statsSection.appendChild(statsGrid);
    sidebar.appendChild(statsSection);

    // Evidence browser section
    if (this.selectedBlock) {
      const evidenceSection = document.createElement('div');
      evidenceSection.className = 'sidebar-section';

      const evidenceTitle = document.createElement('h3');
      evidenceTitle.textContent = '🔍 Evidence Browser';
      evidenceSection.appendChild(evidenceTitle);

      const evidenceList = document.createElement('div');
      evidenceList.className = 'evidence-list';

      // Claims evidence
      this.selectedBlock.claims.forEach((claim, index) => {
        const group = document.createElement('div');
        group.className = 'evidence-group';

        const title = document.createElement('div');
        title.className = 'evidence-title';
        title.textContent = `Claim ${index + 1}`;
        group.appendChild(title);

        claim.evidence.forEach((evidence, evIndex) => {
          const item = document.createElement('div');
          item.className = `evidence-item ${this.selectedEvidence === evidence ? 'active' : ''}`;
          item.textContent = evidence.description;
          item.onclick = () => {
            this.selectedEvidence = evidence;
            this.onEvidenceClick(evidence);
            this.render();
          };
          group.appendChild(item);
        });

        evidenceList.appendChild(group);
      });

      // Actions evidence
      this.selectedBlock.actions.forEach((action, index) => {
        const group = document.createElement('div');
        group.className = 'evidence-group';

        const title = document.createElement('div');
        title.className = 'evidence-title';
        title.textContent = `Action ${index + 1}`;
        group.appendChild(title);

        action.evidence.forEach((evidence, evIndex) => {
          const item = document.createElement('div');
          item.className = `evidence-item ${this.selectedEvidence === evidence ? 'active' : ''}`;
          item.textContent = evidence.description;
          item.onclick = () => {
            this.selectedEvidence = evidence;
            this.onEvidenceClick(evidence);
            this.render();
          };
          group.appendChild(item);
        });

        evidenceList.appendChild(group);
      });

      evidenceSection.appendChild(evidenceList);
      sidebar.appendChild(evidenceSection);
    }

    return sidebar;
  }

  /**
   * Create main panel with content
   */
  private createMainPanel(): HTMLElement {
    const mainPanel = document.createElement('div');
    mainPanel.className = 'main-panel';

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-bar';

    const analysisTab = document.createElement('button');
    analysisTab.className = `tab ${this.activeTab === 'analysis' ? 'active' : ''}`;
    analysisTab.textContent = '🤖 LLM Analysis';
    analysisTab.onclick = () => {
      this.activeTab = 'analysis';
      this.render();
    };
    tabBar.appendChild(analysisTab);

    const factsTab = document.createElement('button');
    factsTab.className = `tab ${this.activeTab === 'facts' ? 'active' : ''}`;
    factsTab.textContent = '📊 Raw Facts';
    factsTab.onclick = () => {
      this.activeTab = 'facts';
      this.render();
    };
    tabBar.appendChild(factsTab);

    mainPanel.appendChild(tabBar);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.className = 'content-area';

    if (this.activeTab === 'analysis') {
      contentArea.appendChild(this.createAnalysisContent());
    } else {
      contentArea.appendChild(this.createFactsContent());
    }

    mainPanel.appendChild(contentArea);

    return mainPanel;
  }

  /**
   * Create analysis content
   */
  private createAnalysisContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'analysis-content';

    if (!this.selectedBlock) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';

      const emptyH2 = document.createElement('h2');
      emptyH2.textContent = 'Select an analysis block from the sidebar';
      empty.appendChild(emptyH2);

      const emptyP = document.createElement('p');
      emptyP.textContent = 'Choose an analysis block to view detailed findings and recommendations.';
      empty.appendChild(emptyP);
      content.appendChild(empty);
      return content;
    }

    // Block header
    const header = document.createElement('div');
    header.className = 'block-header';

    const title = document.createElement('h2');
    title.textContent = `${this.getBlockIcon(this.selectedBlock.type)} ${this.selectedBlock.title}`;
    header.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'block-meta';

    const confidenceSpan = document.createElement('span');
    confidenceSpan.textContent = `Confidence: ${(this.selectedBlock.confidence * 100).toFixed(0)}%`;
    meta.appendChild(confidenceSpan);

    const generatedSpan = document.createElement('span');
    generatedSpan.textContent = `Generated: ${new Date(this.selectedBlock.timestamp).toLocaleString()}`;
    meta.appendChild(generatedSpan);
    header.appendChild(meta);

    content.appendChild(header);

    // Claims section
    if (this.selectedBlock.claims.length > 0) {
      const claimsSection = document.createElement('div');
      claimsSection.className = 'claims-section';

      const claimsTitle = document.createElement('h3');
      claimsTitle.textContent = '🔍 Findings';
      claimsSection.appendChild(claimsTitle);

      this.selectedBlock.claims.forEach((claim, index) => {
        const claimItem = document.createElement('div');
        claimItem.className = `claim-item severity-${claim.severity}`;

        const header = document.createElement('div');
        header.className = 'claim-header';

        const icon = document.createElement('span');
        icon.className = 'severity-icon';
        icon.textContent = this.getSeverityIcon(claim.severity);
        header.appendChild(icon);

        const text = document.createElement('span');
        text.className = 'claim-text';
        text.textContent = claim.text;
        header.appendChild(text);

        const confidence = document.createElement('span');
        confidence.className = 'confidence';
        confidence.textContent = `(${(claim.confidence * 100).toFixed(0)}%)`;
        header.appendChild(confidence);

        claimItem.appendChild(header);

        // Evidence
        const evidenceDiv = document.createElement('div');
        evidenceDiv.className = 'claim-evidence';
        claim.evidence.forEach((evidence) => {
          const link = document.createElement('button');
          link.className = 'evidence-link';
          link.textContent = evidence.description;
          link.onclick = () => this.onEvidenceClick(evidence);
          evidenceDiv.appendChild(link);
        });
        claimItem.appendChild(evidenceDiv);

        claimsSection.appendChild(claimItem);
      });

      content.appendChild(claimsSection);
    }

    // Actions section
    if (this.selectedBlock.actions.length > 0) {
      const actionsSection = document.createElement('div');
      actionsSection.className = 'actions-section';

      const actionsTitle = document.createElement('h3');
      actionsTitle.textContent = '🛠️ Recommended Actions';
      actionsSection.appendChild(actionsTitle);

      this.selectedBlock.actions.forEach((action, index) => {
        const actionItem = document.createElement('div');
        actionItem.className = 'action-item';

        const header = document.createElement('div');
        header.className = 'action-header';

        const icon = document.createElement('span');
        icon.className = 'priority-icon';
        icon.textContent = this.getPriorityIcon(action.priority);
        header.appendChild(icon);

        const text = document.createElement('span');
        text.className = 'action-text';
        text.textContent = action.description;
        header.appendChild(text);

        const meta = document.createElement('div');
        meta.className = 'action-meta';

        const effortSpan = document.createElement('span');
        effortSpan.className = 'effort';
        effortSpan.textContent = `[${action.effort.toUpperCase()}]`;
        meta.appendChild(effortSpan);

        const riskSpan = document.createElement('span');
        riskSpan.className = 'risk';
        riskSpan.textContent = `Risk: ${action.risk}`;
        meta.appendChild(riskSpan);
        header.appendChild(meta);

        actionItem.appendChild(header);

        if (action.dependsOn && action.dependsOn.length > 0) {
          const deps = document.createElement('div');
          deps.className = 'action-dependencies';
          const strong = document.createElement('strong');
          strong.textContent = 'Depends on: ';
          deps.appendChild(strong);
          deps.appendChild(document.createTextNode(action.dependsOn.join(', ')));
          actionItem.appendChild(deps);
        }

        // Evidence
        const evidenceDiv = document.createElement('div');
        evidenceDiv.className = 'action-evidence';
        action.evidence.forEach((evidence) => {
          const link = document.createElement('button');
          link.className = 'evidence-link';
          link.textContent = evidence.description;
          link.onclick = () => this.onEvidenceClick(evidence);
          evidenceDiv.appendChild(link);
        });
        actionItem.appendChild(evidenceDiv);

        actionsSection.appendChild(actionItem);
      });

      content.appendChild(actionsSection);
    }

    return content;
  }

  /**
   * Create facts content
   */
  private createFactsContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'facts-content';

    // Summary
    const summary = document.createElement('div');
    summary.className = 'facts-summary';

    const title = document.createElement('h2');
    title.textContent = '📊 Raw Facts Summary';
    summary.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'facts-grid';

    // Bundle Info Card
    const bundleCard = document.createElement('div');
    bundleCard.className = 'fact-card';
    const bundleTitle = document.createElement('h4');
    bundleTitle.textContent = 'Bundle Info';
    bundleCard.appendChild(bundleTitle);
    const bundleP1 = document.createElement('p');
    bundleP1.innerHTML = `<strong>Commits:</strong> ${this.facts.bundle.shas.length}`;
    bundleCard.appendChild(bundleP1);
    const bundleP2 = document.createElement('p');
    bundleP2.innerHTML = `<strong>Oldest:</strong> ${this.facts.bundle.oldestSha.substring(0, 8)}`;
    bundleCard.appendChild(bundleP2);
    grid.appendChild(bundleCard);

    // Analysis Scope Card
    const scopeCard = document.createElement('div');
    scopeCard.className = 'fact-card';
    const scopeTitle = document.createElement('h4');
    scopeTitle.textContent = 'Analysis Scope';
    scopeCard.appendChild(scopeTitle);
    const scopeP1 = document.createElement('p');
    scopeP1.innerHTML = `<strong>Files:</strong> ${this.facts.scope.files}`;
    scopeCard.appendChild(scopeP1);
    const scopeP2 = document.createElement('p');
    scopeP2.innerHTML = `<strong>Blast Radius:</strong> ${this.facts.scope.blastRadius}`;
    scopeCard.appendChild(scopeP2);
    grid.appendChild(scopeCard);

    // Symbols Card
    const symbolsCard = document.createElement('div');
    symbolsCard.className = 'fact-card';
    const symbolsTitle = document.createElement('h4');
    symbolsTitle.textContent = 'Symbols';
    symbolsCard.appendChild(symbolsTitle);
    const symbolsP1 = document.createElement('p');
    symbolsP1.innerHTML = `<strong>Intended:</strong> ${this.facts.intended.present + this.facts.intended.absent}`;
    symbolsCard.appendChild(symbolsP1);
    const symbolsP2 = document.createElement('p');
    symbolsP2.innerHTML = `<strong>Working:</strong> ${this.facts.working.symbols}`;
    symbolsCard.appendChild(symbolsP2);
    const symbolsP3 = document.createElement('p');
    symbolsP3.innerHTML = `<strong>Edges:</strong> ${this.facts.working.edges}`;
    symbolsCard.appendChild(symbolsP3);
    grid.appendChild(symbolsCard);
    summary.appendChild(grid);
    content.appendChild(summary);

    // JSON view
    const jsonSection = document.createElement('div');
    jsonSection.className = 'facts-json';

    const jsonTitle = document.createElement('h3');
    jsonTitle.textContent = '🔧 Full Facts JSON';
    jsonSection.appendChild(jsonTitle);

    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(this.facts, null, 2);
    jsonSection.appendChild(pre);

    content.appendChild(jsonSection);

    return content;
  }

  /**
   * Create inspector panel
   */
  private createInspectorPanel(): HTMLElement {
    const inspector = document.createElement('div');
    inspector.className = 'inspector-panel';

    const header = document.createElement('div');
    header.className = 'inspector-header';

    const title = document.createElement('h3');
    title.textContent = '🔍 JSON Inspector';
    header.appendChild(title);

    inspector.appendChild(header);

    const content = document.createElement('div');
    content.className = 'inspector-content';

    if (this.selectedEvidence) {
      const details = document.createElement('div');
      details.className = 'evidence-details';

      const detailsTitle = document.createElement('h4');
      detailsTitle.textContent = 'Evidence Details';
      details.appendChild(detailsTitle);

      const jsonDiv = document.createElement('div');
      jsonDiv.className = 'evidence-json';
      const jsonPre = document.createElement('pre');
      jsonPre.textContent = JSON.stringify(this.selectedEvidence, null, 2);
      jsonDiv.appendChild(jsonPre);
      details.appendChild(jsonDiv);

      const actions = document.createElement('div');
      actions.className = 'evidence-actions';
      const button = document.createElement('button');
      button.textContent = '📂 Open in Editor';
      button.onclick = () => this.onEvidenceClick(this.selectedEvidence!);
      actions.appendChild(button);
      details.appendChild(actions);

      content.appendChild(details);
    } else {
      const empty = document.createElement('div');
      empty.className = 'no-selection';
      const p = document.createElement('p');
      p.textContent = 'Click on evidence in the sidebar to inspect JSON details';
      empty.appendChild(p);
      content.appendChild(empty);
    }

    inspector.appendChild(content);

    return inspector;
  }

  /**
   * Helper functions
   */
  private getBlockIcon(type: AnalysisBlock['type']): string {
    switch (type) {
      case 'intent': return '🎯';
      case 'drift': return '🔍';
      case 'cleanup': return '🧹';
      case 'summary': return '📊';
      default: return '📝';
    }
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  private getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }
}
