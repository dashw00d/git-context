import * as React from 'react';

interface ExpandableSectionProps {
  title: string;
  count: number;
  variant?: 'default' | 'critical' | 'warning';
  children: React.ReactNode;
}

export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  title,
  count,
  variant = 'default',
  children
}) => {
  const [expanded, setExpanded] = React.useState(false);

  if (count === 0) return null;

  const variantClass = variant === 'critical' ? 'cockpit__expandable--critical'
    : variant === 'warning' ? 'cockpit__expandable--warning'
    : '';

  return (
    <div className={`cockpit__expandable ${variantClass}`}>
      <button
        className="cockpit__expandable-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span>{title}</span>
        <span className="cockpit__badge">{count}</span>
      </button>
      {expanded && (
        <div className="cockpit__expandable-body">
          {children}
        </div>
      )}
    </div>
  );
};
