import { useCallback, useEffect, useRef, useState } from 'react';

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

let audioCtx = null;
function getAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx ??= new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function beep() {
  const ctx = getAudio();
  if (!ctx) return;
  [0, 0.28, 0.56].forEach((offset, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 2 ? 1175 : 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.22);
  });
}

/**
 * Rest countdown. It stores the END time (not a decrementing counter), so it stays correct even when the
 * browser throttles timers while the screen is off or the app is in the background.
 */
export function useRestTimer({ alert = true } = {}) {
  const [timer, setTimer] = useState(null); // { endAt, total, label }
  const [now, setNow] = useState(() => Date.now());
  const alertedRef = useRef(false);

  const remaining = timer ? Math.max(0, Math.ceil((timer.endAt - now) / 1000)) : 0;
  const finished = !!timer && remaining === 0;

  useEffect(() => {
    if (!timer) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!finished || alertedRef.current) return undefined;
    alertedRef.current = true;
    if (alert) {
      beep();
      try {
        navigator.vibrate?.([300, 120, 300, 120, 500]);
      } catch {
        // vibration is optional
      }
    }
    const hide = setTimeout(() => setTimer(null), 12000);
    return () => clearTimeout(hide);
  }, [finished, alert]);

  const start = useCallback((seconds, label) => {
    getAudio(); // unlock sound while we're still inside the tap that started the timer
    alertedRef.current = false;
    setNow(Date.now());
    setTimer({ endAt: Date.now() + seconds * 1000, total: seconds, label });
  }, []);

  const adjust = useCallback((delta) => {
    setTimer((t) => {
      if (!t) return t;
      const base = Math.max(Date.now(), t.endAt);
      const endAt = Math.max(Date.now() + 1000, base + delta * 1000);
      alertedRef.current = false;
      return { ...t, endAt, total: Math.max(5, t.total + delta) };
    });
    setNow(Date.now());
  }, []);

  const stop = useCallback(() => setTimer(null), []);

  return { active: !!timer, label: timer?.label, total: timer?.total ?? 0, remaining, finished, start, adjust, stop };
}

export function RestTimerBar({ rest }) {
  if (!rest.active) return null;
  const pct = rest.total > 0 ? Math.min(100, ((rest.total - rest.remaining) / rest.total) * 100) : 100;

  return (
    <div className={`rest-bar${rest.finished ? ' done' : ''}`} role="timer" aria-live="polite">
      <div className="rest-bar-progress" style={{ width: `${pct}%` }} />
      <div className="rest-bar-body">
        <div className="rest-bar-info">
          <span className="rest-bar-label">{rest.finished ? 'وقت استراحت تموم شد' : rest.label}</span>
          <span className="rest-bar-clock">{rest.finished ? 'برو سراغ ست بعدی 💪' : formatClock(rest.remaining)}</span>
        </div>
        <div className="rest-bar-actions">
          <button type="button" className="rest-btn" dir="ltr" onClick={() => rest.adjust(-15)} aria-label="۱۵ ثانیه کمتر">
            −۱۵
          </button>
          <button type="button" className="rest-btn" dir="ltr" onClick={() => rest.adjust(15)} aria-label="۱۵ ثانیه بیشتر">
            +۱۵
          </button>
          <button type="button" className="rest-btn rest-btn-skip" onClick={rest.stop}>
            {rest.finished ? 'باشه' : 'رد کردن'}
          </button>
        </div>
      </div>
    </div>
  );
}
