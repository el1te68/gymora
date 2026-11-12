import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import Modal from './Modal';
import {
  formatDateForDisplay,
  isoToJalaliParts,
  jalaliMonthLengthSafe,
  jalaliMonthName,
  jalaliPartsToIso,
  persianWeekIndexOfIso,
  todayIso,
  toFa,
  JALALI_MONTHS,
} from '../utils/dates';

const WEEK_HEADS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export default function DateField({ value, onChange }) {
  const { dateFormat } = useSettings();

  if (dateFormat !== 'jalali') {
    return (
      <input
        type="date"
        className="input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return <JalaliDateField value={value} onChange={onChange} />;
}

function JalaliDateField({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="input date-trigger" onClick={() => setOpen(true)}>
        <span aria-hidden="true">📅</span>
        <span>{value ? formatDateForDisplay(value, 'jalali', true).split(' ').slice(1).join(' ') : 'انتخاب تاریخ'}</span>
      </button>
      {open && (
        <Modal title="انتخاب تاریخ" onClose={() => setOpen(false)}>
          <JalaliCalendar
            value={value}
            onPick={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}

function JalaliCalendar({ value, onPick, onClose }) {
  const today = todayIso();
  const base = isoToJalaliParts(value || today);
  const [view, setView] = useState({ jy: base.jy, jm: base.jm });
  const [picking, setPicking] = useState(false); // month/year chooser

  const { jy, jm } = view;
  const length = jalaliMonthLengthSafe(jy, jm);
  const offset = persianWeekIndexOfIso(jalaliPartsToIso(jy, jm, 1));
  const cells = [...Array(offset).fill(null), ...Array.from({ length }, (_, i) => i + 1)];

  function shiftMonth(delta) {
    const index = jy * 12 + (jm - 1) + delta;
    setView({ jy: Math.floor(index / 12), jm: (index % 12) + 1 });
  }

  return (
    <div className="jcal">
      <div className="jcal-head">
        <button type="button" className="jcal-nav" onClick={() => (picking ? setView({ jy: jy - 1, jm }) : shiftMonth(-1))} aria-label="قبلی">
          ›
        </button>
        <button type="button" className="jcal-title" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
          {jalaliMonthName(jm)} {toFa(jy)} <span aria-hidden="true">{picking ? '▴' : '▾'}</span>
        </button>
        <button type="button" className="jcal-nav" onClick={() => (picking ? setView({ jy: jy + 1, jm }) : shiftMonth(1))} aria-label="بعدی">
          ‹
        </button>
      </div>

      {picking ? (
        <div className="jcal-months">
          {JALALI_MONTHS.map((name, i) => (
            <button
              key={name}
              type="button"
              className={`jcal-month${i + 1 === jm ? ' current' : ''}`}
              onClick={() => {
                setView({ jy, jm: i + 1 });
                setPicking(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="jcal-grid jcal-weekdays">
            {WEEK_HEADS.map((w, i) => (
              <span key={w} className={i === 6 ? 'friday' : ''}>
                {w}
              </span>
            ))}
          </div>
          <div className="jcal-grid">
            {cells.map((day, i) => {
              if (day === null) return <span key={`e${i}`} />;
              const iso = jalaliPartsToIso(jy, jm, day);
              const cls = ['jcal-day'];
              if (iso === value) cls.push('selected');
              if (iso === today) cls.push('today');
              if ((offset + day - 1) % 7 === 6) cls.push('friday');
              return (
                <button key={day} type="button" className={cls.join(' ')} onClick={() => onPick(iso)}>
                  {toFa(day)}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="jcal-foot">
        <button type="button" className="btn btn-sm" onClick={() => onPick(today)}>
          امروز
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
          بستن
        </button>
      </div>
    </div>
  );
}
