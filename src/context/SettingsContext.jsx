import { createContext, useContext, useEffect, useState } from 'react';

const SettingsContext = createContext(null);

const STORAGE_KEY = 'gymora-settings';

const DEFAULT_SETTINGS = {
  dateFormat: 'gregorian', // 'gregorian' | 'jalali'
  units: 'metric', // 'metric' | 'imperial'
  restTimerEnabled: true, // start the rest countdown when a set is ticked
  restBetweenSets: 90, // seconds
  restBetweenExercises: 150, // seconds
  restAlert: true, // beep + vibrate when the countdown ends
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage can fail (private browsing, quota) - not worth surfacing to the user.
    }
  }, [settings]);

  function setDateFormat(dateFormat) {
    setSettings((prev) => ({ ...prev, dateFormat }));
  }

  function setUnits(units) {
    setSettings((prev) => ({ ...prev, units }));
  }

  // Partial update for the simple scalar settings (rest timer etc.).
  function updateSettings(patch) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  return (
    <SettingsContext.Provider value={{ ...settings, setDateFormat, setUnits, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings باید داخل SettingsProvider استفاده بشه');
  return ctx;
}
