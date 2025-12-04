import * as React from 'react';

interface RiskDotsProps {
  score: number; // 0-100
}

export const RiskDots: React.FC<RiskDotsProps> = ({ score }) => {
  // score 0-33 = 1 dot, 34-66 = 2 dots, 67-100 = 3 dots
  const filledDots = score < 34 ? 1 : score < 67 ? 2 : 3;
  const color =
    score < 34
      ? 'var(--vscode-charts-green)'
      : score < 67
        ? 'var(--vscode-charts-yellow)'
        : 'var(--vscode-charts-red)';

  return (
    <span style={{ display: 'flex', gap: '2px' }} title={`Risk: ${score}`}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: i < filledDots ? color : 'var(--vscode-editor-lineHighlightBorder)',
          }}
        />
      ))}
    </span>
  );
};
