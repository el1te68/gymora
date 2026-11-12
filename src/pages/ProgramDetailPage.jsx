import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading } from '../components/Feedback';
import DateText from '../components/DateText';
import ExercisePickerField from '../components/ExercisePickerField';
import { WEEKDAYS, weekdayLabel } from '../constants/weekdays';

function emptyExerciseRow(order) {
  return { exerciseId: '', order, sets: 3, repMin: 8, repMax: 12 };
}

export default function ProgramDetailPage() {
  const { id } = useParams();
  const programId = Number(id);
  const navigate = useNavigate();

  const { data: program, loading, error, reload } = useFetch(api.getProgram.bind(null, programId), [programId]);
  const { data: exercises } = useFetch(api.getExercises, []);
  const { data: muscles } = useFetch(api.getMuscles, []);

  const [activeWeekday, setActiveWeekday] = useState(WEEKDAYS[0].value);
  const [isRestDay, setIsRestDay] = useState(true);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const activeDay = program?.days.find((d) => d.weekday === activeWeekday);

  useEffect(() => {
    if (!activeDay) return;
    setIsRestDay(activeDay.isRestDay);
    setTitle(activeDay.title || '');
    setRows(
      activeDay.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        order: e.order,
        sets: e.sets,
        repMin: e.repMin,
        repMax: e.repMax,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay?.id, program]);

  // Switching tabs should clear any leftover "saved" confirmation from the previous day.
  useEffect(() => {
    setSaveSuccess(false);
  }, [activeWeekday]);

  // Auto-hide the "saved" confirmation a couple of seconds after it appears.
  useEffect(() => {
    if (!saveSuccess) return undefined;
    const timer = setTimeout(() => setSaveSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  function updateRow(index, patch) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyExerciseRow(prev.length + 1)]);
  }

  function removeRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveDay() {
    if (!activeDay) return;
    setSaving(true);
    setFormError(null);
    setSaveSuccess(false);
    try {
      const dto = {
        weekday: activeWeekday,
        isRestDay,
        title: title.trim() || null,
        exercises: isRestDay
          ? []
          : rows
              .filter((r) => r.exerciseId)
              .map((r, i) => ({
                exerciseId: Number(r.exerciseId),
                order: i + 1,
                sets: Number(r.sets),
                repMin: Number(r.repMin),
                repMax: Number(r.repMax),
              })),
      };
      await api.updateProgramDay(programId, activeDay.id, dto);
      reload();
      setSaveSuccess(true);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProgram() {
    if (!confirm('این برنامه به طور کامل حذف بشه؟')) return;
    await api.deleteProgram(programId);
    navigate('/programs');
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;
  if (!program) return null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{program.name}</h1>
          <p>
            شروع: <DateText iso={program.startDate} />
          </p>
        </div>
        <button className="btn btn-danger" onClick={handleDeleteProgram}>
          حذف کل برنامه
        </button>
      </div>

      <ErrorBanner message={formError} />

      <div className="tabs">
        {WEEKDAYS.map((w) => {
          const day = program.days.find((d) => d.weekday === w.value);
          return (
            <button
              key={w.value}
              className={`tab${activeWeekday === w.value ? ' active' : ''}`}
              onClick={() => setActiveWeekday(w.value)}
            >
              {w.label}
              {day && !day.isRestDay ? ' ●' : ''}
            </button>
          );
        })}
      </div>

      {activeDay && (
        <div className="card">
          <div className="form-row" style={{ alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={isRestDay}
                onChange={(e) => setIsRestDay(e.target.checked)}
              />
              روز استراحت
            </label>
            {!isRestDay && (
              <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                <input
                  className="input"
                  placeholder="عنوان روز (مثلاً: سینه و پشت بازو)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            )}
          </div>

          {!isRestDay && (
            <>
              <hr className="divider" />
              {rows.map((row, i) => (
                <div key={i} className="form-row" style={{ marginBottom: 10, alignItems: 'flex-end' }}>
                  <div className="field" style={{ marginBottom: 0, flex: 2 }}>
                    <label>حرکت</label>
                    <ExercisePickerField
                      exercises={exercises || []}
                      muscles={muscles || []}
                      value={row.exerciseId}
                      onChange={(exerciseId) => updateRow(i, { exerciseId })}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, width: 80 }}>
                    <label>ست</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={row.sets}
                      onChange={(e) => updateRow(i, { sets: e.target.value })}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, width: 80 }}>
                    <label>حداقل تکرار</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={row.repMin}
                      onChange={(e) => updateRow(i, { repMin: e.target.value })}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, width: 80 }}>
                    <label>حداکثر تکرار</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={row.repMax}
                      onChange={(e) => updateRow(i, { repMax: e.target.value })}
                    />
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => removeRow(i)}>
                    حذف
                  </button>
                </div>
              ))}
              <button className="btn btn-sm btn-ghost" onClick={addRow} type="button">
                + افزودن حرکت به این روز
              </button>
            </>
          )}

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleSaveDay} disabled={saving}>
              {saving ? 'در حال ذخیره...' : `ذخیره ${weekdayLabel(activeWeekday)}`}
            </button>
            {saveSuccess && (
              <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 14 }}>
                ذخیره شد ✓
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
