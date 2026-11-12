import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading, EmptyState } from '../components/Feedback';
import DateField from '../components/DateField';
import DateText from '../components/DateText';
import ExercisePickerModal from '../components/ExercisePickerModal';
import { RestTimerBar, useRestTimer, formatClock } from '../components/RestTimer';
import { useSettings } from '../context/SettingsContext';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { WEEKDAYS, weekdayLabel } from '../constants/weekdays';
import { todayIso, weekdayKeyOfIso } from '../utils/dates';
import { bodyWeightOn, estimateWorkoutCalories } from '../utils/calories';
import { kgToLb, lbToKg, roundTo } from '../utils/units';

const DRAFT_KEY = 'gymora-workout-draft';
const LAST_PROGRAM_KEY = 'gymora-last-program';
const FREE_TAB = 'free';

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage may be unavailable (private mode) - the workout simply isn't restored later
  }
}

let keyCounter = 0;
const newKey = () => `ex-${Date.now()}-${keyCounter++}`;

/** Local set shape: { reps, weight, done } - `weight` is in the unit currently selected (kg or lb). */
function buildSets(count, lastSession, toDisplayWeight) {
  return Array.from({ length: Math.max(count, 1) }, (_, i) => {
    const prev = lastSession?.sets?.[i];
    return {
      reps: prev ? String(prev.reps) : '',
      weight: prev ? String(toDisplayWeight(prev.weightKg)) : '',
      done: false,
    };
  });
}

function lastLogFor(sessions, exerciseId) {
  let best = null;
  for (const s of sessions || []) {
    const log = s.exerciseLogs.find((l) => l.exerciseId === exerciseId);
    if (!log) continue;
    if (!best || s.sessionDate > best.date || (s.sessionDate === best.date && s.id > best.id)) {
      best = { id: s.id, date: s.sessionDate, sets: log.sets };
    }
  }
  return best && { date: best.date, sets: best.sets };
}

function loadDraft() {
  try {
    const raw = readStorage(DRAFT_KEY);
    const draft = raw ? JSON.parse(raw) : null;
    return draft?.v === 1 && Array.isArray(draft.items) && draft.items.length > 0 ? draft : null;
  } catch {
    return null;
  }
}

