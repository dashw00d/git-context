/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { Stage } from '../../../src/webview/cockpit/components/Stage';
import { ZoomLevel, AnalysisStatus } from '../../../src/types/cockpit';

// Mock sub-stages
vi.mock('../../../src/webview/cockpit/components/stages/BundleStage', () => ({
  BundleStage: () => <div data-testid="bundle-stage">Bundle Stage</div>
}));
vi.mock('../../../src/webview/cockpit/components/stages/BlastRadiusStage', () => ({
  BlastRadiusStage: () => <div data-testid="blast-radius-stage">Blast Radius Stage</div>
}));
vi.mock('../../../src/webview/cockpit/components/stages/FileStage', () => ({
  FileStage: () => <div data-testid="file-stage">File Stage</div>
}));
vi.mock('../../../src/webview/cockpit/components/stages/SymbolStage', () => ({
  SymbolStage: () => <div data-testid="symbol-stage">Symbol Stage</div>
}));
vi.mock('../../../src/webview/cockpit/components/stages/ReportsStage', () => ({
  ReportsStage: () => <div data-testid="reports-stage">Reports Stage</div>
}));

describe('Stage Component', () => {
  const mockFrame = {
    id: 'test-frame',
    name: 'Test Frame',
    level: 'bundle' as ZoomLevel,
    status: 'ready' as AnalysisStatus,
    data: {},
    timestamp: Date.now()
  };

  const defaultProps = {
    frame: mockFrame,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onSelect: vi.fn(),
    cockpitState: {} as any,
    vscode: {} as any
  };

  it('should render BundleStage when level is bundle', () => {
    render(<Stage {...defaultProps} />);
    expect(screen.getByTestId('bundle-stage')).toBeInTheDocument();
  });

  it('should render BlastRadiusStage when level is blast_radius', () => {
    const props = {
      ...defaultProps,
      frame: { ...mockFrame, level: 'blast_radius' as ZoomLevel }
    };
    render(<Stage {...props} />);
    expect(screen.getByTestId('blast-radius-stage')).toBeInTheDocument();
  });
});
