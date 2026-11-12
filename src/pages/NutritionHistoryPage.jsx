import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { EmptyState, ErrorBanner, Loading } from '../components/Feedback';
import DateText from '../components/DateText';
import { useSettings } from '../context/SettingsContext';
import { isoToJalaliParts, toFa } from '../utils/dates';
import { addDaysIso, fmt, localIso, weekdayName } from '../utils/nutrition';

const RANGES = [7, 14, 30];

function CalorieChart({ days, target }) {
  // RTL: oldest day on the right, so the chart reads like the rest of the page.
  const { dateFormat } = useSettings();
  const wrapRef = useRef(null);
  const W = Math.max(days.length * 24, 300); // 7/14 days fit a phone screen; 30 days scroll sideways
  // start at the newest day (the left end in RTL) instead of the oldest
  useEffect(() => {
    if (wrapRef.current) wrapRef.current.scrollLeft = -1e6;
  }, [days.length]);
  const dayLabel = (iso) => (dateFormat === 'jalali' ? toFa(isoToJalaliParts(iso).jd) : Number(iso.slice(8)));
  const H = 190;
  const pad = { top: 14, bottom: 26, left: 8, right: 8 };
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(target || 0, ...days.map((d) => d.totals.calories), 100) * 1.1;
  const slot = (W - pad.left - pad.right) / days.length;
  const y = (v) => pad.top + innerH - (v / max) * innerH;

  return (
    <div>
    <div className="chart-wrap" ref={wrapRef}>
      <svg className="chart-svg" width="100%" style={{ minWidth: days.length > 14 ? W : undefined, maxHeight: 260 }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="نمودار کالری روزانه">
        {days.map((d, i) => {
          const x = W - pad.right - (i + 1) * slot;
          const h = (d.totals.calories / max) * innerH;
          const over = target > 0 && d.totals.calories > target * 1.1;
          return (
            <g key={d.date}>
              <title>{`${d.date}: ${fmt(d.totals.calories)} کیلوکالری`}</title>
              <rect
                className="chart-bar"
                x={x + slot * 0.18}
                y={pad.top + innerH - h}
                width={slot * 0.64}
                height={Math.max(h, d.entryCount ? 2 : 0)}
                rx="3"
                fill={over ? 'var(--color-danger)' : 'var(--color-primary)'}
                opacity={d.entryCount ? 1 : 0.15}
              />
              <text x={x + slot / 2} y={H - 8} textAnchor="middle">
                {dayLabel(d.date)}
              </text>
            </g>
          );
        })}
        {target > 0 && (
          <line x1={pad.left} x2={W - pad.right} y1={y(target)} y2={y(target)} stroke="var(--color-accent)" strokeDasharray="5 4" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
    {target > 0 && <p className="muted">خط‌چین: هدف روزانه ({fmt(target)} کیلوکالری)؛ ستون قرمزتیره یعنی بیش از ۱۰٪ بالاتر از هدف.</p>}
    </div>
  );
}

export default function NutritionHistoryPage() {
  const [range, setRange] = useState(14);
  const today = localIso();
  const from = addDaysIso(today, -(range - 1));

  const { data: rows, loading, error } = useFetch(() => api.getFoodLogRange(from, today), [from, today]);
  const { data: targets } = useFetch(() => api.getNutritionTargets(today), [today]);

  // Fill missing days so the chart has no gaps. oldest -> newest
  const byDate = new Map((rows ?? []).map((r) => [r.date, r]));
  const days = Array.from({ length: range }, (_, i) => {
    const date = addDaysIso(from, i);
    return byDate.get(date) ?? { date, entryCount: 0, totals: { calories: 0, protein: 0, carbs: 0, sugar: 0, fat: 0 } };
  });
  const logged = days.filter((d) => d.entryCount > 0);
  const avg = (key) => (logged.length ? logged.reduce((s, d) => s + d.totals[key], 0) / logged.length : 0);
  const target = targets?.effective?.calories;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>تاریخچه تغذیه</h1>
          <p>میانگین فقط روی روزهایی حساب می‌شود که چیزی ثبت کرده‌ای.</p>
        </div>
        <div className="segmented">
          {RANGES.map((r) => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
              {r} روز
            </button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} />
      {loading && !rows && <Loading />}

      {rows && logged.length === 0 && <EmptyState text="در این بازه چیزی ثبت نشده." action={<Link className="btn btn-primary" to="/nutrition">ثبت غذای امروز</Link>} />}

      {rows && logged.length > 0 && (
        <>
          <div className="card">
            <div className="stat-row" style={{ marginBottom: 12 }}>
              <div className="stat">
                <div className="value">{fmt(avg('calories'))}</div>
                <div className="label">میانگین کالری روزانه</div>
              </div>
              <div className="stat">
                <div className="value">{fmt(avg('protein'), 1)}</div>
                <div className="label">میانگین پروتئین (g)</div>
              </div>
              <div className="stat">
                <div className="value">{fmt(avg('carbs'), 1)}</div>
                <div className="label">میانگین کربوهیدرات (g)</div>
              </div>
              <div className="stat">
                <div className="value">{fmt(avg('fat'), 1)}</div>
                <div className="label">میانگین چربی (g)</div>
              </div>
              <div className="stat">
                <div className="value">{logged.length}</div>
                <div className="label">روز ثبت‌شده از {range}</div>
              </div>
            </div>
            <CalorieChart days={days} target={target} />
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>روز</th>
                  <th>کالری</th>
                  <th>پروتئین</th>
                  <th>کربو</th>
                  <th className="col-sm-hide">قند</th>
                  <th>چربی</th>
                </tr>
              </thead>
              <tbody>
                {[...days].reverse().map((d) => (
                  <tr key={d.date}>
                    <td>
                      <Link to={`/nutrition?date=${d.date}`}>
                        <span className="hide-sm">{weekdayName(d.date)} · </span>
                        <DateText iso={d.date} />
                      </Link>
                    </td>
                    {d.entryCount > 0 ? (
                      <>
                        <td>
                          <strong>{fmt(d.totals.calories)}</strong>
                        </td>
                        <td>{fmt(d.totals.protein, 1)}</td>
                        <td>{fmt(d.totals.carbs, 1)}</td>
                        <td className="col-sm-hide">{fmt(d.totals.sugar, 1)}</td>
                        <td>{fmt(d.totals.fat, 1)}</td>
                      </>
                    ) : (
                      <td colSpan={5} className="muted">
                        —
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
