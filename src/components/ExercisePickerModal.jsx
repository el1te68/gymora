import { useMemo, useState } from 'react';
import Modal from './Modal';

/** Pick one exercise from the whole list (search + muscle filter). `disabledIds` are shown greyed-out. */
export default function ExercisePickerModal({ title, exercises, muscles, disabledIds = [], onPick, onClose }) {
  const [muscleFilter, setMuscleFilter] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (exercises || []).filter((ex) => {
      const okMuscle = !muscleFilter || ex.muscles.some((m) => m.muscleId === Number(muscleFilter));
      const okSearch = !term || ex.name.toLowerCase().includes(term) || (ex.englishName && ex.englishName.toLowerCase().includes(term));
      return okMuscle && okSearch;
    });
  }, [exercises, muscleFilter, search]);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-row" style={{ marginBottom: 10 }}>
        <select className="input" value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value)}>
          <option value="">همه عضله‌ها</option>
          {(muscles || []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="input"
          placeholder="جستجو (فارسی یا انگلیسی)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      <div className="pick-list">
        {filtered.length === 0 && <p className="muted" style={{ padding: 8 }}>چیزی پیدا نشد.</p>}
        {filtered.map((ex) => {
          const disabled = disabledIds.includes(ex.id);
          return (
            <button key={ex.id} type="button" className="pick-row" disabled={disabled} onClick={() => onPick(ex)}>
              <span>{ex.name}</span>
              <span className="muted">{disabled ? 'قبلاً اضافه شده' : ex.englishName || ''}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
