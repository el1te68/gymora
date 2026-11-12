import { fmt, NUTRIENTS } from '../utils/nutrition';

/** Calories ring: consumed vs target. */
export function CalorieRing({ consumed, target }) {
  const size = 150;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const hasTarget = target > 0;
  const ratio = hasTarget ? Math.min(consumed / target, 1) : 0;
  const over = hasTarget && consumed > target;
  const remaining = hasTarget ? Math.round(target - consumed) : null;

  return (
    <div className="calorie-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        {hasTarget && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={over ? 'var(--color-danger)' : 'var(--color-primary)'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="calorie-ring-text">
        <div className="calorie-ring-value">{fmt(consumed)}</div>
        <div className="calorie-ring-label">کیلوکالری</div>
        {hasTarget && (
          <div className={`calorie-ring-sub${over ? ' over' : ''}`}>
            {over ? `${fmt(-remaining)} بیشتر از هدف` : `${fmt(remaining)} باقی‌مانده`}
          </div>
        )}
      </div>
    </div>
  );
}

/** A labelled progress bar (grams consumed / grams target). */
export function MacroBar({ label, color, value, target, unit = 'گرم', max = false }) {
  const hasTarget = target > 0;
  const pct = hasTarget ? Math.min((value / target) * 100, 100) : 0;
  const over = hasTarget && value > target;
  return (
    <div className="macro-bar">
      <div className="macro-bar-head">
        <span className="macro-bar-label">
          <span className="dot" style={{ background: color }} />
          {label}
        </span>
        <span className={`macro-bar-value${over && max ? ' over' : ''}`}>
          {fmt(value, 1)}
          {hasTarget && (
            <span className="muted">
              {' / '}
              {max ? 'سقف ' : ''}
              {fmt(target)}
            </span>
          )}{' '}
          <span className="muted">{unit}</span>
        </span>
      </div>
      <div className="macro-bar-track">
        <div className="macro-bar-fill" style={{ width: `${pct}%`, background: over && max ? 'var(--color-danger)' : color }} />
      </div>
    </div>
  );
}

/** Protein / carbs / fat as three compact numbers. */
export function MacroChips({ totals }) {
  return (
    <span className="macro-chips">
      {NUTRIENTS.map((n) => (
        <span key={n.key} className="macro-chip" title={n.label}>
          <span className="dot" style={{ background: n.color }} />
          {n.short} {fmt(totals[n.key], 1)}
        </span>
      ))}
    </span>
  );
}
