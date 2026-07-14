import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-line bg-panel p-4 dark:border-slate-700 dark:bg-slate-950 lg:block">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Sections</div>
      <div className="mt-3 grid gap-2 text-sm">
        <Link href="/tests" className="rounded-md px-3 py-2 hover:bg-white dark:hover:bg-slate-900">All tests</Link>
        <Link href="/mistakes" className="rounded-md px-3 py-2 hover:bg-white dark:hover:bg-slate-900">Mistake book</Link>
        <Link href="/vocabulary" className="rounded-md px-3 py-2 hover:bg-white dark:hover:bg-slate-900">Vocabulary</Link>
        <Link href="/account" className="rounded-md px-3 py-2 hover:bg-white dark:hover:bg-slate-900">Account</Link>
        <Link href="/settings" className="rounded-md px-3 py-2 hover:bg-white dark:hover:bg-slate-900">Settings</Link>
      </div>
    </aside>
  );
}
