export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div className="h-full bg-action" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
