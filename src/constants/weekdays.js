export const WEEKDAYS = [
  { value: 'Saturday', label: 'شنبه' },
  { value: 'Sunday', label: 'یک‌شنبه' },
  { value: 'Monday', label: 'دوشنبه' },
  { value: 'Tuesday', label: 'سه‌شنبه' },
  { value: 'Wednesday', label: 'چهارشنبه' },
  { value: 'Thursday', label: 'پنج‌شنبه' },
  { value: 'Friday', label: 'جمعه' },
];

export function weekdayLabel(value) {
  return WEEKDAYS.find((w) => w.value === value)?.label ?? value;
}
