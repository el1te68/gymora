import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { ErrorBanner, Loading } from '../components/Feedback';
import DateField from '../components/DateField';
import DateText from '../components/DateText';
import FoodPickerModal from '../components/FoodPickerModal';
import { CalorieRing, MacroBar, MacroChips } from '../components/NutrientBars';
import { NUTRIENTS, MEAL_LABEL, addDaysIso, describeAmount, fmt, localIso, weekdayName } from '../utils/nutrition';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function NutritionPage() {
  const [params, setParams] = useSearchParams();
  const today = localIso();
  const paramDate = params.get('date');
  const date = paramDate && ISO_RE.test(paramDate) ? paramDate : today;

  const { data: day, loading, error, reload } = useFetch(() => api.getFoodLog(date), [date]);
  const { data: targets } = useFetch(() => api.getNutritionTargets(today), [today]);

  const [modal, setModal] = useState(null); // { meal, entry? }
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  function goTo(iso) {
    setParams(iso === today ? {} : { date: iso }, { replace: true });
  }

  async function handleDelete(entry) {
    if (!window.confirm(`«${entry.foodName}» از این وعده حذف شود؟`)) return;
    setActionError(null);
    try {
      await api.deleteFoodLogEntry(entry.id);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleCopyPrevious(meal) {
    setActionError(null);
    setBusy(true);
    try {
      const copied = await api.copyFoodLog({
        fromDate: addDaysIso(date, -1),
        fromMeal: meal,
        toDate: date,
        toMeal: meal,
      });
      if (copied?.meals?.find((m) => m.mealType === meal)?.entries.length === 0) setActionError(`در روز قبل چیزی برای ${MEAL_LABEL[meal]} ثبت نشده بود.`);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const eff = targets?.effective;
  const totals = day?.totals;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>تغذیه</h1>
          <p>
            {weekdayName(date)} · <DateText iso={date} />
            {date === today && ' (امروز)'}
          </p>
        </div>
        <div className="date-nav">
          <button className="btn btn-sm" onClick={() => goTo(addDaysIso(date, -1))} aria-label="روز قبل">
            ‹ روز قبل
          </button>
          <div style={{ minWidth: 150 }}>
            <DateField value={date} onChange={(v) => v && goTo(v)} yearsBack={5} yearsForward={1} />
          </div>
          <button className="btn btn-sm" onClick={() => goTo(addDaysIso(date, 1))} aria-label="روز بعد">
            روز بعد ›
          </button>
          {date !== today && (
            <button className="btn btn-sm btn-primary" onClick={() => goTo(today)}>
              امروز
            </button>
          )}
        </div>
      </div>

      <ErrorBanner message={error || actionError} />
      {loading && !day && <Loading />}

      {day && (
        <>
          <div className="card summary-card">
            <CalorieRing consumed={totals.calories} target={eff?.calories} />
            <div className="summary-bars">
              {NUTRIENTS.map((n) => (
                <MacroBar key={n.key} label={n.label} color={n.color} value={totals[n.key]} target={eff?.[`${n.key}G`]} />
              ))}
              <MacroBar label="قند" color="var(--color-sugar)" value={totals.sugar} target={eff?.sugarMaxG} max />
              {!eff?.calories && (
                <div className="no-target-hint">
                  هدف روزانه هنوز تنظیم نشده. <Link to="/nutrition/goals">برو به «هدف تغذیه»</Link> تا کالری و ماکروهای پیشنهادی را ببینی.
                </div>
              )}
            </div>
          </div>

          <div className="meal-grid">
            {day.meals.map((meal) => (
              <div className="card" key={meal.mealType}>
                <div className="meal-head">
                  <h2>{MEAL_LABEL[meal.mealType]}</h2>
                  <span className="meal-kcal">{fmt(meal.totals.calories)} کیلوکالری</span>
                </div>
                {meal.entries.length > 0 && <MacroChips totals={meal.totals} />}
                {meal.entries.length === 0 && <p className="muted" style={{ margin: '8px 0' }}>هنوز چیزی ثبت نشده.</p>}
                <div style={{ marginTop: 6 }}>
                  {meal.entries.map((entry) => (
                    <div className="entry-row" key={entry.id}>
                      <div className="entry-main">
                        <div className="entry-name">
                          {entry.foodName}
                          {entry.foodBrand && <span className="badge">{entry.foodBrand}</span>}
                        </div>
                        <div className="entry-amount">{describeAmount(entry)}</div>
                        <MacroChips totals={entry} />
                      </div>
                      <div className="entry-side">
                        <div className="entry-kcal">{fmt(entry.calories)}</div>
                        <div className="actions" style={{ marginTop: 4 }}>
                          <button className="btn btn-sm" onClick={() => setModal({ meal: meal.mealType, entry })}>
                            ویرایش
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(entry)} aria-label="حذف">
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="meal-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => setModal({ meal: meal.mealType })}>
                    + افزودن غذا
                  </button>
                  {meal.entries.length === 0 && (
                    <button className="btn btn-sm" disabled={busy} onClick={() => handleCopyPrevious(meal.mealType)}>
                      کپی از روز قبل
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modal && (
        <FoodPickerModal
          date={date}
          meal={modal.meal}
          entry={modal.entry}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
