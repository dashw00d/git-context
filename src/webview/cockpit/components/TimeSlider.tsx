import * as React from 'react';

interface TimeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const ContainerStyle: React.CSSProperties = {
  padding: '16px',
  borderTop: '1px solid var(--vscode-panel-border)',
  backgroundColor: 'var(--vscode-sideBar-background)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const LabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--vscode-sideBarTitle-foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const SliderStyle: React.CSSProperties = {
  width: '100%',
  cursor: 'pointer',
  accentColor: 'var(--vscode-progressBar-background)',
  height: '4px',
};

export const TimeSlider: React.FC<TimeSliderProps> = ({ value, onChange }) => {
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const oneMonth = 30 * 24 * 60 * 60 * 1000;
  const threeMonths = 3 * 30 * 24 * 60 * 60 * 1000;
  const oneYear = 365 * 24 * 60 * 60 * 1000;

  const timestampToSlider = (ts: number): number => {
    const diff = now - ts;
    if (diff <= 0) return 100;
    if (diff <= oneWeek) return 75 + 25 * (1 - diff / oneWeek);
    if (diff <= oneMonth) return 50 + 25 * (1 - (diff - oneWeek) / (oneMonth - oneWeek));
    if (diff <= threeMonths) return 25 + 25 * (1 - (diff - oneMonth) / (threeMonths - oneMonth));
    if (diff <= oneYear) return 25 * (1 - (diff - threeMonths) / (oneYear - threeMonths));
    return 0;
  };

  const sliderToTimestamp = (val: number): number => {
    if (val >= 100) return now;
    if (val >= 75) return now - oneWeek * (1 - (val - 75) / 25);
    if (val >= 50) return now - (oneWeek + (oneMonth - oneWeek) * (1 - (val - 50) / 25));
    if (val >= 25) return now - (oneMonth + (threeMonths - oneMonth) * (1 - (val - 25) / 25));
    return now - (threeMonths + (oneYear - threeMonths) * (1 - val / 25));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onChange(sliderToTimestamp(val));
  };

  const getLabel = (ts: number) => {
    const diff = now - ts;
    if (diff < 60 * 1000) return 'Now';
    if (diff < oneWeek) return 'Last Week';
    if (diff < oneMonth) return 'Last Month';
    if (diff < threeMonths) return 'Last 3 Months';
    return 'Last Year';
  };

  const reset = () => onChange(now);

  return (
    <div style={ContainerStyle}>
      <div style={LabelStyle}>
        <span>Time Travel</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--vscode-descriptionForeground)', fontWeight: 'normal' }}>
            {getLabel(value)}
          </span>
          {value < now - 60000 && (
            <span
              onClick={reset}
              style={{
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: 'var(--vscode-badge-background)',
                color: 'var(--vscode-badge-foreground)',
              }}
              title="Reset to Now"
            >
              ↺
            </span>
          )}
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={timestampToSlider(value)}
        onChange={handleChange}
        style={SliderStyle}
        title={new Date(value).toLocaleDateString()}
        list="time-markers"
      />
      <datalist id="time-markers">
        <option value="0" label="1y"></option>
        <option value="25" label="3m"></option>
        <option value="50" label="1m"></option>
        <option value="75" label="1w"></option>
        <option value="100" label="Now"></option>
      </datalist>
    </div>
  );
};
