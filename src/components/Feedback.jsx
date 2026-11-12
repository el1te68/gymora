export function Loading({ text = 'در حال بارگذاری...' }) {
  return <div className="loading-hint">{text}</div>;
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="error-banner">{message}</div>;
}

export function EmptyState({ text, action }) {
  return (
    <div className="empty-state">
      <p>{text}</p>
      {action}
    </div>
  );
}
