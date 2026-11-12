// Shared helpers for the nutrition pages.

export const MEALS = [
  { key: 'Breakfast', label: 'صبحانه' },
  { key: 'Lunch', label: 'ناهار' },
  { key: 'Dinner', label: 'شام' },
  { key: 'Snack', label: 'میان‌وعده' },
];

export const MEAL_LABEL = Object.fromEntries(MEALS.map((m) => [m.key, m.label]));

export const ACTIVITY_LEVELS = [
  { key: 'Sedentary', label: 'کم‌تحرک', hint: 'کار پشت میز، تقریباً بدون ورزش' },
  { key: 'Light', label: 'فعالیت کم', hint: 'ورزش سبک، ۱ تا ۳ روز در هفته' },
  { key: 'Moderate', label: 'فعالیت متوسط', hint: 'ورزش ۳ تا ۵ روز در هفته' },
  { key: 'Active', label: 'فعالیت زیاد', hint: 'ورزش سنگین ۶ تا ۷ روز در هفته' },
  { key: 'VeryActive', label: 'فعالیت خیلی زیاد', hint: 'کار فیزیکی سنگین یا تمرین شدید روزانه' },
];

export const GOAL_TYPES = [
  { key: 'Lose', label: 'کاهش وزن' },
  { key: 'Maintain', label: 'ثابت ماندن وزن' },
  { key: 'Gain', label: 'افزایش وزن' },
];

export const GENDER_LABEL = { Male: 'مرد', Female: 'زن', Other: 'ترجیح می‌دم نگم' };

export const STATE_LABEL = { raw: 'خام', cooked: 'پخته', ready: 'آماده' };

export const NUTRIENTS = [
  { key: 'protein', label: 'پروتئین', short: 'پ', color: 'var(--color-protein)' },
  { key: 'carbs', label: 'کربوهیدرات', short: 'ک', color: 'var(--color-carbs)' },
  { key: 'fat', label: 'چربی', short: 'چ', color: 'var(--color-fat)' },
];

/** Local calendar date as "YYYY-MM-DD" (NOT UTC - at night in Tehran UTC is still "yesterday"). */
export function localIso(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return localIso(new Date(y, m - 1, d + days));
}

export function weekdayName(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fa-IR', { weekday: 'long' });
}

/** 1234.5 -> "1,235" (Latin digits, the rest of the app uses them too). */
export function fmt(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** Accepts Persian/Arabic digits and separators typed by the user. Returns a Number or NaN. */
export function parseNumber(text) {
  if (typeof text === 'number') return text;
  const normalized = String(text ?? '')
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[٫,،]/g, '.')
    .trim();
  if (normalized === '') return NaN;
  return Number(normalized);
}

export function baseUnitLabel(baseUnit) {
  return baseUnit === 'Milliliter' ? 'میلی‌لیتر' : 'گرم';
}

export function baseUnitShort(baseUnit) {
  return baseUnit === 'Milliliter' ? 'ml' : 'g';
}

const round1 = (n) => Math.round(n * 10) / 10;

/** Nutrition of `amount` grams/ml of a food whose values are per 100. */
export function scalePer100(food, amount) {
  const f = amount / 100;
  return {
    calories: round1(food.caloriesPer100 * f),
    protein: round1(food.proteinPer100 * f),
    carbs: round1(food.carbsPer100 * f),
    sugar: round1(food.sugarPer100 * f),
    fat: round1(food.fatPer100 * f),
  };
}

/** Energy implied by the macros (4/4/9). */
export function macroEnergy(protein, carbs, fat) {
  return 4 * (protein || 0) + 4 * (carbs || 0) + 9 * (fat || 0);
}

export function bmiCategory(bmi) {
  if (bmi == null) return '';
  if (bmi < 18.5) return 'کم‌وزن';
  if (bmi < 25) return 'طبیعی';
  if (bmi < 30) return 'اضافه‌وزن';
  return 'چاق';
}

/** Describes an amount like "2.5 × قاشق غذاخوری (62.5 گرم)" or "150 گرم". */
export function describeAmount(entry) {
  const unit = baseUnitLabel(entry.baseUnit);
  if (entry.unitAmount === 1 && (entry.unitLabel === 'گرم' || entry.unitLabel === 'میلی‌لیتر')) {
    return `${fmt(entry.quantity, 1)} ${unit}`;
  }
  return `${fmt(entry.quantity, 2)} × ${entry.unitLabel} (${fmt(entry.totalAmount, 1)} ${unit})`;
}
