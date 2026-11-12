import { useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading, EmptyState } from '../components/Feedback';
import DateField from '../components/DateField';
import DateText from '../components/DateText';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { todayIso } from '../utils/dates';

export default function BodyWeightPage() {
  const { data: logs, loading, error, reload } = useFetch(api.getBodyWeightLogs, []);
  const weightUnit = useWeightUnit();

  const [logDate, setLogDate] = useState(todayIso());
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const sorted = logs ? [...logs].sort((a, b) => (a.logDate < b.logDate ? 1 : -1)) : [];
  const latest = sorted[0];
  const previous = sorted[1];
  const delta =
    latest && previous
      ? (weightUnit.toDisplay(latest.weightKg) - weightUnit.toDisplay(previous.weightKg)).toFixed(1)
      : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.createBodyWeightLog({ logDate, weightKg: weightUnit.toKg(weightInput) });
      setWeightInput('');
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('این رکورد وزن حذف بشه؟')) return;
    await api.deleteBodyWeightLog(id);
    reload();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>وزن بدن</h1>
          <p>وزنت رو هر هفته ثبت کن تا روند تغییرش رو ببینی.</p>
        </div>
      </div>

      <ErrorBanner message={error || formError} />

      {latest && (
        <div className="card">
          <div className="stat-row">
            <div className="stat">
              <div className="value">
                {weightUnit.toDisplay(latest.weightKg)} {weightUnit.unitLabel}
              </div>
              <div className="label">
                آخرین ثبت (<DateText iso={latest.logDate} />)
              </div>
            </div>
            {delta !== null && (
              <div className="stat">
                <div className="value">
                  {delta > 0 ? `+${delta}` : delta} {weightUnit.unitLabel}
                </div>
                <div className="label">نسبت به ثبت قبلی</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3>ثبت وزن جدید</h3>
        <form onSubmit={handleSubmit} className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>تاریخ</label>
            <DateField value={logDate} onChange={setLogDate} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>وزن ({weightUnit.unitLabel})</label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            ثبت
          </button>
        </form>
      </div>

      <div className="card">
        {loading && <Loading />}
        {!loading && sorted.length === 0 && <EmptyState text="هنوز وزنی ثبت نشده." />}
        {!loading && sorted.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>وزن ({weightUnit.unitLabel})</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => (
                <tr key={l.id}>
                  <td>
                    <DateText iso={l.logDate} />
                  </td>
                  <td>{weightUnit.toDisplay(l.weightKg)}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(l.id)}>
                      حذف
                    </button>
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
