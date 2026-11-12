import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading } from './Feedback';
import Modal from './Modal';
import FoodForm from './FoodForm';
import {
  baseUnitLabel,
  fmt,
  MEALS,
  MEAL_LABEL,
  parseNumber,
  scalePer100,
} from '../utils/nutrition';

const LAST_UNIT_KEY = 'gymora-last-unit:';

function rememberUnit(foodId, unit) {
  try {
    localStorage.setItem(LAST_UNIT_KEY + foodId, String(unit));
  } catch {
    // not worth surfacing
  }
}

function recallUnit(foodId) {
  try {
    return localStorage.getItem(LAST_UNIT_KEY + foodId);
  } catch {
    return null;
  }
}

function FoodRow({ food, onPick }) {
  return (
    <button type="button" className="food-row" onClick={() => onPick(food)}>
      <span className="food-row-main">
        <span className="food-row-name">{food.name}</span>
        {food.brand && <span className="badge">{food.brand}</span>}
        {food.isCustom && <span className="badge badge-rust">من</span>}
      </span>
      <span className="food-row-meta">
        {fmt(food.caloriesPer100)} کیلوکالری · پ {fmt(food.proteinPer100, 1)} · ک {fmt(food.carbsPer100, 1)} · چ {fmt(food.fatPer100, 1)}
        <span className="muted"> در ۱۰۰ {baseUnitLabel(food.baseUnit)}</span>
      </span>
    </button>
  );
}

/**
 * Add a food to a meal (search → amount) or edit an existing diary entry (amount only).
 * `entry` present = edit mode.
 */
