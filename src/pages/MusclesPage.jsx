import { useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading, EmptyState } from '../components/Feedback';

export default function MusclesPage() {
  const { data: muscles, loading, error, reload } = useFetch(api.getMuscles, []);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.createMuscle({ name: name.trim() });
      setName('');
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(muscle) {
    setEditingId(muscle.id);
    setEditingName(muscle.name);
  }

  async function saveEdit(id) {
    try {
      await api.updateMuscle(id, { name: editingName.trim() });
      setEditingId(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('این عضله حذف بشه؟ اگر توی حرکتی استفاده شده باشه ممکنه خطا بگیری.')) return;
    try {
      await api.deleteMuscle(id);
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>عضله‌ها</h1>
          <p>لیست کامل عضله‌هایی که برای برچسب‌زدن حرکات استفاده می‌شن.</p>
        </div>
      </div>

      <ErrorBanner message={error || formError} />

      <div className="card">
        <form onSubmit={handleCreate} className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="muscle-name">افزودن عضله جدید</label>
            <input
              id="muscle-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: ساعد"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving || !name.trim()}>
            افزودن
          </button>
        </form>
      </div>

      <div className="card">
        {loading && <Loading />}
        {!loading && muscles?.length === 0 && <EmptyState text="هنوز هیچ عضله‌ای ثبت نشده." />}
        {!loading && muscles?.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>نام عضله</th>
                <th style={{ width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {muscles.map((m) => (
                <tr key={m.id}>
                  <td>
                    {editingId === m.id ? (
                      <input
                        className="input"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      m.name
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      {editingId === m.id ? (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => saveEdit(m.id)}>
                            ذخیره
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>
                            انصراف
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-sm btn-ghost" onClick={() => startEdit(m)}>
                            ویرایش
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(m.id)}>
                            حذف
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
