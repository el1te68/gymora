import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading, EmptyState } from '../components/Feedback';
import DateField from '../components/DateField';
import DateText from '../components/DateText';
import { WEEKDAYS } from '../constants/weekdays';
import { todayIso } from '../utils/dates';

export default function ProgramsPage() {
  const { data: programs, loading, error, reload } = useFetch(api.getPrograms, []);
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // Every new program starts with all 7 days as rest days;
      // exercises get added afterwards from the program's own page.
      const days = WEEKDAYS.map((w) => ({
        weekday: w.value,
        isRestDay: true,
        title: null,
        exercises: [],
      }));
      const created = await api.createProgram({ name: name.trim(), startDate, days });
      navigate(`/programs/${created.id}`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('این برنامه حذف بشه؟')) return;
    try {
      await api.deleteProgram(id);
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>برنامه‌های تمرینی</h1>
          <p>برای هر برنامه، روزهای هفته رو تعریف کن و برای هر روز چند حرکت با ست و رنج تکرار بچین.</p>
        </div>
        {!creating && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            برنامه جدید
          </button>
        )}
      </div>

      <ErrorBanner message={error || formError} />

      {creating && (
        <div className="card">
          <h3>برنامه جدید</h3>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="p-name">نام برنامه</label>
                <input
                  id="p-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثلاً: هایپرتروفی - فاز ۱"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="p-start">تاریخ شروع</label>
                <DateField value={startDate} onChange={setStartDate} />
              </div>
            </div>
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={saving || !name.trim()}>
                {saving ? 'در حال ساخت...' : 'ساخت برنامه'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
                انصراف
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading && <Loading />}
        {!loading && programs?.length === 0 && (
          <EmptyState text="هنوز هیچ برنامه‌ای نساختی." />
        )}
        {!loading &&
          programs?.map((p) => (
            <div className="list-row" key={p.id}>
              <div>
                <h3 style={{ marginBottom: 2 }}>
                  <Link to={`/programs/${p.id}`}>{p.name}</Link>
                </h3>
                <span className="muted">
                  شروع: <DateText iso={p.startDate} />
                </span>
              </div>
              <div className="actions">
                <Link className="btn btn-sm btn-ghost" to={`/programs/${p.id}`}>
                  مشاهده و ویرایش
                </Link>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>
                  حذف
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
