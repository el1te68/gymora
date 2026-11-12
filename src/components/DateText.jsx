import { useSettings } from '../context/SettingsContext';
import { formatDateForDisplay } from '../utils/dates';

/** `long` -> with weekday and month name («سه‌شنبه ۲۵ شهریور ۱۴۰۵»). */
export default function DateText({ iso, long = false }) {
  const { dateFormat } = useSettings();
  return formatDateForDisplay(iso, dateFormat, long);
}
