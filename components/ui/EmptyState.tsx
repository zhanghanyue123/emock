export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-panel p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-base font-semibold text-ink dark:text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-muted dark:text-slate-400">{body}</p>
    </div>
  );
}
