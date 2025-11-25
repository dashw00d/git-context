import * as React from 'react';
import { CockpitSectionKey } from '../../../types/cockpit';

interface TabsProps {
  active: CockpitSectionKey | 'live';
  onChange: (section: CockpitSectionKey | 'live') => void;
  counts: {
    commits: number;
    bundle: string;
    symbols: number;
    reports: number;
  };
}

export const Tabs: React.FC<TabsProps> = ({ active, onChange, counts }) => {
  const tabs = [
    { key: 'live' as const, label: 'Live', badge: null, disabled: true, tooltip: 'Coming soon: Real-time change tracking' },
    { key: 'commits' as const, label: 'Commits', badge: counts.commits.toString(), disabled: false, tooltip: undefined },
    { key: 'bundle' as const, label: 'Bundle', badge: counts.bundle, disabled: false, tooltip: undefined },
    { key: 'symbols' as const, label: 'Symbols', badge: counts.symbols.toString(), disabled: false, tooltip: undefined },
    { key: 'reports' as const, label: 'Reports', badge: counts.reports.toString(), disabled: false, tooltip: undefined }
  ];

  return (
    <div className="cockpit__tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`cockpit__tab${active === tab.key ? ' cockpit__tab--active' : ''}${tab.disabled ? ' cockpit__tab--disabled' : ''}`}
          onClick={() => !tab.disabled && onChange(tab.key)}
          title={tab.tooltip}
          disabled={tab.disabled}
        >
          {tab.label}
          {tab.badge && <span className="cockpit__tab-badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
};
