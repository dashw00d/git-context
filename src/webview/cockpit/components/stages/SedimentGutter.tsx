import * as React from 'react';

interface SedimentGutterProps {
  lineCount: number;
  // In a real implementation, this would take a map of line -> timestamp
  // For now, we'll simulate it or accept a simplified prop
  timestamps?: number[]; 
  currentTimeFilter?: number;
}

const GutterContainer: React.CSSProperties = {
  width: '12px',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  borderRight: '1px solid var(--vscode-editor-lineHighlightBorder)',
  backgroundColor: 'var(--vscode-editor-background)',
};

export const SedimentGutter: React.FC<SedimentGutterProps> = ({ lineCount, timestamps, currentTimeFilter }) => {
  // Mock data generator if no timestamps provided
  const getAgeColor = (lineIndex: number) => {
    // If we had real timestamps:
    // const time = timestamps[lineIndex];
    // const age = Date.now() - time;
    
    // Mocking based on line index for visual demo
    const mockAge = (lineIndex % 20) / 20; // 0 to 1
    
    if (mockAge < 0.2) return 'var(--vscode-charts-green)'; // New
    if (mockAge < 0.5) return 'var(--vscode-charts-blue)';  // Recent
    return 'var(--vscode-editor-lineHighlightBorder)';      // Old (faded)
  };

  return (
    <div style={GutterContainer}>
      {Array.from({ length: lineCount }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '20px', // Must match CodeEditor line height
            width: '100%',
            backgroundColor: getAgeColor(i),
            opacity: 0.6,
          }}
          title={`Line ${i + 1}: Modified recently`}
        />
      ))}
    </div>
  );
};
