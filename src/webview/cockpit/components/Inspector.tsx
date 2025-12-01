import * as React from 'react';
import { InspectorProps } from '../types/superWebviewTypes';

const InspectorContainer: React.CSSProperties = {
    minWidth: '250px',
    width: '100%',
    maxWidth: '300px',
    borderLeft: '1px solid var(--vscode-panel-border)',
    backgroundColor: 'var(--vscode-sideBar-background)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
};

const TabsContainer: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid var(--vscode-panel-border)',
};

const TabStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: '0.9em',
    borderBottom: '2px solid transparent',
};

const ActiveTabStyle: React.CSSProperties = {
    ...TabStyle,
    borderBottom: '2px solid var(--vscode-panelTitle-activeBorder)',
    color: 'var(--vscode-panelTitle-activeForeground)',
};

const ContentStyle: React.CSSProperties = {
    flex: 1,
    padding: '15px',
    overflow: 'auto',
};

type LensType = 'timeline' | 'drift' | 'relations' | 'risk';

export const Inspector: React.FC<InspectorProps> = ({ frame }) => {
    const [activeLens, setActiveLens] = React.useState<LensType>('timeline');
    const isBundle = frame.level === 'bundle';
    const isFile = frame.level === 'file';
    const isSymbol = frame.level === 'symbol';
    const timeline = frame.data?.timeline || [];
    const drift = frame.data?.drift || [];
    const relations = frame.data?.relations || { incoming: [], outgoing: [], imports: [] };
    const risk = frame.data?.risk || null;

    return (
        <div style={InspectorContainer}>
            <div style={TabsContainer}>
                {(['timeline', 'drift', 'relations', 'risk'] as LensType[]).map(lens => (
                    <div
                        key={lens}
                        style={activeLens === lens ? ActiveTabStyle : TabStyle}
                        onClick={() => setActiveLens(lens)}
                    >
                        {lens.charAt(0).toUpperCase() + lens.slice(1)}
                    </div>
                ))}
            </div>

            <div style={ContentStyle}>
                <h4>{activeLens.charAt(0).toUpperCase() + activeLens.slice(1)} Lens</h4>
                <p style={{ fontSize: '0.9em', color: 'var(--vscode-descriptionForeground)' }}>
                    Scoped to: <strong>{frame.name}</strong> ({frame.level})
                </p>

                {activeLens === 'timeline' && (
                    <div>
                        <ul style={{ paddingLeft: '20px', marginTop: '10px', listStyle: 'none' }}>
                            {timeline.map((item: any, index: number) => (
                                <li key={index} style={{
                                    marginBottom: '15px',
                                    borderLeft: item.virtual ? '2px dashed var(--vscode-gitDecoration-modifiedResourceForeground)' : '2px solid var(--vscode-charts-blue)',
                                    paddingLeft: '10px'
                                }}>
                                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {item.virtual && <span style={{
                                            fontSize: '0.8em',
                                            padding: '2px 4px',
                                            borderRadius: '4px',
                                            background: 'var(--vscode-badge-background)',
                                            color: 'var(--vscode-badge-foreground)'
                                        }}>VIRTUAL</span>}
                                        {item.message}
                                    </div>
                                    <div style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
                                        {item.date ? new Date(item.date).toLocaleString() : 'Now'} • {item.author}
                                    </div>
                                    {item.stats && (
                                        <div style={{ fontSize: '0.8em', marginTop: '2px' }}>
                                            <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>+{item.stats.additions}</span>
                                            {' '}
                                            <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>-{item.stats.deletions}</span>
                                        </div>
                                    )}
                                </li>
                            ))}
                            {timeline.length === 0 && <p>No timeline data available.</p>}
                        </ul>
                        {frame.data?.history?.length > 0 && (
                            <div style={{ marginTop: '10px' }}>
                                <strong>Evolution</strong>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0 0' }}>
                                    {frame.data.history.map((h: any, idx: number) => (
                                        <li key={idx} style={{ padding: '6px 0', borderBottom: '1px solid var(--vscode-panel-border)', fontSize: '0.85em' }}>
                                            <div style={{ fontWeight: 'bold' }}>{h.message || h.summary || h.change}</div>
                                            <div style={{ opacity: 0.7 }}>{h.date ? new Date(h.date).toLocaleString() : ''} • {h.author || 'unknown'}</div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {activeLens === 'drift' && (
                    <div>
                        {drift.length > 0 ? (
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {drift.map((item: any, index: number) => (
                                    <li key={index} style={{ marginBottom: '10px', padding: '8px', border: '1px solid var(--vscode-inputValidation-warningBorder)', borderRadius: '4px', backgroundColor: 'var(--vscode-inputValidation-warningBackground)' }}>
                                        <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{item.issue}</span>
                                            <span style={{ fontSize: '0.8em', textTransform: 'uppercase' }}>{item.severity}</span>
                                        </div>
                                        <div style={{ marginTop: '5px' }}>
                                            <code>{item.symbol}</code>: {item.detail}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div style={{ padding: '10px', opacity: 0.7 }}>
                                <span style={{ color: 'var(--vscode-testing-iconPassed)' }}>✔</span> No drift detected.
                            </div>
                        )}

                        <div style={{ marginTop: '20px' }}>
                            <strong>Naming Drift</strong>
                            <div style={{ height: '4px', background: 'var(--vscode-progressBar-background)', marginTop: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${Math.min(drift.length * 10, 100)}%`,
                                    height: '100%',
                                    background: drift.length ? 'var(--vscode-charts-orange)' : 'var(--vscode-charts-green)'
                                }}></div>
                            </div>
                        </div>
                    </div>
                )}

                {activeLens === 'relations' && (
                    <div>
                        <p><strong>Incoming:</strong> {relations.incoming?.length || 0} callers</p>
                        {relations.incoming?.length > 0 && (
                            <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 10px 0' }}>
                                {relations.incoming.map((edge: any, idx: number) => (
                                    <li key={idx} style={{ fontSize: '0.85em', padding: '4px 0', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                                        {edge.from?.split(':')[0] || edge.from} → {edge.to?.split(':')[0] || edge.to} ({edge.type})
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p><strong>Outgoing:</strong> {relations.outgoing?.length || 0} callees</p>
                        {relations.outgoing?.length > 0 && (
                            <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 10px 0' }}>
                                {relations.outgoing.map((edge: any, idx: number) => (
                                    <li key={idx} style={{ fontSize: '0.85em', padding: '4px 0', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                                        {edge.from?.split(':')[0] || edge.from} → {edge.to?.split(':')[0] || edge.to} ({edge.type})
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p><strong>Imports:</strong> {relations.imports?.length || 0} modules</p>
                    </div>
                )}

                {activeLens === 'risk' && (
                    <div>
                        {risk ? (
                            <div style={{ padding: '8px', backgroundColor: 'rgba(255, 0, 0, 0.1)', borderRadius: '4px', border: '1px solid red' }}>
                                <strong>Risk Score</strong>
                                <p style={{ margin: '5px 0 0 0', fontSize: '0.9em' }}>
                                    Hotspot: {risk.hotspotScore} • Drift: {risk.driftCount} • Legacy: {risk.legacyDead}/{risk.legacyReplaced}
                                </p>
                                {frame.data?.changeStats && (
                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.85em' }}>
                                        Changes: +{frame.data.changeStats.added} / -{frame.data.changeStats.removed}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: '10px', opacity: 0.7 }}>
                                <span style={{ color: 'var(--vscode-testing-iconPassed)' }}>✔</span> No risk signals.
                            </div>
                        )}
                        {frame.data?.drift?.length > 0 && (
                            <div style={{ marginTop: '12px' }}>
                                <strong>Drift Signals</strong>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {frame.data.drift.map((d: any, idx: number) => (
                                        <li key={idx} style={{ padding: '6px 0', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                                            <div style={{ fontWeight: 'bold' }}>{d.name || d.symbol}</div>
                                            <div style={{ fontSize: '0.8em', opacity: 0.8 }}>{d.issue || d.detail || d.suggestedName || 'Drift detected'}</div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
