import * as React from 'react';

export const BlastRadiusStage: React.FC<{ frame: any; onZoomIn: (frame: any) => void }> = ({
  frame,
  onZoomIn,
}) => {
  const [showIncoming, setShowIncoming] = React.useState(true);
  const [showOutgoing, setShowOutgoing] = React.useState(true);
  const incoming = frame.data?.blastRadius?.incoming || [];
  const outgoing = frame.data?.blastRadius?.outgoing || [];
  const center = frame.name;
  const nodes = [
    ...incoming.map((edge: any) => ({ id: edge.from.split(':')[0], direction: 'in' })),
    ...outgoing.map((edge: any) => ({ id: edge.to.split(':')[0], direction: 'out' })),
  ];
  const uniqueNodes = Array.from(new Map(nodes.map(n => [n.id, n])).values());
  const edges = [
    ...incoming.map((e: any) => ({
      from: e.from.split(':')[0],
      to: center,
      direction: 'in',
      type: e.type,
    })),
    ...outgoing.map((e: any) => ({
      from: center,
      to: e.to.split(':')[0],
      direction: 'out',
      type: e.type,
    })),
  ];
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '10px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <h3 style={{ fontSize: '1.2em', marginBottom: '5px' }}>Dependencies</h3>
      <p
        style={{
          fontSize: '0.85em',
          color: 'var(--vscode-descriptionForeground)',
          marginBottom: '10px',
        }}
      >
        {frame.name}
      </p>
      {/* Simple radial graph */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85em' }}>
          <input
            type="checkbox"
            checked={showIncoming}
            onChange={e => setShowIncoming(e.target.checked)}
          />{' '}
          Incoming
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85em' }}>
          <input
            type="checkbox"
            checked={showOutgoing}
            onChange={e => setShowOutgoing(e.target.checked)}
          />{' '}
          Outgoing
        </label>
      </div>
      <div
        style={{
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: '4px',
          padding: '8px',
          minHeight: 180,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: 200 }}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'var(--vscode-editor-background)',
              border: '1px solid var(--vscode-panel-border)',
              fontWeight: 'bold',
              fontSize: '0.9em',
            }}
          >
            {center}
          </div>
          {uniqueNodes.map((n, idx) => {
            const angle = (idx / uniqueNodes.length) * Math.PI * 2;
            const radius = 65;
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            return (
              <div
                key={n.id}
                onClick={() =>
                  onZoomIn({
                    level: 'file',
                    id: n.id,
                    name: n.id.split('/').pop(),
                    status: 'scanning',
                  })
                }
                style={{
                  position: 'absolute',
                  top: `${y}%`,
                  left: `${x}%`,
                  transform: 'translate(-50%, -50%)',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  background:
                    n.direction === 'in'
                      ? 'var(--vscode-charts-blue)'
                      : 'var(--vscode-charts-orange)',
                  color: 'var(--vscode-editor-foreground)',
                  fontSize: '0.75em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {n.id.split('/').pop()}
              </div>
            );
          })}
          {edges
            .filter(
              e => (e.direction === 'in' && showIncoming) || (e.direction === 'out' && showOutgoing)
            )
            .map((e, idx) => {
              const fromIdx = uniqueNodes.findIndex(n => n.id === e.from);
              const toIdx = uniqueNodes.findIndex(n => n.id === e.to);
              if (fromIdx === -1 || toIdx === -1) return null;
              const angleFrom = (fromIdx / uniqueNodes.length) * Math.PI * 2;
              const angleTo = (toIdx / uniqueNodes.length) * Math.PI * 2;
              const radius = 65;
              const x1 = 50 + radius * Math.cos(angleFrom);
              const y1 = 50 + radius * Math.sin(angleFrom);
              const x2 = 50 + radius * Math.cos(angleTo);
              const y2 = 50 + radius * Math.sin(angleTo);
              return (
                <svg
                  key={idx}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                >
                  <line
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={
                      e.direction === 'in'
                        ? 'var(--vscode-charts-blue)'
                        : 'var(--vscode-charts-orange)'
                    }
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                </svg>
              );
            })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: 1 }}>
        <div
          style={{
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '4px',
            padding: '8px',
            overflow: 'auto',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
            Incoming ({incoming.length})
          </div>
          {incoming.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {incoming.map((edge: any, idx: number) => (
                <li
                  key={idx}
                  onClick={() =>
                    onZoomIn({
                      level: 'file',
                      id: edge.from.split(':')[0],
                      name: edge.from.split(':')[0].split('/').pop(),
                      status: 'scanning',
                    })
                  }
                  style={{
                    padding: '6px',
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                  }}
                >
                  {edge.from.split(':')[0]} → {edge.to.split(':')[0]} ({edge.type})
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ opacity: 0.6, fontSize: '0.85em' }}>None</div>
          )}
        </div>
        <div
          style={{
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '4px',
            padding: '8px',
            overflow: 'auto',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
            Outgoing ({outgoing.length})
          </div>
          {outgoing.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {outgoing.map((edge: any, idx: number) => (
                <li
                  key={idx}
                  onClick={() =>
                    onZoomIn({
                      level: 'file',
                      id: edge.to.split(':')[0],
                      name: edge.to.split(':')[0].split('/').pop(),
                      status: 'scanning',
                    })
                  }
                  style={{
                    padding: '6px',
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                  }}
                >
                  {edge.from.split(':')[0]} → {edge.to.split(':')[0]} ({edge.type})
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ opacity: 0.6, fontSize: '0.85em' }}>None</div>
          )}
        </div>
      </div>
    </div>
  );
};
