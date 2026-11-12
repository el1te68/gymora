import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { api } from '../api/client';
import { ErrorBanner } from './Feedback';
import { localIso } from '../utils/nutrition';

const LAST_KEY = 'gymora-last-backup';

function readLast() {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

function writeLast(value) {
  try {
    localStorage.setItem(LAST_KEY, value);
  } catch {
    // storage unavailable - the reminder just won't show
  }
}

async function saveOrShare(fileName, text) {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const written = await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'پشتیبان Gymora', text: 'پشتیبان Gymora', url: written.uri, dialogTitle: 'ذخیره‌ی پشتیبان' });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Export / import of the on-device database (only shown in the offline app). */
export default function BackupCard() {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const last = readLast();

  async function handleExport() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api.exportData();
      await saveOrShare(`gymora-backup-${localIso()}.json`, JSON.stringify(data));
      writeLast(new Date().toISOString());
      setMessage('پشتیبان آماده شد. فایل را جایی امن (Google Drive، تلگرام، ایمیل به خودت...) نگه دار.');
    } catch (err) {
      // closing the share sheet rejects on some devices - that is not an error worth showing
      if (!/cancel/i.test(String(err?.message))) setError(err.message || 'ساخت پشتیبان انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (!window.confirm('همه‌ی اطلاعات فعلی اپ با این پشتیبان جایگزین می‌شود. ادامه می‌دهی؟')) return;
      setBusy(true);
      await api.importData(parsed);
      setMessage('پشتیبان بازیابی شد. صفحه دوباره بارگذاری می‌شود...');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setError(err instanceof SyntaxError ? 'این فایل JSON معتبر نیست.' : err.message);
      setBusy(false);
    }
  }

  async function handleWipe() {
    if (!window.confirm('همه‌ی تمرین‌ها، وعده‌ها و وزن‌هایی که ثبت کرده‌ای پاک می‌شود و اپ مثل روز اول می‌شود. مطمئنی؟')) return;
    if (!window.confirm('این کار برگشت ندارد (مگر پشتیبان داشته باشی). واقعاً پاک شود؟')) return;
    setBusy(true);
    try {
      await api.wipeData();
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>پشتیبان‌گیری</h2>
      <p>
        همه‌ی اطلاعات این اپ فقط روی همین گوشی ذخیره می‌شود. اگر اپ را پاک کنی یا گوشی را عوض کنی، بدون پشتیبان چیزی نمی‌ماند؛ پس هر چند وقت یک بار پشتیبان بگیر.
      </p>
      <p className="muted">{last ? `آخرین پشتیبان: ${new Date(last).toLocaleDateString('fa-IR')}` : 'هنوز پشتیبانی نگرفته‌ای.'}</p>
      <ErrorBanner message={error} />
      {message && <div className="backup-note">{message}</div>}
      <div className="backup-actions">
        <button className="btn btn-primary" onClick={handleExport} disabled={busy}>
          گرفتن پشتیبان
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          بازیابی از فایل
        </button>
        <button className="btn btn-danger" onClick={handleWipe} disabled={busy}>
          پاک کردن همه‌ی داده‌ها
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={handleFile} />
      </div>
    </div>
  );
}
