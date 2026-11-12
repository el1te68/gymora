import { useEffect, useRef, useState } from 'react';

export default function ExercisePickerField({ exercises, muscles, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [muscleFilter, setMuscleFilter] = useState('');
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const selected = exercises.find((ex) => ex.id === Number(value));

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = exercises.filter((ex) => {
    const matchesMuscle = !muscleFilter || ex.muscles.some((m) => m.muscleId === Number(muscleFilter));
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      ex.name.toLowerCase().includes(term) ||
      (ex.englishName && ex.englishName.toLowerCase().includes(term));
    return matchesMuscle && matchesSearch;
  });

  function pick(ex) {
    onChange(ex.id);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="exercise-picker" ref={containerRef}>
      <button
        type="button"
        className="input exercise-picker-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? selected.name : 'انتخاب حرکت...'}
      </button>

      {open && (
        <div className="exercise-picker-panel">
          <div className="form-row" style={{ marginBottom: 8 }}>
            <select
              className="input"
              value={muscleFilter}
              onChange={(e) => setMuscleFilter(e.target.value)}
            >
              <option value="">همه عضله‌ها</option>
              {muscles.map((m) => (
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
          <div className="exercise-picker-list">
            {filtered.length === 0 && <p className="muted" style={{ padding: '8px 4px' }}>چیزی پیدا نشد.</p>}
            {filtered.map((ex) => (
              <div
                key={ex.id}
                className={`exercise-picker-item${ex.id === selected?.id ? ' selected' : ''}`}
                onClick={() => pick(ex)}
              >
                {ex.name}
                {ex.englishName && <span className="muted"> · {ex.englishName}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
