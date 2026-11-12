import { toJalaali, toGregorian, jalaaliMonthLength } from 'jalaali-js';

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

// Index = JS Date#getDay() (0 = Sunday).
const WEEKDAY_NAMES_BY_JS_DAY = ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
const JS_DAY_TO_ENGLISH = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toFa(value) {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Today's date as "YYYY-MM-DD" in the phone's/browser's LOCAL time zone (toISOString would use UTC and be a day off after midnight in Iran). */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** iso: "YYYY-MM-DD" Gregorian string, as stored/sent to the API. */
export function isoToJalaliParts(iso) {
  if (!iso) return null;
  const [gy, gm, gd] = iso.split('-').map(Number);
  return toJalaali(gy, gm, gd);
}

export function jalaliPartsToIso(jy, jm, jd) {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return `${gy}-${pad2(gm)}-${pad2(gd)}`;
}

export function jalaliMonthName(jm) {
  return JALALI_MONTHS[jm - 1] ?? '';
}

export function jalaliMonthLengthSafe(jy, jm) {
  return jalaaliMonthLength(jy, jm);
}

export function todayJalaliParts() {
  return isoToJalaliParts(todayIso());
}

function jsDayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Persian weekday name of an ISO date, e.g. "سه‌شنبه". */
export function weekdayNameOfIso(iso) {
  return iso ? WEEKDAY_NAMES_BY_JS_DAY[jsDayOf(iso)] : '';
}

/** English weekday key used by programs ("Saturday"...), of an ISO date. */
export function weekdayKeyOfIso(iso) {
  return iso ? JS_DAY_TO_ENGLISH[jsDayOf(iso)] : '';
}

/** 0 = شنبه ... 6 = جمعه, the column order of a Persian calendar. */
export function persianWeekIndexOfIso(iso) {
  return (jsDayOf(iso) + 1) % 7;
}

/**
 * Formats an ISO ("YYYY-MM-DD") date for display, per the user's date-format setting.
 * `long` adds the weekday (and, for Jalali, the month name): «سه‌شنبه ۲۵ شهریور ۱۴۰۵» / «سه‌شنبه 2026/09/16».
 */
export function formatDateForDisplay(iso, dateFormat, long = false) {
  if (!iso) return '';
  const [gy, gm, gd] = iso.split('-').map(Number);
  if (dateFormat === 'jalali') {
    const { jy, jm, jd } = toJalaali(gy, gm, gd);
    if (long) return `${weekdayNameOfIso(iso)} ${toFa(jd)} ${jalaliMonthName(jm)} ${toFa(jy)}`;
    return toFa(`${jy}/${pad2(jm)}/${pad2(jd)}`);
  }
  if (long) return `${weekdayNameOfIso(iso)} ${gy}/${pad2(gm)}/${pad2(gd)}`;
  return `${gy}/${pad2(gm)}/${pad2(gd)}`;
}
