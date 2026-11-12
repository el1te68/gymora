import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { EmptyState, ErrorBanner, Loading } from '../components/Feedback';
import Modal from '../components/Modal';
import FoodForm from '../components/FoodForm';
import { baseUnitShort, fmt } from '../utils/nutrition';

const PAGE = 100;

export default function FoodsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [customOnly, setCustomOnly] = useState(false);
  const [take, setTake] = useState(PAGE);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setTake(PAGE);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: categories } = useFetch(api.getFoodCategories, []);
  const { data: foods, loading, error, reload } = useFetch(
    () => api.getFoods({ search, category: category || undefined, customOnly: customOnly || undefined, take }),
    [search, category, customOnly, take],
  );

  const [editing, setEditing] = useState(null); // null | 'new' | food
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function openEdit(food) {
    setFormError(null);
    try {
      setEditing(await api.getFood(food.id));
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleSubmit(payload) {
    setSaving(true);
    setFormError(null);
    try {
      if (editing === 'new') await api.createFood(payload);
      else await api.updateFood(editing.id, payload);
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(food) {
    const msg = `«${food.name}» حذف شود؟\nثبت‌های قبلی‌ات در دفترچه‌ی تغذیه دست‌نخورده می‌مانند.`;
    if (!window.confirm(msg)) return;
    setActionError(null);
    try {
      await api.deleteFood(food.id);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  const list = foods ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>غذاها</h1>
          <p>همه‌ی غذاها (حتی غذاهای آماده) قابل ویرایش‌اند. اعداد برای ۱۰۰ گرم یا ۱۰۰ میلی‌لیتر است.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setFormError(null);
            setEditing('new');
          }}
        >
          + غذای جدید
        </button>
      </div>

      <ErrorBanner message={error || actionError} />

      <div className="card">
        <div className="form-row" style={{ alignItems: 'center' }}>
          <input className="input" placeholder="جستجو: نام، برند یا نام انگلیسی..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <select
            className="input"
            style={{ maxWidth: 220 }}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setTake(PAGE);
            }}
          >
            <option value="">همه دسته‌ها</option>
            {(categories ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={customOnly}
              onChange={(e) => {
                setCustomOnly(e.target.checked);
                setTake(PAGE);
              }}
            />
            فقط غذاهای من
          </label>
        </div>

        {loading && !foods && <Loading />}
        {foods && list.length === 0 && (
          <EmptyState
            text={customOnly ? 'هنوز غذای دلخواهی نساخته‌ای.' : 'چیزی پیدا نشد.'}
            action={
              <button className="btn btn-primary" onClick={() => setEditing('new')}>
                ساخت غذای جدید
              </button>
            }
          />
        )}

        {list.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>نام</th>
                  <th>دسته</th>
                  <th>کالری</th>
                  <th>پروتئین</th>
                  <th>کربو</th>
                  <th>قند</th>
                  <th>چربی</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.name}</strong> {f.brand && <span className="badge">{f.brand}</span>}{' '}
                      {f.isCustom && <span className="badge badge-rust">من</span>}
                      <div className="muted">در ۱۰۰ {baseUnitShort(f.baseUnit)}</div>
                    </td>
                    <td>{f.category}</td>
                    <td>{fmt(f.caloriesPer100)}</td>
                    <td>{fmt(f.proteinPer100, 1)}</td>
                    <td>{fmt(f.carbsPer100, 1)}</td>
                    <td>{fmt(f.sugarPer100, 1)}</td>
                    <td>{fmt(f.fatPer100, 1)}</td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-sm" onClick={() => openEdit(f)}>
                          ویرایش
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(f)} aria-label="حذف">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {list.length >= take && take < 500 && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="btn" onClick={() => setTake((t) => t + PAGE)}>
              نمایش بیشتر
            </button>
          </div>
        )}
        {list.length >= take && take >= 500 && <p className="muted">برای دیدن بقیه، جستجو را دقیق‌تر کن.</p>}
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'غذای جدید' : `ویرایش «${editing.name}»`} wide onClose={() => setEditing(null)}>
          <FoodForm
            food={editing === 'new' ? null : editing}
            categories={categories ?? []}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
            saving={saving}
            error={formError}
          />
        </Modal>
      )}
    </div>
  );
}
