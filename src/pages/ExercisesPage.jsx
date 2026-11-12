import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading, EmptyState } from '../components/Feedback';
import ExerciseForm, { ROLE_LABEL } from '../components/ExerciseForm';

export default function ExercisesPage() {
  const { data: muscles } = useFetch(api.getMuscles, []);

  const [muscleFilter, setMuscleFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data: exercises,
    loading,
    error,
    reload,
  } = useFetch(() => api.getExercises({ muscleId: muscleFilter || undefined, search: search || undefined }), [
    muscleFilter,
    search,
  ]);

  const [mode, setMode] = useState(null); // null | 'create' | exerciseId being edited
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const editingExercise = typeof mode === 'number' ? exercises?.find((x) => x.id === mode) : null;

  async function handleSubmit(payload) {
    setSaving(true);
    setFormError(null);
    try {
      if (mode === 'create') {
        await api.createExercise(payload);
      } else {
        await api.updateExercise(mode, payload);
      }
      setMode(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('این حرکت حذف بشه؟')) return;
    try {
      await api.deleteExercise(id);
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>حرکت‌های ورزشی</h1>
          <p>هر حرکت به یک یا چند عضله وصل می‌شه تا بعداً بشه برنامه چید و پیشرفت رو دنبال کرد.</p>
        </div>
        {mode === null && (
          <button className="btn btn-primary" onClick={() => setMode('create')}>
            حرکت جدید
          </button>
        )}
      </div>

      <ErrorBanner message={error || formError} />

      {(mode === 'create' || editingExercise) && (
        <div className="card">
          <h3>{mode === 'create' ? 'حرکت جدید' : 'ویرایش حرکت'}</h3>
          <ExerciseForm
            allMuscles={muscles || []}
            initial={editingExercise}
            saving={saving}
            onCancel={() => setMode(null)}
            onSubmit={handleSubmit}
          />
        </div>
      )}

      <div className="card">
        <div className="form-row">
          <div className="field" style={{ marginBottom: 0, flex: 2 }}>
            <label>جستجو (فارسی یا انگلیسی)</label>
            <input
              type="text"
              className="input"
              placeholder="مثلاً: پرس سینه یا Bench Press"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
            <label>فیلتر عضله</label>
            <select className="input" value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value)}>
              <option value="">همه عضله‌ها</option>
              {muscles?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {loading && <Loading />}
        {!loading && exercises?.length === 0 && (
          <EmptyState text="چیزی با این فیلتر پیدا نشد." />
        )}
        {!loading &&
          exercises?.map((ex) => (
            <div className="list-row" key={ex.id} style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 2 }}>
                  {ex.name}
                  {ex.englishName && <span className="muted"> · {ex.englishName}</span>}
                </h3>
                {ex.description && <p style={{ margin: '0 0 6px' }}>{ex.description}</p>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ex.muscles.map((m) => (
                    <span
                      key={m.muscleId}
                      className={m.role === 'Primary' ? 'badge badge-rust' : 'badge'}
                    >
                      {m.muscleName} · {ROLE_LABEL[m.role]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="actions">
                <button className="btn btn-sm btn-ghost" onClick={() => setMode(ex.id)}>
                  ویرایش
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(ex.id)}>
                  حذف
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
