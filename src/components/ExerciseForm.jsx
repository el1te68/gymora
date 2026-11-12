import { useState } from 'react';

const ROLE_LABEL = { Primary: 'اصلی', Secondary: 'کمکی' };

function toFormMuscles(muscles) {
  const map = {};
  for (const m of muscles || []) {
    map[m.muscleId] = m.role;
  }
  return map;
}

export default function ExerciseForm({ allMuscles, initial, onSubmit, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || '');
  const [englishName, setEnglishName] = useState(initial?.englishName || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [muscleRoles, setMuscleRoles] = useState(toFormMuscles(initial?.muscles));

  function toggleMuscle(muscleId, checked) {
    setMuscleRoles((prev) => {
      const next = { ...prev };
      if (checked) {
        next[muscleId] = 'Primary';
      } else {
        delete next[muscleId];
      }
      return next;
    });
  }

  function setRole(muscleId, role) {
    setMuscleRoles((prev) => ({ ...prev, [muscleId]: role }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const muscles = Object.entries(muscleRoles).map(([muscleId, role]) => ({
      muscleId: Number(muscleId),
      role,
    }));
    onSubmit({
      name: name.trim(),
      englishName: englishName.trim() || null,
      description: description.trim() || null,
      muscles,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="ex-name">نام حرکت</label>
        <input
          id="ex-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثلاً: پرس سینه هالتر"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="ex-english-name">نام انگلیسی (اختیاری - برای سرچ)</label>
        <input
          id="ex-english-name"
          className="input"
          dir="ltr"
          value={englishName}
          onChange={(e) => setEnglishName(e.target.value)}
          placeholder="e.g. Barbell Bench Press"
        />
      </div>

      <div className="field">
        <label htmlFor="ex-desc">توضیحات (اختیاری)</label>
        <textarea
          id="ex-desc"
          className="input"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="field">
        <label>عضله‌های درگیر</label>
        <div className="card" style={{ padding: 12 }}>
          {allMuscles.map((m) => {
            const checked = muscleRoles[m.id] !== undefined;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 2px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleMuscle(m.id, e.target.checked)}
                  />
                  {m.name}
                </label>
                {checked && (
                  <select
                    className="input"
                    style={{ width: 110 }}
                    value={muscleRoles[m.id]}
                    onChange={(e) => setRole(m.id, e.target.value)}
                  >
                    <option value="Primary">{ROLE_LABEL.Primary}</option>
                    <option value="Secondary">{ROLE_LABEL.Secondary}</option>
                  </select>
                )}
              </div>
            );
          })}
          {allMuscles.length === 0 && (
            <p className="muted">هنوز عضله‌ای تعریف نشده - اول از صفحه‌ی «عضله‌ها» چندتا اضافه کن.</p>
          )}
        </div>
      </div>

      <div className="actions" style={{ marginTop: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
          {saving ? 'در حال ذخیره...' : 'ذخیره'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          انصراف
        </button>
      </div>
    </form>
  );
}

export { ROLE_LABEL };