export default function TrainPage() {
  const weightUnit = useWeightUnit();
  const settings = useSettings();
  const rest = useRestTimer({ alert: settings.restAlert });

  const { data: programs, loading: loadingPrograms, error: programsError } = useFetch(api.getPrograms, []);
  const { data: exercises } = useFetch(api.getExercises, []);
  const { data: muscles } = useFetch(api.getMuscles, []);
  const { data: bodyLogs } = useFetch(api.getBodyWeightLogs, []);
  const { data: allSessions, reload: reloadSessions } = useFetch(() => api.getWorkoutSessions(), []);

  // A workout in progress survives leaving the page / the phone killing the app.
  const draftRef = useRef(undefined);
  if (draftRef.current === undefined) draftRef.current = loadDraft();
  const draft = draftRef.current;

  const [programId, setProgramId] = useState(draft?.programId ?? readStorage(LAST_PROGRAM_KEY) ?? '');
  const [sessionDate, setSessionDate] = useState(draft?.sessionDate ?? todayIso());
  const [tab, setTab] = useState(draft?.tab ?? null); // weekday value, or 'free'
  const [mode, setMode] = useState(draft?.mode ?? null); // 'day' | 'rest' | 'free'
  const [dayId, setDayId] = useState(draft?.dayId ?? null);
  const [dayTitle, setDayTitle] = useState(draft?.dayTitle ?? '');
  const [items, setItems] = useState(() => convertDraftUnits(draft, weightUnit));
  const [restored, setRestored] = useState(!!draft);

  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [result, setResult] = useState(null);
  const [picker, setPicker] = useState(null); // { mode: 'add' } | { mode: 'swap', key }

  const { data: program } = useFetch(
    () => (programId ? api.getProgram(Number(programId)) : Promise.resolve(null)),
    [programId],
  );

  // With one program and nothing chosen yet, just use it.
  useEffect(() => {
    if (!programId && programs?.length) {
      const remembered = readStorage(LAST_PROGRAM_KEY);
      const pick = programs.find((p) => String(p.id) === remembered) ?? programs[programs.length - 1];
      setProgramId(String(pick.id));
    }
  }, [programs, programId]);

  // ---------- choosing what to train ----------

  const loadDayExercises = useCallback(
    async (id, title) => {
      setLoadingDay(true);
      setFormError(null);
      try {
        const prep = await api.getProgramDayPrep(id);
        setItems(
          prep.exercises.map((ex) => ({
            key: newKey(),
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            targetSets: ex.targetSets,
            targetRepMin: ex.targetRepMin,
            targetRepMax: ex.targetRepMax,
            lastSession: ex.lastSession,
            sets: buildSets(ex.targetSets, ex.lastSession, weightUnit.toDisplay),
          })),
        );
        setDayId(id);
        setDayTitle(title || prep.title || '');
        setMode('day');
      } catch (err) {
        setFormError(err.message);
      } finally {
        setLoadingDay(false);
      }
    },
    [weightUnit.toDisplay],
  );

  const pickTab = useCallback(
    (weekday, prog = program) => {
      setTab(weekday);
      setResult(null);
      setFormError(null);
      setRestored(false);
      rest.stop();
      if (weekday === FREE_TAB) {
        setMode('free');
        setDayId(null);
        setDayTitle('تمرین آزاد');
        setItems([]);
        return;
      }
      const day = prog?.days.find((d) => d.weekday === weekday);
      if (day && !day.isRestDay) {
        loadDayExercises(day.id, day.title);
      } else {
        setMode('rest');
        setDayId(null);
        setDayTitle('');
        setItems([]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [program, loadDayExercises],
  );

  // First time a program is on screen (and there is no restored workout): open today's weekday.
  const autoPickedFor = useRef(null);
  const skipFirstAutoPick = useRef(!!draft);
  useEffect(() => {
    if (!program) return;
    if (autoPickedFor.current === program.id) return;
    autoPickedFor.current = program.id;
    if (skipFirstAutoPick.current) {
      skipFirstAutoPick.current = false; // a restored workout is already on screen
      return;
    }
    pickTab(weekdayKeyOfIso(sessionDate) || WEEKDAYS[0].value, program);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  function changeProgram(value) {
    setProgramId(value);
    writeStorage(LAST_PROGRAM_KEY, value || null);
    setTab(null);
    setMode(null);
    setItems([]);
    setResult(null);
    setRestored(false);
    autoPickedFor.current = null;
  }

  // Training on a rest day anyway: start empty, or borrow one of the program's training days.
  function trainAnyway(fromDay) {
    if (fromDay) {
      // the borrowed training day becomes the template (and the session is linked to it)
      loadDayExercises(fromDay.id, fromDay.title);
    } else {
      setMode('free');
      setDayId(null);
      setDayTitle('تمرین آزاد');
      setItems([]);
    }
  }

  // ---------- keeping the draft ----------

  useEffect(() => {
    if (items.length === 0 || result) {
      writeStorage(DRAFT_KEY, null);
      return;
    }
    writeStorage(
      DRAFT_KEY,
      JSON.stringify({
        v: 1,
        programId,
        sessionDate,
        tab,
        mode,
        dayId,
        dayTitle,
        unit: weightUnit.unitLabel,
        items,
      }),
    );
  }, [items, programId, sessionDate, tab, mode, dayId, dayTitle, result, weightUnit.unitLabel]);

  function discardDraft() {
    if (!confirm('تمرین نیمه‌تموم پاک بشه و از نو شروع کنی؟')) return;
    rest.stop();
    setRestored(false);
    setItems([]);
    if (tab) pickTab(tab);
  }

  // ---------- editing the workout ----------

  const patchItem = (key, fn) => setItems((prev) => prev.map((it) => (it.key === key ? fn(it) : it)));

  function updateSet(key, index, field, value) {
    patchItem(key, (it) => {
      const old = it.sets[index][field];
      return {
        ...it,
        sets: it.sets.map((s, i) => {
          if (i === index) return { ...s, [field]: value };
          // later sets that hadn't been touched yet follow the change ("same for all sets" without a special mode)
          if (i > index && !s.done && s[field] === old) return { ...s, [field]: value };
          return s;
        }),
      };
    });
  }

  function toggleDone(key, index) {
    const itemIndex = items.findIndex((it) => it.key === key);
    const item = items[itemIndex];
    if (!item) return;
    const becomingDone = !item.sets[index].done;

    patchItem(key, (it) => ({
      ...it,
      sets: it.sets.map((s, i) => {
        if (i !== index) return s;
        if (!becomingDone) return { ...s, done: false };
        // ticking an empty set means "I did what I did last time"
        const prev = it.lastSession?.sets?.[i];
        return {
          reps: s.reps === '' && prev ? String(prev.reps) : s.reps,
          weight: s.weight === '' && prev ? String(weightUnit.toDisplay(prev.weightKg)) : s.weight,
          done: true,
        };
      }),
    }));

    if (!becomingDone || !settings.restTimerEnabled) return;
    const isLastSet = index === item.sets.length - 1;
    const next = items[itemIndex + 1];
    if (!isLastSet) rest.start(settings.restBetweenSets, 'استراحت بین ست‌ها');
    else if (next) rest.start(settings.restBetweenExercises, `استراحت بین حرکت‌ها · بعدی: ${next.exerciseName}`);
    else rest.stop();
  }

  function addSet(key) {
    patchItem(key, (it) => {
      const last = it.sets[it.sets.length - 1];
      return { ...it, sets: [...it.sets, { reps: last?.reps ?? '', weight: last?.weight ?? '', done: false }] };
    });
  }

  function removeSet(key, index) {
    patchItem(key, (it) => (it.sets.length <= 1 ? it : { ...it, sets: it.sets.filter((_, i) => i !== index) }));
  }

  function moveItem(key, delta) {
    setItems((prev) => {
      const i = prev.findIndex((it) => it.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function removeItem(key) {
    const it = items.find((x) => x.key === key);
    if (it?.sets.some((s) => s.done) && !confirm(`«${it.exerciseName}» ست انجام‌شده داره. از تمرین امروز حذف بشه؟`)) return;
    setItems((prev) => prev.filter((x) => x.key !== key));
  }

  function handlePick(ex) {
    const last = lastLogFor(allSessions, ex.id);
    if (picker.mode === 'swap') {
      patchItem(picker.key, (it) => ({
        ...it,
        exerciseId: ex.id,
        exerciseName: ex.name,
        targetSets: undefined,
        targetRepMin: undefined,
        targetRepMax: undefined,
        lastSession: last,
        sets: buildSets(it.sets.length, last, weightUnit.toDisplay),
      }));
    } else {
      setItems((prev) => [
        ...prev,
        {
          key: newKey(),
          exerciseId: ex.id,
          exerciseName: ex.name,
          lastSession: last,
          sets: buildSets(3, last, weightUnit.toDisplay),
        },
      ]);
    }
    setPicker(null);
  }

  // ---------- numbers ----------

  const bodyKg = bodyWeightOn(bodyLogs, sessionDate);
  const estimate = useMemo(
    () =>
      estimateWorkoutCalories(
        items.map((it) => ({ sets: it.sets })),
        bodyKg,
        { restBetweenSets: settings.restBetweenSets, restBetweenExercises: settings.restBetweenExercises },
      ),
    [items, bodyKg, settings.restBetweenSets, settings.restBetweenExercises],
  );
  const totalSets = items.reduce((n, it) => n + it.sets.length, 0);
  const doneSets = items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);

  async function handleSubmit() {
    setSaving(true);
    setFormError(null);
    try {
      const exerciseLogs = items
        .map((it) => ({
          exerciseId: it.exerciseId,
          sets: it.sets
            .filter((s) => s.reps !== '' && Number(s.reps) > 0)
            .map((s, i) => ({
              setNumber: i + 1,
              reps: Number(s.reps),
              weightKg: s.weight === '' ? 0 : weightUnit.toKg(s.weight),
            })),
        }))
        .filter((l) => l.sets.length > 0);

      if (exerciseLogs.length === 0) {
        setFormError('حداقل باید یک ست با تعداد تکرار ثبت کنی.');
        return;
      }

      await api.createWorkoutSession({
        programDayId: mode === 'day' ? dayId : null,
        sessionDate,
        exerciseLogs,
      });
      setResult({ kcal: estimate.kcal, minutes: estimate.minutes, sets: estimate.sets, noWeight: !bodyKg });
      setItems([]);
      rest.stop();
      reloadSessions();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const todayKey = weekdayKeyOfIso(todayIso());
  const trainingDays = (program?.days || []).filter((d) => !d.isRestDay);

  return (
    <div className={rest.active ? 'has-rest-bar' : ''}>
      <div className="page-header">
        <div>
          <h1>تمرین امروز</h1>
          <p>برنامه و روز رو انتخاب کن، ست‌ها رو که تموم کردی تیک بزن تا تایمر استراحت شروع بشه.</p>
        </div>
      </div>

      <ErrorBanner message={programsError} />

      <div className="card">
        <div className="form-row">
          <div className="field">
            <label>برنامه</label>
            <select className="input" value={programId} onChange={(e) => changeProgram(e.target.value)}>
              <option value="">انتخاب برنامه...</option>
              {programs?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>تاریخ تمرین</label>
            <DateField value={sessionDate} onChange={setSessionDate} />
          </div>
        </div>

        {loadingPrograms && <Loading />}

        {!loadingPrograms && !program && (
          <div className="chip-row">
            <button type="button" className={`chip${tab === FREE_TAB ? ' active' : ''}`} onClick={() => pickTab(FREE_TAB, null)}>
              ✨ تمرین آزاد (بدون برنامه)
            </button>
          </div>
        )}

        {program && (
          <div className="tabs">
            {WEEKDAYS.map((w) => {
              const day = program.days.find((d) => d.weekday === w.value);
              const isRest = !day || day.isRestDay;
              return (
                <button
                  key={w.value}
                  type="button"
                  className={`tab${tab === w.value ? ' active' : ''}${isRest ? ' tab-rest' : ''}${w.value === todayKey ? ' tab-today' : ''}`}
                  onClick={() => pickTab(w.value)}
                  title={isRest ? 'روز استراحت' : day.title || ''}
                >
                  {w.label}
                  {isRest ? ' 😴' : ''}
                </button>
              );
            })}
            <button type="button" className={`tab${tab === FREE_TAB ? ' active' : ''}`} onClick={() => pickTab(FREE_TAB)}>
              ✨ آزاد
            </button>
          </div>
        )}
      </div>

      {restored && items.length > 0 && !result && (
        <div className="hint-box warn" style={{ marginTop: 16 }}>
          تمرین نیمه‌تموم قبلیت برگردونده شد.{' '}
          <button type="button" className="link-btn" onClick={discardDraft}>
            پاک کردن و شروع از نو
          </button>
        </div>
      )}

      <ErrorBanner message={formError} />

      {loadingDay && <Loading text="در حال آماده‌سازی روز تمرین..." />}

      {result && (
        <div className="card result-card">
          <div className="result-title">تمرین امروز ثبت شد 💪</div>
          <div className="stat-row" style={{ marginTop: 10 }}>
            <div className="stat">
              <div className="value">{result.kcal ? `~${result.kcal}` : '—'}</div>
              <div className="label">کالری سوخته (تخمینی)</div>
            </div>
            <div className="stat">
              <div className="value">{result.minutes}</div>
              <div className="label">دقیقه (تخمینی)</div>
            </div>
            <div className="stat">
              <div className="value">{result.sets}</div>
              <div className="label">ست ثبت‌شده</div>
            </div>
          </div>
          {result.noWeight && (
            <p className="muted" style={{ marginTop: 8 }}>
              برای محاسبه‌ی کالری، وزن بدنت رو توی «وزن بدن» ثبت کن.
            </p>
          )}
          <p className="disclaimer">کالری با روش MET و از روی ست‌ها و زمان‌های استراحت تخمین زده می‌شه؛ عدد دقیق نیست.</p>
          <button type="button" className="btn" style={{ marginTop: 6 }} onClick={() => tab && pickTab(tab)}>
            تمرین دیگه‌ای شروع کن
          </button>
        </div>
      )}

      {!result && !loadingDay && mode === 'rest' && (
        <div className="card rest-day-card">
          <div className="rest-day-emoji" aria-hidden="true">😴</div>
          <h2>{tab ? `${weekdayLabel(tab)} روز استراحته` : 'روز استراحته'}</h2>
          <p>
            عضله‌ها توی استراحت رشد می‌کنن؛ امروز لازم نیست تمرین کنی. اگه حالشو داری، می‌تونی یه تمرین دلخواه هم ثبت کنی.
          </p>
          <div className="chip-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={() => trainAnyway(null)}>
              می‌خوام تمرین کنم (خودم حرکت‌ها رو می‌چینم)
            </button>
          </div>
          {trainingDays.length > 0 && (
            <>
              <p className="muted" style={{ marginTop: 14 }}>یا یکی از روزهای تمرینی برنامه رو امروز انجام بده:</p>
              <div className="chip-row" style={{ justifyContent: 'center' }}>
                {trainingDays.map((d) => (
                  <button key={d.id} type="button" className="chip" onClick={() => trainAnyway(d)}>
                    {weekdayLabel(d.weekday)}
                    {d.title ? ` · ${d.title}` : ''}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!result && !loadingDay && (mode === 'day' || mode === 'free') && (
        <div className="card">
          <div className="train-head">
            <div>
              <h2 style={{ marginBottom: 2 }}>{dayTitle || (tab && tab !== FREE_TAB ? weekdayLabel(tab) : 'تمرین آزاد')}</h2>
              <p style={{ margin: 0 }}>
                <DateText iso={sessionDate} long />
              </p>
            </div>
            {totalSets > 0 && (
              <div className="progress-pill" title="ست‌های انجام‌شده">
                {doneSets} از {totalSets} ست
              </div>
            )}
          </div>

          {items.length === 0 && (
            <EmptyState
              text={mode === 'free' ? 'هنوز حرکتی اضافه نکردی؛ از دکمه‌ی پایین شروع کن.' : 'برای این روز هنوز حرکتی تعریف نشده؛ می‌تونی همین‌جا حرکت اضافه کنی.'}
            />
          )}

          {items.map((it, itemIndex) => (
            <div className="exercise-block" key={it.key}>
              <div className="exercise-block-head">
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ marginBottom: 2 }}>{it.exerciseName}</h3>
                  {it.targetSets ? (
                    <p className="muted" style={{ margin: 0 }}>
                      هدف: {it.targetSets} ست × {it.targetRepMin}-{it.targetRepMax} تکرار
                    </p>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>حرکت اضافه‌شده</p>
                  )}
                </div>
                <div className="icon-actions">
                  <button type="button" className="icon-btn" disabled={itemIndex === 0} onClick={() => moveItem(it.key, -1)} aria-label="انتقال به بالا" title="بالا">
                    ↑
                  </button>
                  <button type="button" className="icon-btn" disabled={itemIndex === items.length - 1} onClick={() => moveItem(it.key, 1)} aria-label="انتقال به پایین" title="پایین">
                    ↓
                  </button>
                  <button type="button" className="icon-btn" onClick={() => setPicker({ mode: 'swap', key: it.key })} aria-label="تعویض حرکت" title="تعویض حرکت">
                    ⇄
                  </button>
                  <button type="button" className="icon-btn icon-btn-danger" onClick={() => removeItem(it.key)} aria-label="حذف حرکت" title="حذف حرکت">
                    🗑
                  </button>
                </div>
              </div>

              {it.lastSession ? (
                <div className="prev-hint">
                  <span className="prev-label">دفعه‌ی قبل (<DateText iso={it.lastSession.date} />)</span>
                  <span dir="ltr" className="prev-sets">
                    {it.lastSession.sets
                      .map((s) => `${s.reps}×${weightUnit.toDisplay(s.weightKg)}${weightUnit.unitLabel}`)
                      .join(' · ')}
                  </span>
                </div>
              ) : (
                <div className="prev-hint">هنوز رکوردی برای این حرکت ثبت نشده.</div>
              )}

              <div className="set-grid set-grid-head">
                <span>ست</span>
                <span>تکرار</span>
                <span>وزنه ({weightUnit.unitLabel})</span>
                <span />
                <span />
              </div>

              {it.sets.map((set, i) => {
                const prev = it.lastSession?.sets?.[i];
                return (
                  <div className={`set-grid set-row${set.done ? ' done' : ''}`} key={i}>
                    <span className="set-num">{i + 1}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="input"
                      value={set.reps}
                      placeholder={prev ? String(prev.reps) : ''}
                      onChange={(e) => updateSet(it.key, i, 'reps', e.target.value)}
                      aria-label={`تکرار ست ${i + 1}`}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      className="input"
                      value={set.weight}
                      placeholder={prev ? String(weightUnit.toDisplay(prev.weightKg)) : ''}
                      onChange={(e) => updateSet(it.key, i, 'weight', e.target.value)}
                      aria-label={`وزنه ست ${i + 1}`}
                    />
                    <button
                      type="button"
                      className={`done-btn${set.done ? ' on' : ''}`}
                      onClick={() => toggleDone(it.key, i)}
                      aria-pressed={set.done}
                      aria-label={set.done ? `ست ${i + 1} انجام شد` : `ست ${i + 1} رو انجام‌شده علامت بزن`}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-quiet"
                      disabled={it.sets.length <= 1}
                      onClick={() => removeSet(it.key, i)}
                      aria-label={`حذف ست ${i + 1}`}
                      title="حذف این ست"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              <button type="button" className="btn btn-sm btn-ghost" onClick={() => addSet(it.key)}>
                + ست اضافه
              </button>
            </div>
          ))}

          <button type="button" className="btn add-exercise-btn" onClick={() => setPicker({ mode: 'add' })}>
            + افزودن حرکت
          </button>

          {items.length > 0 && (
            <>
              <hr className="divider" />
              <div className="estimate-row">
                <div>
                  <div className="estimate-main">
                    {bodyKg && estimate.kcal ? <>🔥 حدود {estimate.kcal} کالری</> : <>🔥 کالری: —</>}
                    <span className="muted"> · حدود {estimate.minutes} دقیقه</span>
                  </div>
                  <div className="muted">
                    {bodyKg
                      ? `تخمین با وزن ${weightUnit.toDisplay(bodyKg)} ${weightUnit.unitLabel} و استراحت ${formatClock(settings.restBetweenSets)} بین ست‌ها`
                      : 'برای محاسبه‌ی کالری، وزن بدنت رو توی «وزن بدن» ثبت کن.'}
                  </div>
                </div>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                  {saving ? 'در حال ثبت...' : 'ثبت تمرین'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {picker && (
        <ExercisePickerModal
          title={picker.mode === 'swap' ? 'تعویض حرکت' : 'افزودن حرکت'}
          exercises={exercises || []}
          muscles={muscles || []}
          disabledIds={items.map((it) => it.exerciseId)}
          onPick={handlePick}
          onClose={() => setPicker(null)}
        />
      )}

      <RestTimerBar rest={rest} />
    </div>
  );
}

/** A saved workout stores weights in the unit that was active when it was saved; convert if the unit changed since. */
function convertDraftUnits(draft, weightUnit) {
  if (!draft) return [];
  if (!draft.unit || draft.unit === weightUnit.unitLabel) return draft.items;
  const toNow = (v) => {
    if (v === '' || v === null) return '';
    const n = Number(v);
    if (Number.isNaN(n)) return '';
    return String(roundTo(draft.unit === 'kg' ? kgToLb(n) : lbToKg(n), 1));
  };
  return draft.items.map((it) => ({ ...it, sets: it.sets.map((s) => ({ ...s, weight: toNow(s.weight) })) }));
}
