import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading } from '../components/Feedback';
import DateField from '../components/DateField';
import DateText from '../components/DateText';
import { useSettings } from '../context/SettingsContext';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { cmToFeetInches, feetInchesToCm, roundTo } from '../utils/units';
import { ACTIVITY_LEVELS, GENDER_LABEL, GOAL_TYPES, addDaysIso, bmiCategory, fmt, localIso, parseNumber } from '../utils/nutrition';

const WEEK_CHIPS = [4, 8, 12, 16];
const blank = (v) => (v === null || v === undefined ? '' : String(v));

function toNumberOrNull(text) {
  if (text === '' || text === null || text === undefined) return null;
  const n = parseNumber(text);
  return Number.isNaN(n) ? NaN : n;
}

export default function NutritionGoalPage() {
  const { units } = useSettings();
  const weightUnit = useWeightUnit();
  const isImperial = units === 'imperial';
  const today = localIso();

  const { data: profile, loading: l1, error: e1 } = useFetch(api.getUserProfile, []);
  const { data: goal, loading: l2, error: e2 } = useFetch(api.getNutritionGoal, []);
  const { data: weights, loading: l3, error: e3, reload: reloadWeights } = useFetch(api.getBodyWeightLogs, []);
  const { data: targets, reload: reloadTargets } = useFetch(() => api.getNutritionTargets(today), [today]);

  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [activity, setActivity] = useState('');
  const [goalType, setGoalType] = useState('Maintain');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [calOv, setCalOv] = useState('');
  const [proOv, setProOv] = useState('');
  const [carbOv, setCarbOv] = useState('');
  const [fatOv, setFatOv] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  // Fill the form once everything has loaded.
  useEffect(() => {
    if (ready || !profile || !goal || !weights) return;
    setGender(profile.gender ?? '');
    setBirthDate(profile.birthDate ?? '');
    setHeightCm(blank(profile.heightCm));
    const latest = [...weights].sort((a, b) => (a.logDate < b.logDate ? 1 : -1))[0];
    setWeightInput(latest ? String(weightUnit.toDisplay(latest.weightKg)) : '');
    setActivity(goal.activityLevel ?? '');
    setGoalType(goal.goalType ?? 'Maintain');
    setTargetWeight(goal.targetWeightKg != null ? String(weightUnit.toDisplay(goal.targetWeightKg)) : '');
    setTargetDate(goal.targetDate ?? '');
    setCalOv(blank(goal.caloriesOverride));
    setProOv(blank(goal.proteinOverrideG));
    setCarbOv(blank(goal.carbsOverrideG));
    setFatOv(blank(goal.fatOverrideG));
    setReady(true);
    // weightUnit identity changes each render; the values only matter at first fill
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, goal, weights, ready]);

  const { feet, inches } = heightCm === '' ? { feet: '', inches: '' } : cmToFeetInches(Number(heightCm));
  function handleFeetInches(f, i) {
    if (f === '' && i === '') return setHeightCm('');
    setHeightCm(String(roundTo(feetInchesToCm(f === '' ? 0 : Number(f), i === '' ? 0 : Number(i)), 1)));
  }

  function setGoalWeeks(weeks) {
    setTargetDate(addDaysIso(today, weeks * 7));
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);

    const weightNum = toNumberOrNull(weightInput);
    const targetNum = toNumberOrNull(targetWeight);
    const ovs = [calOv, proOv, carbOv, fatOv].map(toNumberOrNull);
    if ([weightNum, targetNum, ...ovs].some((n) => Number.isNaN(n))) return setFormError('یکی از عددها معتبر نیست.');
    if (heightCm !== '' && !(Number(heightCm) > 50 && Number(heightCm) < 260)) return setFormError('قد باید بین ۵۰ و ۲۶۰ سانتی‌متر باشد.');
    if (goalType !== 'Maintain' && targetNum == null) return setFormError('برای کاهش یا افزایش وزن، وزن هدف را وارد کن.');

    setSaving(true);
    try {
      await api.updateUserProfile({
        heightCm: heightCm === '' ? null : Number(heightCm),
        birthDate: birthDate || null,
        gender: gender || null,
      });

      if (weightNum != null) {
        const kg = weightUnit.toKg(weightNum);
        const todays = (weights ?? []).find((w) => w.logDate === today);
        const latest = [...(weights ?? [])].sort((a, b) => (a.logDate < b.logDate ? 1 : -1))[0];
        // only write a log when it actually changes something
        if (todays) {
          if (Number(todays.weightKg) !== kg) await api.updateBodyWeightLog(todays.id, { logDate: today, weightKg: kg });
        } else if (!latest || Math.abs(Number(latest.weightKg) - kg) > 0.001) {
          await api.createBodyWeightLog({ logDate: today, weightKg: kg });
        }
      }

      await api.updateNutritionGoal({
        activityLevel: activity || null,
        goalType,
        targetWeightKg: goalType === 'Maintain' || targetNum == null ? null : weightUnit.toKg(targetNum),
        targetDate: goalType === 'Maintain' || !targetDate ? null : targetDate,
        caloriesOverride: ovs[0],
        proteinOverrideG: ovs[1],
        carbsOverrideG: ovs[2],
        fatOverrideG: ovs[3],
      });
      setSaved(true);
      reloadWeights();
      reloadTargets();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (l1 || l2 || l3) return <Loading />;

  const eff = targets?.effective;
  const comp = targets?.computed;
  const kcal = eff?.calories;
  const pct = (g, per) => (kcal > 0 && g != null ? Math.round(((g * per) / kcal) * 100) : null);
  const overridden = comp && eff && (comp.calories !== eff.calories || comp.proteinG !== eff.proteinG || comp.carbsG !== eff.carbsG || comp.fatG !== eff.fatG);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>هدف تغذیه</h1>
          <p>مشخصاتت و هدفت را بنویس تا کالری، پروتئین و کربوهیدرات روزانه محاسبه شود.</p>
        </div>
      </div>

      <ErrorBanner message={e1 || e2 || e3 || formError} />

      <div className="goal-grid">
        <form className="card" onSubmit={handleSave}>
          <h2>مشخصات تو</h2>
          <div className="form-row" style={{ marginTop: 10 }}>
            <div className="field">
              <label>جنسیت</label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">مشخص نشده</option>
                {Object.entries(GENDER_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>تاریخ تولد</label>
              <DateField value={birthDate} onChange={setBirthDate} yearsBack={100} yearsForward={0} />
            </div>
          </div>
          <div className="form-row">
            {!isImperial ? (
              <div className="field">
                <label>قد (سانتی‌متر)</label>
                <input className="input" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
              </div>
            ) : (
              <div className="field">
                <label>قد (فوت و اینچ)</label>
                <div className="form-row">
                  <input className="input" type="number" placeholder="فوت" value={feet} onChange={(e) => handleFeetInches(e.target.value, inches)} />
                  <input className="input" type="number" step="0.1" placeholder="اینچ" value={inches} onChange={(e) => handleFeetInches(feet, e.target.value)} />
                </div>
              </div>
            )}
            <div className="field">
              <label>وزن فعلی ({weightUnit.unitLabel})</label>
              <input className="input" inputMode="decimal" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>میزان فعالیت</label>
            {ACTIVITY_LEVELS.map((a) => (
              <button type="button" key={a.key} className={`activity-option${activity === a.key ? ' active' : ''}`} onClick={() => setActivity(a.key)}>
                <strong>{a.label}</strong>
                <span className="muted">{a.hint}</span>
              </button>
            ))}
          </div>

          <h2 style={{ marginTop: 18 }}>هدف</h2>
          <div className="field" style={{ marginTop: 8 }}>
            <div className="segmented">
              {GOAL_TYPES.map((g) => (
                <button type="button" key={g.key} className={goalType === g.key ? 'active' : ''} onClick={() => setGoalType(g.key)}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {goalType !== 'Maintain' && (
            <>
              <div className="form-row">
                <div className="field">
                  <label>وزن هدف ({weightUnit.unitLabel})</label>
                  <input className="input" inputMode="decimal" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
                </div>
                <div className="field">
                  <label>تا چه تاریخی؟</label>
                  <DateField value={targetDate} onChange={setTargetDate} yearsBack={0} yearsForward={2} />
                </div>
              </div>
              <div className="chip-row">
                {WEEK_CHIPS.map((w) => (
                  <button type="button" key={w} className={`chip${targetDate === addDaysIso(today, w * 7) ? ' active' : ''}`} onClick={() => setGoalWeeks(w)}>
                    {w} هفته دیگر
                  </button>
                ))}
                {targetDate && (
                  <button type="button" className="chip" onClick={() => setTargetDate('')}>
                    بدون تاریخ
                  </button>
                )}
              </div>
              <p className="muted">اگر تاریخ نگذاری، با یک آهنگ سالم و معمول محاسبه می‌شود.</p>
            </>
          )}

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>تنظیم دستی اعداد (اختیاری)</summary>
            <p className="muted" style={{ margin: '8px 0' }}>هر عددی که اینجا بنویسی جای عدد محاسبه‌شده می‌نشیند؛ خالی بگذار تا خودکار باشد.</p>
            <div className="form-row">
              <div className="field">
                <label>کالری</label>
                <input className="input" inputMode="decimal" value={calOv} onChange={(e) => setCalOv(e.target.value)} />
              </div>
              <div className="field">
                <label>پروتئین (g)</label>
                <input className="input" inputMode="decimal" value={proOv} onChange={(e) => setProOv(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>کربوهیدرات (g)</label>
                <input className="input" inputMode="decimal" value={carbOv} onChange={(e) => setCarbOv(e.target.value)} />
              </div>
              <div className="field">
                <label>چربی (g)</label>
                <input className="input" inputMode="decimal" value={fatOv} onChange={(e) => setFatOv(e.target.value)} />
              </div>
            </div>
          </details>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'در حال ذخیره...' : 'ذخیره و محاسبه'}
            </button>
            {saved && <span className="muted" style={{ alignSelf: 'center' }}>ذخیره شد ✓</span>}
          </div>
        </form>

        <div className="card">
          <h2>نیاز روزانه‌ی تو</h2>
          {!targets && <Loading />}
          {targets && !targets.isComplete && (
            <div className="no-target-hint" style={{ marginTop: 10 }}>
              برای محاسبه هنوز این‌ها لازم است: <strong>{targets.missing.join('، ')}</strong>. فرم را کامل و ذخیره کن.
            </div>
          )}
          {targets?.isComplete && eff && (
            <>
              <div style={{ margin: '8px 0 2px' }}>
                <span className="result-big">{fmt(eff.calories)}</span> <span className="muted">کیلوکالری در روز</span>
              </div>
              {overridden && <p className="muted">عددهای دستی جای پیشنهاد محاسبه‌شده (کالری {fmt(comp.calories)}) نشسته‌اند.</p>}

              <div className="result-macros">
                <div className="result-macro">
                  <span className="dot" style={{ background: 'var(--color-protein)' }} />
                  پروتئین
                  <strong>{fmt(eff.proteinG)} <small>گرم</small></strong>
                  <span className="muted">{pct(eff.proteinG, 4)}% از کالری</span>
                </div>
                <div className="result-macro">
                  <span className="dot" style={{ background: 'var(--color-carbs)' }} />
                  کربوهیدرات
                  <strong>{fmt(eff.carbsG)} <small>گرم</small></strong>
                  <span className="muted">{pct(eff.carbsG, 4)}% از کالری</span>
                </div>
                <div className="result-macro">
                  <span className="dot" style={{ background: 'var(--color-fat)' }} />
                  چربی
                  <strong>{fmt(eff.fatG)} <small>گرم</small></strong>
                  <span className="muted">{pct(eff.fatG, 9)}% از کالری</span>
                </div>
              </div>
              {eff.sugarMaxG != null && (
                <p>
                  <span className="dot" style={{ background: 'var(--color-sugar)' }} />
                  سقف پیشنهادی قند: <strong>{fmt(eff.sugarMaxG)} گرم</strong> در روز
                </p>
              )}

              <hr className="divider" />
              <div className="stat-row">
                <div className="stat">
                  <div className="value">{fmt(targets.tdee)}</div>
                  <div className="label">کالری مصرفی روزانه (TDEE)</div>
                </div>
                <div className="stat">
                  <div className="value">{fmt(targets.bmr)}</div>
                  <div className="label">متابولیسم پایه (BMR)</div>
                </div>
                <div className="stat">
                  <div className="value">{fmt(targets.bmi, 1)}</div>
                  <div className="label">BMI · {bmiCategory(targets.bmi)}</div>
                </div>
              </div>

              {targets.weeklyChangeKg != null && targets.weeklyChangeKg !== 0 && (
                <p style={{ marginTop: 12 }}>
                  آهنگ تغییر: حدود <strong>{fmt(Math.abs(targets.weeklyChangeKg), 2)} کیلوگرم در هفته</strong>
                  {targets.projectedDate && (
                    <>
                      {' '}
                      — رسیدن به وزن هدف تقریباً <DateText iso={targets.projectedDate} /> ({fmt(targets.daysToGoal)} روز)
                    </>
                  )}
                </p>
              )}

              {targets.notes?.length > 0 && (
                <ul className="notes-list">
                  {targets.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="disclaimer">این‌ها تخمین عمومی (فرمول Mifflin-St Jeor) است، نه توصیه‌ی پزشکی. اگر بیماری یا شرایط خاص داری با پزشک یا متخصص تغذیه مشورت کن.</p>
        </div>
      </div>
    </div>
  );
}
