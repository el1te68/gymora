import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading } from '../components/Feedback';
import DateField from '../components/DateField';
import { useSettings } from '../context/SettingsContext';
import { cmToFeetInches, feetInchesToCm, roundTo } from '../utils/units';

const GENDER_LABEL = { Male: 'مرد', Female: 'زن', Other: 'ترجیح می‌دم نگم' };

export default function ProfilePage() {
  const { data: profile, loading, error } = useFetch(api.getUserProfile, []);
  const { units } = useSettings();
  const isImperial = units === 'imperial';

  const [heightCm, setHeightCm] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setHeightCm(profile.heightCm ?? '');
    setBirthDate(profile.birthDate ?? '');
    setGender(profile.gender ?? '');
  }, [profile]);

  const { feet, inches } = heightCm === '' ? { feet: '', inches: '' } : cmToFeetInches(Number(heightCm));

  function handleFeetInchesChange(newFeet, newInches) {
    if (newFeet === '' && newInches === '') {
      setHeightCm('');
      return;
    }
    const f = newFeet === '' ? 0 : Number(newFeet);
    const i = newInches === '' ? 0 : Number(newInches);
    setHeightCm(String(roundTo(feetInchesToCm(f, i), 1)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setSaved(false);
    try {
      await api.updateUserProfile({
        heightCm: heightCm === '' ? null : Number(heightCm),
        birthDate: birthDate || null,
        gender: gender || null,
      });
      setSaved(true);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>پروفایل</h1>
          <p>این اطلاعات برای محاسبات آینده (مثل BMI) استفاده می‌شه.</p>
        </div>
      </div>

      <ErrorBanner message={error || formError} />

      <div className="card" style={{ maxWidth: 420 }}>
        <form onSubmit={handleSubmit}>
          {!isImperial ? (
            <div className="field">
              <label>قد (سانتی‌متر)</label>
              <input
                type="number"
                className="input"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <label>قد (فوت و اینچ)</label>
              <div className="form-row">
                <input
                  type="number"
                  className="input"
                  placeholder="فوت"
                  value={feet}
                  onChange={(e) => handleFeetInchesChange(e.target.value, inches)}
                />
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  placeholder="اینچ"
                  value={inches}
                  onChange={(e) => handleFeetInchesChange(feet, e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="field">
            <label>تاریخ تولد</label>
            <DateField value={birthDate} onChange={setBirthDate} yearsBack={100} yearsForward={0} />
          </div>
          <div className="field">
            <label>جنسیت</label>
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">مشخص نشده</option>
              {Object.entries(GENDER_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'در حال ذخیره...' : 'ذخیره پروفایل'}
          </button>
          {saved && (
            <span className="muted" style={{ marginRight: 10 }}>
              ذخیره شد ✓
            </span>
          )}
        </form>
      </div>
    </div>
  );
}