export default function FoodPickerModal({ date, meal: initialMeal, entry, onClose, onSaved }) {
  const editing = Boolean(entry);
  const [step, setStep] = useState(editing ? 'loading' : 'search');
  const [food, setFood] = useState(null);
  const [meal, setMeal] = useState(entry?.mealType ?? initialMeal);
  const [unit, setUnit] = useState('base'); // 'base' | serving id (string)
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // ---------- search ----------
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: categories } = useFetch(api.getFoodCategories, []);
  const { data: recent } = useFetch(() => api.getRecentFoods(12), []);
  const searching = search !== '' || category !== '';
  const {
    data: results,
    loading: searchLoading,
    error: searchError,
  } = useFetch(() => (searching ? api.getFoods({ search, category: category || undefined, take: 60 }) : Promise.resolve([])), [
    search,
    category,
  ]);

  // ---------- edit mode: load the entry's food ----------
  useEffect(() => {
    if (!editing) return;
    if (entry.foodId == null) {
      setError('این غذا بعداً حذف شده؛ فقط می‌توانی این ثبت را حذف یا جابه‌جا کنی.');
      setStep('deleted');
      return;
    }
    let cancelled = false;
    api
      .getFood(entry.foodId)
      .then((f) => {
        if (cancelled) return;
        const match = f.servings.find((s) => s.label === entry.unitLabel);
        setFood(f);
        if (match) {
          setUnit(String(match.id));
          setQuantity(String(entry.quantity));
        } else {
          setUnit('base');
          setQuantity(String(entry.totalAmount));
        }
        setStep('amount');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStep('deleted');
      });
    return () => {
      cancelled = true;
    };
  }, [editing, entry]);

  function pickFood(f) {
    setFood(f);
    const last = recallUnit(f.id);
    if (last && last !== 'base' && f.servings.some((s) => String(s.id) === last)) {
      setUnit(last);
      setQuantity('1');
    } else {
      setUnit('base');
      setQuantity('100');
    }
    setError(null);
    setStep('amount');
  }

  const serving = unit === 'base' ? null : food?.servings.find((s) => String(s.id) === unit);
  const unitAmount = serving ? serving.amount : 1;
  const qty = parseNumber(quantity);
  const validQty = qty > 0 && qty <= 100000;
  const totalAmount = validQty ? Math.round(qty * unitAmount * 100) / 100 : 0;
  const nutrients = useMemo(() => (food && validQty ? scalePer100(food, totalAmount) : null), [food, validQty, totalAmount]);
  const baseLabel = food ? baseUnitLabel(food.baseUnit) : 'گرم';

  function changeUnit(value) {
    setUnit(value);
    setQuantity(value === 'base' ? '100' : '1');
  }

  function bump(delta) {
    const base = validQty ? qty : 0;
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    setQuantity(String(next));
  }

  async function handleSave() {
    if (!validQty) return setError('مقدار را به‌صورت یک عدد بزرگ‌تر از صفر وارد کن.');
    setSaving(true);
    setError(null);
    const payload = {
      logDate: date,
      mealType: meal,
      foodId: food.id,
      quantity: qty,
      servingId: serving ? serving.id : null,
    };
    try {
      if (editing) await api.updateFoodLogEntry(entry.id, payload);
      else await api.createFoodLogEntry(payload);
      rememberUnit(food.id, serving ? serving.id : 'base');
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleCreateFood(payload) {
    setSaving(true);
    setError(null);
    try {
      const created = await api.createFood(payload);
      setSaving(false);
      pickFood(created);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const title =
    step === 'create'
      ? 'غذای جدید'
      : step === 'amount'
        ? editing
          ? 'ویرایش مقدار'
          : 'مقدار را مشخص کن'
        : `افزودن به ${MEAL_LABEL[meal]}`;

  const quickChips = unit === 'base' ? [50, 100, 150, 200, 250] : [0.5, 1, 1.5, 2, 3, 4];

  return (
    <Modal title={title} onClose={onClose} wide={step === 'create'}>
      {step === 'loading' && <Loading />}

      {step === 'deleted' && (
        <div>
          <ErrorBanner message={error} />
          <button className="btn" onClick={onClose}>
            بستن
          </button>
        </div>
      )}

      {step === 'search' && (
        <div>
          <div className="form-row" style={{ marginBottom: 10 }}>
            <input
              className="input"
              placeholder="جستجوی غذا (فارسی یا انگلیسی، نام یا برند)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoFocus
            />
            <select className="input" style={{ maxWidth: 190 }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">همه دسته‌ها</option>
              {(categories ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <ErrorBanner message={searchError} />

          <div className="food-list">
            {!searching && recent && recent.length > 0 && (
              <>
                <div className="food-list-title">اخیراً استفاده‌شده</div>
                {recent.map((f) => (
                  <FoodRow key={f.id} food={f} onPick={pickFood} />
                ))}
              </>
            )}
            {!searching && (!recent || recent.length === 0) && (
              <p className="muted" style={{ padding: '12px 4px' }}>
                نام غذا را بنویس تا پیدا شود؛ مثلاً «سینه مرغ»، «برنج»، «whey» یا نام برند.
              </p>
            )}
            {searching && searchLoading && <Loading />}
            {searching && !searchLoading && results?.length === 0 && (
              <p className="muted" style={{ padding: '12px 4px' }}>
                چیزی پیدا نشد. می‌توانی همین غذا را خودت بسازی.
              </p>
            )}
            {searching && results?.map((f) => <FoodRow key={f.id} food={f} onPick={pickFood} />)}
          </div>

          <div className="modal-footer">
            <button className="btn btn-primary" onClick={() => setStep('create')}>
              + ساخت غذای جدید
            </button>
            <span className="muted">غذای خودت را با اعداد روی برچسب بساز؛ بعداً هم قابل ویرایش است.</span>
          </div>
        </div>
      )}

      {step === 'create' && (
        <FoodForm
          categories={categories ?? []}
          onSubmit={handleCreateFood}
          onCancel={() => {
            setError(null);
            setStep('search');
          }}
          saving={saving}
          error={error}
        />
      )}

      {step === 'amount' && food && (
        <div>
          <div className="picked-food">
            <div className="picked-food-name">
              {food.name} {food.brand && <span className="badge">{food.brand}</span>}
            </div>
            <div className="muted">
              در ۱۰۰ {baseLabel}: {fmt(food.caloriesPer100)} کیلوکالری · پروتئین {fmt(food.proteinPer100, 1)} · کربوهیدرات {fmt(food.carbsPer100, 1)} · قند{' '}
              {fmt(food.sugarPer100, 1)} · چربی {fmt(food.fatPer100, 1)}
            </div>
          </div>

          <ErrorBanner message={error} />

          <div className="form-row amount-row">
            <div className="field">
              <label>واحد</label>
              <select className="input" value={unit} onChange={(e) => changeUnit(e.target.value)}>
                <option value="base">{baseLabel}</option>
                {food.servings.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.label} (≈ {fmt(s.amount, 1)} {baseLabel})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>مقدار</label>
              <div className="qty-box">
                <button type="button" className="btn btn-sm" onClick={() => bump(unit === 'base' ? -10 : -0.5)} aria-label="کمتر">
                  −
                </button>
                <input
                  className="input qty-input"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                <button type="button" className="btn btn-sm" onClick={() => bump(unit === 'base' ? 10 : 0.5)} aria-label="بیشتر">
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="chip-row">
            {quickChips.map((c) => (
              <button key={c} type="button" className={`chip${qty === c ? ' active' : ''}`} onClick={() => setQuantity(String(c))}>
                {fmt(c, 1)}
              </button>
            ))}
          </div>

          <div className="preview-card">
            {nutrients ? (
              <>
                <div className="preview-main">
                  <span className="preview-kcal">{fmt(nutrients.calories)}</span> کیلوکالری
                  <span className="muted"> · مجموع {fmt(totalAmount, 1)} {baseLabel}</span>
                </div>
                <div className="preview-grid">
                  <div><span className="dot" style={{ background: 'var(--color-protein)' }} /> پروتئین <strong>{fmt(nutrients.protein, 1)}</strong></div>
                  <div><span className="dot" style={{ background: 'var(--color-carbs)' }} /> کربوهیدرات <strong>{fmt(nutrients.carbs, 1)}</strong></div>
                  <div><span className="dot" style={{ background: 'var(--color-sugar)' }} /> قند <strong>{fmt(nutrients.sugar, 1)}</strong></div>
                  <div><span className="dot" style={{ background: 'var(--color-fat)' }} /> چربی <strong>{fmt(nutrients.fat, 1)}</strong></div>
                </div>
              </>
            ) : (
              <span className="muted">مقدار معتبر وارد کن تا ارزش غذایی نمایش داده شود.</span>
            )}
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>وعده</label>
            <div className="segmented">
              {MEALS.map((m) => (
                <button key={m.key} type="button" className={meal === m.key ? 'active' : ''} onClick={() => setMeal(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !validQty}>
              {saving ? 'در حال ذخیره...' : editing ? 'ذخیره' : `افزودن به ${MEAL_LABEL[meal]}`}
            </button>
            {!editing && (
              <button className="btn" onClick={() => setStep('search')}>
                برگشت به جستجو
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>
              انصراف
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
