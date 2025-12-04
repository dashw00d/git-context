import * as React from 'react';

interface MovedBlock {
  symbolId: string;
  previousSymbolId: string;
  sourceVersion: string;
  destVersion: string;
  moveType: 'rename' | 'relocate' | 'refactor';
  sourceFile?: string;
  destFile?: string;
  sourceStartLine?: number;
  sourceEndLine?: number;
  destStartLine?: number;
  destEndLine?: number;
}

interface MovedBlockGutterProps {
  lineCount: number;
  movedBlocks: MovedBlock[];
  currentFilePath?: string;
  vscode?: any;
}

const GutterContainer: React.CSSProperties = {
  width: '12px',
  backgroundColor: 'var(--vscode-editorGutter-background)',
  borderRight: '1px solid var(--vscode-panel-border)',
  position: 'relative',
  flexShrink: 0,
};

const MovedBlockIndicator: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  width: '3px',
  backgroundColor: '#9b59b6', // Purple color
  cursor: 'pointer',
  zIndex: 10,
};

export const MovedBlockGutter: React.FC<MovedBlockGutterProps> = ({
  lineCount,
  movedBlocks,
  currentFilePath,
  vscode,
}) => {
  // Filter moved blocks relevant to current file
  const relevantBlocks = React.useMemo(() => {
    return movedBlocks.filter(block => {
      // Check if this block is in the current file (either source or dest)
      if (currentFilePath) {
        return (
          block.destFile === currentFilePath ||
          block.sourceFile === currentFilePath ||
          block.destVersion === currentFilePath ||
          block.sourceVersion === currentFilePath
        );
      }
      return true;
    });
  }, [movedBlocks, currentFilePath]);

  const handleBlockClick = (block: MovedBlock) => {
    if (!vscode) return;

    // Navigate to source version
    const sourceFrame = {
      level: 'file' as const,
      id: block.sourceFile || block.sourceVersion,
      name: block.sourceFile?.split('/').pop() || 'Source',
      status: 'scanning' as const,
    };

    vscode.postMessage({ type: 'navigateToFrame', frame: sourceFrame });
  };

  // Calculate line positions for each moved block
  const blockPositions = React.useMemo(() => {
    return relevantBlocks.map(block => {
      // Use dest lines if available, otherwise estimate
      const startLine = block.destStartLine || 1;
      const endLine = block.destEndLine || startLine + 10;

      return {
        block,
        startLine,
        endLine,
        top: `${((startLine - 1) / lineCount) * 100}%`,
        height: `${((endLine - startLine + 1) / lineCount) * 100}%`,
      };
    });
  }, [relevantBlocks, lineCount]);

  if (relevantBlocks.length === 0) {
    return <div style={GutterContainer} />;
  }

  return (
    <div style={GutterContainer}>
      {blockPositions.map((pos, idx) => {
        const sourceInfo = pos.block.sourceFile
          ? `${pos.block.sourceFile.split('/').pop()}:${pos.block.sourceStartLine || '?'}–${pos.block.sourceEndLine || '?'}`
          : `version ${pos.block.sourceVersion}`;
        const tooltip = `Moved from ${sourceInfo} (${pos.block.moveType})`;

        return (
          <div
            key={idx}
            style={{
              ...MovedBlockIndicator,
              top: pos.top,
              height: pos.height,
            }}
            onClick={() => handleBlockClick(pos.block)}
            title={tooltip}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#7d3c98'; // Darker purple on hover
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#9b59b6';
            }}
          />
        );
      })}
    </div>
  );
};
