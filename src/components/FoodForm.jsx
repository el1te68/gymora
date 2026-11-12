import { useMemo, useState } from 'react';
import { ErrorBanner } from './Feedback';
import { baseUnitLabel, fmt, macroEnergy, parseNumber, STATE_LABEL } from '../utils/nutrition';

const QUICK_UNITS = ['قاشق غذاخوری', 'قاشق چایخوری', 'لیوان', 'کف دست', 'مشت', 'عدد', 'اسکوپ', 'برش', 'کفگیر', 'بسته'];

const num = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * Create / edit a food. Numbers are entered for `basis` grams (or ml) - default 100 - and
 * converted to "per 100" on save, so the label of a package can be copied as-is.
 */
export default function FoodForm({ food, categories = [], onSubmit, onCancel, saving, error }) {
  const [name, setName] = useState(food?.name ?? '');
  const [englishName, setEnglishName] = useState(food?.englishName ?? '');
  const [brand, setBrand] = useState(food?.brand ?? '');
  const [category, setCategory] = useState(food?.category ?? '');
  const [baseUnit, setBaseUnit] = useState(food?.baseUnit ?? 'Gram');
  const [state, setState] = useState(food?.state ?? '');
  const [basis, setBasis] = useState('100');
  const [calories, setCalories] = useState(num(food?.caloriesPer100));
  const [protein, setProtein] = useState(num(food?.proteinPer100));
  const [carbs, setCarbs] = useState(num(food?.carbsPer100));
  const [sugar, setSugar] = useState(num(food?.sugarPer100));
  const [fat, setFat] = useState(num(food?.fatPer100));
  const [notes, setNotes] = useState(food?.notes ?? '');
  const [servings, setServings] = useState(
    (food?.servings ?? []).map((s) => ({ label: s.label, amount: num(s.amount) })),
  );
  const [localError, setLocalError] = useState(null);

  const unit = baseUnitLabel(baseUnit);
  const basisNum = parseNumber(basis);
  const factor = basisNum > 0 ? 100 / basisNum : NaN;

  const per100 = useMemo(() => {
    const conv = (v) => {
      const n = parseNumber(v);
      return Number.isNaN(n) || Number.isNaN(factor) ? 0 : Math.round(n * factor * 100) / 100;
    };
    return {
      caloriesPer100: conv(calories),
      proteinPer100: conv(protein),
      carbsPer100: conv(carbs),
      sugarPer100: conv(sugar),
      fatPer100: conv(fat),
    };
  }, [calories, protein, carbs, sugar, fat, factor]);

  const implied = macroEnergy(per100.proteinPer100, per100.carbsPer100, per100.fatPer100);
  const showEnergyHint = per100.caloriesPer100 > 0 || implied > 0;
  const energyMismatch =
    showEnergyHint && Math.abs(per100.caloriesPer100 - implied) > Math.max(25, 0.15 * implied);

  function fillCaloriesFromMacros() {
    const p = parseNumber(protein) || 0;
    const c = parseNumber(carbs) || 0;
    const f = parseNumber(fat) || 0;
    setCalories(String(Math.round(macroEnergy(p, c, f))));
  }

  function setServing(index, patch) {
    setServings((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addServing(label = '') {
    setServings((list) => (list.some((s) => s.label === label && label) ? list : [...list, { label, amount: '' }]));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setLocalError(null);

    if (!name.trim()) return setLocalError('نام غذا الزامی است.');
    if (Number.isNaN(factor)) return setLocalError('«مقدار مبنا» باید یک عدد بزرگ‌تر از صفر باشد.');
    for (const [label, v] of [['کالری', calories], ['پروتئین', protein], ['کربوهیدرات', carbs], ['قند', sugar], ['چربی', fat]]) {
      if (v !== '' && Number.isNaN(parseNumber(v))) return setLocalError(`مقدار «${label}» عدد معتبری نیست.`);
    }

    const cleanServings = [];
    for (const s of servings) {
      if (!s.label.trim() && s.amount === '') continue;
      const amount = parseNumber(s.amount);
      if (!s.label.trim() || !(amount > 0)) {
        return setLocalError('هر واحد باید هم نام داشته باشد و هم وزن (بزرگ‌تر از صفر).');
      }
      cleanServings.push({ label: s.label.trim(), amount });
    }

    onSubmit({
      name: name.trim(),
      englishName: englishName.trim() || null,
      brand: brand.trim() || null,
      category: category.trim() || null,
      baseUnit,
      state: state || null,
      ...per100,
      notes: notes.trim() || null,
      servings: cleanServings,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="food-form">
      <ErrorBanner message={localError || error} />

      <div className="form-row">
        <div className="field">
          <label>نام غذا *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="مثلاً مس گینر" />
        </div>
        <div className="field">
          <label>برند (اختیاری)</label>
          <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="مثلاً کاله" />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>نام انگلیسی (برای جستجو)</label>
          <input className="input" value={englishName} onChange={(e) => setEnglishName(e.target.value)} dir="ltr" />
        </div>
        <div className="field">
          <label>دسته‌بندی</label>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} list="food-categories" placeholder="سایر" />
          <datalist id="food-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>واحد پایه</label>
          <div className="segmented">
            <button type="button" className={baseUnit === 'Gram' ? 'active' : ''} onClick={() => setBaseUnit('Gram')}>
              گرم (جامد)
            </button>
            <button type="button" className={baseUnit === 'Milliliter' ? 'active' : ''} onClick={() => setBaseUnit('Milliliter')}>
              میلی‌لیتر (مایع)
            </button>
          </div>
        </div>
        <div className="field">
          <label>وضعیت</label>
          <select className="input" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">مشخص نشده</option>
            {Object.entries(STATE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-section">
        <h3>ارزش غذایی</h3>
        <div className="field basis-field">
          <label>اعداد زیر برای چند {unit} است؟</label>
          <div className="basis-row">
            <input className="input" style={{ maxWidth: 110 }} inputMode="decimal" value={basis} onChange={(e) => setBasis(e.target.value)} />
            <span className="muted">
              {unit}
              {Number(basisNum) !== 100 && !Number.isNaN(factor) && ' — موقع ذخیره خودکار به ۱۰۰ تبدیل می‌شود'}
            </span>
          </div>
          <span className="muted">اگر روی بسته نوشته «در هر ۳۰ گرم»، اینجا ۳۰ بزن و اعداد برچسب را همان‌طور وارد کن.</span>
        </div>

        <div className="nutrient-grid">
          <div className="field">
            <label>کالری (kcal)</label>
            <input className="input" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} />
          </div>
          <div className="field">
            <label>پروتئین (گرم)</label>
            <input className="input" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </div>
          <div className="field">
            <label>کربوهیدرات (گرم)</label>
            <input className="input" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
          </div>
          <div className="field">
            <label>قند (گرم)</label>
            <input className="input" inputMode="decimal" value={sugar} onChange={(e) => setSugar(e.target.value)} />
          </div>
          <div className="field">
            <label>چربی (گرم)</label>
            <input className="input" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
        </div>

        {showEnergyHint && (
          <div className={`hint-box${energyMismatch ? ' warn' : ''}`}>
            {energyMismatch ? (
              <>
                با پروتئین، کربوهیدرات و چربی واردشده، کالری حدود <strong>{fmt(implied)}</strong> می‌شود (در ۱۰۰ {unit}) ولی تو{' '}
                <strong>{fmt(per100.caloriesPer100)}</strong> وارد کرده‌ای. اگر روی برچسب همین است مشکلی نیست (فیبر و الکل‌های قندی کالری را تغییر می‌دهند).{' '}
                <button type="button" className="link-btn" onClick={fillCaloriesFromMacros}>
                  محاسبه‌ی کالری از ماکروها
                </button>
              </>
            ) : (
              <>
                در ۱۰۰ {unit}: {fmt(per100.caloriesPer100)} کیلوکالری، پروتئین {fmt(per100.proteinPer100, 1)}، کربوهیدرات {fmt(per100.carbsPer100, 1)}، چربی {fmt(per100.fatPer100, 1)} — با ماکروها همخوانی دارد ✓
              </>
            )}
          </div>
        )}
      </div>

      <div className="form-section">
        <h3>واحدهای خانگی</h3>
        <p className="muted" style={{ marginBottom: 8 }}>
          برای ثبت سریع‌تر، وزن یک واحد را بنویس؛ مثلاً «قاشق غذاخوری = ۱۲ {unit}» یا «اسکوپ = ۱۰۰ {unit}». خود {unit} همیشه هست.
        </p>
        <div className="chip-row">
          {QUICK_UNITS.map((u) => (
            <button key={u} type="button" className="chip" onClick={() => addServing(u)} disabled={servings.some((s) => s.label === u)}>
              + {u}
            </button>
          ))}
          <button type="button" className="chip" onClick={() => addServing('')}>
            + واحد دلخواه
          </button>
        </div>
        {servings.map((s, i) => (
          <div className="serving-row" key={i}>
            <input className="input" placeholder="نام واحد" value={s.label} onChange={(e) => setServing(i, { label: e.target.value })} />
            <span className="muted">=</span>
            <input className="input" style={{ maxWidth: 110 }} inputMode="decimal" placeholder={unit} value={s.amount} onChange={(e) => setServing(i, { amount: e.target.value })} />
            <span className="muted">{unit}</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setServings((l) => l.filter((_, j) => j !== i))} aria-label="حذف واحد">
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="field">
        <label>یادداشت (اختیاری)</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'در حال ذخیره...' : food ? 'ذخیره تغییرات' : 'ساخت غذا'}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          انصراف
        </button>
      </div>
    </form>
  );
}
