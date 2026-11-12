import { useSettings } from '../context/SettingsContext';
import { kgToLb, lbToKg, roundTo } from '../utils/units';

export function useWeightUnit() {
  const { units } = useSettings();
  const isImperial = units === 'imperial';

  return {
    isImperial,
    unitLabel: isImperial ? 'lb' : 'kg',
    // A kg value (as stored/sent to the API) -> the number to show in the UI.
    toDisplay(kg) {
      if (kg === null || kg === undefined || kg === '') return '';
      const num = Number(kg);
      return isImperial ? roundTo(kgToLb(num), 1) : roundTo(num, 1);
    },
    // A number entered in the current display unit -> kg, for the API.
    toKg(displayValue) {
      if (displayValue === null || displayValue === undefined || displayValue === '') return null;
      const num = Number(displayValue);
      return isImperial ? roundTo(lbToKg(num), 2) : roundTo(num, 2);
    },
  };
}
