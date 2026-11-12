import { useMemo, useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading, EmptyState } from '../components/Feedback';
import DateText from '../components/DateText';
import { useSettings } from '../context/SettingsContext';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { weekdayLabel } from '../constants/weekdays';
import { bodyWeightOn, estimateWorkoutCalories } from '../utils/calories';

function fmtNum(n) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function HistoryPage() {
  const { data: sessions, loading, error, reload } = useFetch(() => api.getWorkoutSessions(), []);
  // The program list only has summaries; the days (titles) come with each program's own endpoint.
  const { data: programs } = useFetch(async () => {
    const list = await api.getPrograms();
    return Promise.all(list.map((p) => api.getProgram(p.id)));
  }, []);
  const { data: bodyLogs } = useFetch(api.getBodyWeightLogs, []);
  const settings = useSettings();
  const weightUnit = useWeightUnit();
  const [openIds, setOpenIds] = useState(null); // null = "only the newest one is open"

  // programDayId -> « شنبه · سینه و پشت بازو »
  const dayLabels = useMemo(() => {
    const map = new Map();
    for (const p of programs || []) {
      for (const d of p.days || []) map.set(d.id, d.title ? `${weekdayLabel(d.weekday)} · ${d.title}` : weekdayLabel(d.weekday));
    }
    return map;
  }, [programs]);

  const stats = useMemo(() => {
    const out = new Map();
    for (const s of sessions || []) {
      const volumeKg = s.exerciseLogs.reduce(
        (sum, l) => sum + l.sets.reduce((a, x) => a + x.reps * x.weightKg, 0),
        0,
      );
      const est = estimateWorkoutCalories(
        s.exerciseLogs.map((l) => ({ sets: l.sets })),
        bodyWeightOn(bodyLogs, s.sessionDate),
        { restBetweenSets: settings.restBetweenSets, restBetweenExercises: settings.restBetweenExercises },
      );
      out.set(s.id, { volumeKg, ...est, exercises: s.exerciseLogs.length });
    }
    return out;
  }, [sessions, bodyLogs, settings.restBetweenSets, settings.restBetweenExercises]);

  function isOpen(s, index) {
    return openIds ? openIds.has(s.id) : index === 0;
  }

  function toggle(s, index) {
    const base = openIds ?? new Set(sessions.length ? [sessions[0].id] : []);
    const next = new Set(base);
    if (next.has(s.id)) next.delete(s.id);
    else next.add(s.id);
    setOpenIds(next);
    void index;
  }

  async function handleDelete(id) {
    if (!confirm('این جلسه‌ی تمرینی حذف بشه؟')) return;
    await api.deleteWorkoutSession(id);
    reload();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>تاریخچه تمرین</h1>
          <p>هر جلسه با خلاصه‌اش؛ روی هر جلسه بزن تا ست‌های هر حرکت رو ببینی.</p>
        </div>
      </div>

      <ErrorBanner message={error} />

      {loading && <Loading />}
      {!loading && sessions?.length === 0 && (
        <div className="card">
          <EmptyState text="هنوز هیچ تمرینی ثبت نشده." />
        </div>
      )}

      {sessions?.map((s, index) => {
        const st = stats.get(s.id);
        const open = isOpen(s, index);
        const dayLabel = s.programDayId ? dayLabels.get(s.programDayId) : null;
        return (
          <div className="card session-card" key={s.id}>
            <button type="button" className="session-head" onClick={() => toggle(s, index)} aria-expanded={open}>
              <div className="session-head-main">
                <div className="session-date">
                  <DateText iso={s.sessionDate} long />
                </div>
                <div className="muted">{dayLabel || 'تمرین آزاد'}</div>
              </div>
              <span className="session-chevron" aria-hidden="true">{open ? '▾' : '◂'}</span>
            </button>

            <div className="session-stats">
              <span className="stat-chip">{st.exercises} حرکت</span>
              <span className="stat-chip">{st.sets} ست</span>
              <span className="stat-chip" title="مجموع تکرار × وزنه">
                حجم {fmtNum(weightUnit.toDisplay(st.volumeKg))} {weightUnit.unitLabel}
              </span>
              <span className="stat-chip">~{st.minutes} دقیقه</span>
              {st.kcal > 0 && <span className="stat-chip stat-chip-hot">🔥 ~{st.kcal} کالری</span>}
            </div>

            {open && (
              <>
                {s.exerciseLogs.map((log) => {
                  const best = Math.max(...log.sets.map((x) => x.weightKg));
                  const varies = log.sets.some((x) => x.weightKg !== best); // highlight the top set only when sets differ
                  return (
                    <div key={log.id} className="history-exercise">
                      <div className="history-exercise-name">{log.exerciseName}</div>
                      <table className="set-table">
                        <thead>
                          <tr>
                            <th>ست</th>
                            <th>وزنه ({weightUnit.unitLabel})</th>
                            <th>تکرار</th>
                          </tr>
                        </thead>
                        <tbody>
                          {log.sets.map((set) => (
                            <tr key={set.setNumber} className={varies && set.weightKg === best ? 'best' : ''}>
                              <td>{set.setNumber}</td>
                              <td>{weightUnit.toDisplay(set.weightKg)}</td>
                              <td>{set.reps}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                <div className="session-foot">
                  {st.kcal === 0 && <span className="muted">برای نمایش کالری، وزن بدنت رو ثبت کن.</span>}
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>
                    حذف این جلسه
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
      {sessions?.length > 0 && <p className="disclaimer">کالری و مدت، تخمینی هستن (روش MET، از روی ست‌ها و زمان‌های استراحتِ تنظیمات).</p>}
    </div>
  );
}
