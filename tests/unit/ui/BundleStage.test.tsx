/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BundleStage } from '../../../src/webview/cockpit/components/stages/BundleStage';

// Mock TreemapNode to avoid complex rendering
vi.mock('../../../src/webview/cockpit/components/stages/TreemapNode', () => ({
  TreemapNode: () => <div data-testid="treemap-node">Treemap Node</div>,
}));

describe('BundleStage', () => {
  const mockVscode = {
    postMessage: vi.fn(),
  };

  const defaultProps = {
    frame: { id: 'test', data: {} },
    onZoomIn: vi.fn(),
    cockpitState: {
      bundleConfig: {
        mode: 'repo',
        roots: [],
        includeConnected: false,
        exclusions: [],
      },
      lastNCommits: 20,
      isAnalyzing: false,
    } as any,
    vscode: mockVscode,
  };

  it('should render configuration toggle', () => {
    render(<BundleStage {...defaultProps} />);
    expect(screen.getByText(/Configure Scope/i)).toBeInTheDocument();
  });

  it('should update config and submit analysis', () => {
    render(<BundleStage {...defaultProps} />);

    const configToggle = screen.getByText(/Configure Scope/i);
    fireEvent.click(configToggle);

    const modeSelect = screen.getByRole('combobox');
    fireEvent.change(modeSelect, { target: { value: 'custom' } });

    const rootsInput = screen.getByPlaceholderText('src/auth, utils.ts');
    fireEvent.change(rootsInput, { target: { value: 'src/test' } });

    const applyButton = screen.getByText('Apply Scope');
    fireEvent.click(applyButton);

    expect(mockVscode.postMessage).toHaveBeenCalledWith({
      type: 'updateBundleConfig',
      config: expect.objectContaining({
        mode: 'custom',
        roots: ['src/test'],
      }),
    });
    expect(mockVscode.postMessage).toHaveBeenCalledWith({
      type: 'setLastNCommits',
      value: 20,
    });
  });

  it('should show analyzing state', () => {
    const props = {
      ...defaultProps,
      cockpitState: {
        ...defaultProps.cockpitState,
        isAnalyzing: true,
      },
    };
    render(<BundleStage {...props} />);

    const configToggle = screen.getByText(/Configure Scope/i);
    fireEvent.click(configToggle);

    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
  });
});
