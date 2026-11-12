import { useSettings } from '../context/SettingsContext';
import { isLocalMode } from '../api/client';
import BackupCard from '../components/BackupCard';

function OptionCard({ selected, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        textAlign: 'right',
        cursor: 'pointer',
        borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
        borderWidth: selected ? 2 : 1,
        flex: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ marginBottom: 2 }}>{title}</h3>
          <p style={{ margin: 0 }}>{subtitle}</p>
        </div>
        {selected && <span className="badge badge-rust">انتخاب شده</span>}
      </div>
    </button>
  );
}

const SET_REST_PRESETS = [30, 45, 60, 90, 120, 180];
const EXERCISE_REST_PRESETS = [90, 120, 150, 180, 240];

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        {hint && <div className="muted">{hint}</div>}
      </div>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function RestPicker({ title, hint, value, presets, onChange }) {
  const custom = !presets.includes(value);
  return (
    <div className="field">
      <label>{title}</label>
      <div className="chip-row" style={{ marginTop: 0 }}>
        {presets.map((p) => (
          <button key={p} type="button" className={`chip${value === p ? ' active' : ''}`} onClick={() => onChange(p)}>
            {clock(p)}
          </button>
        ))}
        <span className={`chip chip-input${custom ? ' active' : ''}`}>
          <input
            type="number"
            min={5}
            max={900}
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(Math.min(900, Math.max(5, Number(e.target.value) || 5)))}
            aria-label={`${title} (ثانیه)`}
          />
          ثانیه
        </span>
      </div>
      <span className="muted">{hint}</span>
    </div>
  );
}

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function SettingsPage() {
  const { dateFormat, units, setDateFormat, setUnits, updateSettings, restTimerEnabled, restBetweenSets, restBetweenExercises, restAlert } =
    useSettings();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>تنظیمات</h1>
          <p>این تنظیمات فقط روی همین دستگاه ذخیره می‌شن و روی تاریخ، واحدها و تایمر تو کل اپ اثر می‌ذارن.</p>
        </div>
      </div>

      <div className="card">
        <h2>فرمت تاریخ</h2>
        <p>تاریخ‌ها (مثل تاریخ تمرین یا ثبت وزن) به این شکل نمایش داده و وارد می‌شن.</p>
        <div className="form-row" style={{ marginTop: 12 }}>
          <OptionCard
            selected={dateFormat === 'gregorian'}
            title="میلادی"
            subtitle="مثلاً 2026/09/16"
            onClick={() => setDateFormat('gregorian')}
          />
          <OptionCard
            selected={dateFormat === 'jalali'}
            title="شمسی"
            subtitle="مثلاً ۱۴۰۵/۰۶/۲۵"
            onClick={() => setDateFormat('jalali')}
          />
        </div>
      </div>

      <div className="card">
        <h2>تایمر استراحت</h2>
        <p>وقتی توی «تمرین امروز» یه ست رو تیک می‌زنی، شمارش معکوس استراحت شروع می‌شه. این زمان‌ها برای تخمین کالری هم استفاده می‌شن.</p>
        <Toggle
          checked={restTimerEnabled}
          onChange={(v) => updateSettings({ restTimerEnabled: v })}
          label="شروع خودکار تایمر با تیک زدن ست"
        />
        <div style={{ opacity: restTimerEnabled ? 1 : 0.5, pointerEvents: restTimerEnabled ? 'auto' : 'none', marginTop: 8 }}>
          <RestPicker
            title="استراحت بین ست‌ها"
            hint="بعد از هر ست به‌جز ست آخرِ هر حرکت"
            value={restBetweenSets}
            presets={SET_REST_PRESETS}
            onChange={(v) => updateSettings({ restBetweenSets: v })}
          />
          <RestPicker
            title="استراحت بین حرکت‌ها"
            hint="بعد از ست آخرِ هر حرکت، قبل از رفتن به حرکت بعدی"
            value={restBetweenExercises}
            presets={EXERCISE_REST_PRESETS}
            onChange={(v) => updateSettings({ restBetweenExercises: v })}
          />
          <Toggle
            checked={restAlert}
            onChange={(v) => updateSettings({ restAlert: v })}
            label="صدا و لرزش وقتی استراحت تموم شد"
          />
        </div>
      </div>

      <div className="card">
        <h2>واحد قد و وزن</h2>
        <p>وزن بدن، وزنه‌ها، و قد پروفایل بر همین اساس نمایش داده می‌شن.</p>
        <div className="form-row" style={{ marginTop: 12 }}>
          <OptionCard
            selected={units === 'metric'}
            title="متریک"
            subtitle="کیلوگرم (kg) و سانتی‌متر (cm)"
            onClick={() => setUnits('metric')}
          />
          <OptionCard
            selected={units === 'imperial'}
            title="آمریکایی"
            subtitle="پوند (lb) و فوت/اینچ (ft/in)"
            onClick={() => setUnits('imperial')}
          />
        </div>
      </div>

      {isLocalMode && <BackupCard />}
    </div>
  );
}
