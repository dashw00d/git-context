/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { BundleStage } from '../../../src/webview/cockpit/components/stages/BundleStage';

// Mock TreemapNode to avoid complex rendering
vi.mock('../../../src/webview/cockpit/components/stages/TreemapNode', () => ({
  TreemapNode: () => <div data-testid="treemap-node">Treemap Node</div>
}));

describe('BundleStage', () => {
  const mockVscode = {
    postMessage: vi.fn()
  };

  const defaultProps = {
    frame: { id: 'test', data: {} },
    onZoomIn: vi.fn(),
    cockpitState: {
      bundleConfig: {
        mode: 'repo',
        roots: [],
        includeConnected: false,
        exclusions: []
      },
      lastNCommits: 20,
      isAnalyzing: false
    } as any,
    vscode: mockVscode
  };

  it('should render configuration toggle', () => {
    render(<BundleStage {...defaultProps} />);
    expect(screen.getByText(/Configure Scope/i)).toBeInTheDocument();
  });

  it('should update config and submit analysis', () => {
    render(<BundleStage {...defaultProps} />);

    // Open configuration
    const configToggle = screen.getByText(/Configure Scope/i);
    fireEvent.click(configToggle);

    // Change mode to custom
    const modeSelect = screen.getByRole('combobox');
    fireEvent.change(modeSelect, { target: { value: 'custom' } });

    // Enter custom roots
    const rootsInput = screen.getByPlaceholderText('src/auth, utils.ts');
    fireEvent.change(rootsInput, { target: { value: 'src/test' } });

    // Click Apply & Analyze
    const applyButton = screen.getByText('Apply & Analyze');
    fireEvent.click(applyButton);

    expect(mockVscode.postMessage).toHaveBeenCalledWith({
      type: 'updateBundleConfig',
      config: expect.objectContaining({
        mode: 'custom',
        roots: ['src/test']
      })
    });
    expect(mockVscode.postMessage).toHaveBeenCalledWith({
      type: 'generateReport',
      mode: 'selection',
      force: true
    });
  });

  it('should show analyzing state', () => {
    const props = {
      ...defaultProps,
      cockpitState: {
        ...defaultProps.cockpitState,
        isAnalyzing: true
      }
    };
    render(<BundleStage {...props} />);
    
    // Open configuration to see the button
    const configToggle = screen.getByText(/Configure Scope/i);
    fireEvent.click(configToggle);

    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
  });
});
