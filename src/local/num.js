// Rounding and date helpers that mirror the C# (System.Decimal / DateOnly) behaviour of the server.

const EPS = 1e-9;

/** Math.Round(v, d, MidpointRounding.AwayFromZero). */
export function roundAway(v, d = 0) {
  const f = 10 ** d;
  const x = Math.abs(v) * f;
  return (Math.sign(v) * Math.floor(x + 0.5 + EPS)) / f;
}

/** Math.Round(v, d) - C# default, ties go to the even neighbour (banker's rounding). */
export function roundEven(v, d = 0) {
  const f = 10 ** d;
  const x = v * f;
  const fl = Math.floor(x);
  if (Math.abs(x - fl - 0.5) < EPS) return (fl % 2 === 0 ? fl : fl + 1) / f;
  return Math.round(x) / f;
}

const MS_DAY = 86400000;

export function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function isoToDayNumber(iso) {
  const { y, m, d } = parseIso(iso);
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
}

export function dayNumberToIso(n) {
  const dt = new Date(n * MS_DAY);
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  return dayNumberToIso(isoToDayNumber(iso) + days);
}

/** Local calendar date of this device as YYYY-MM-DD. */
export function localToday() {
  const t = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}
