import { Button } from "@/components/ui/Button";
import { getAllTests } from "@/lib/content";

export default async function ImportAdminPage() {
  const tests = await getAllTests();
  const structured = tests.filter((test) => test.valid && Object.values(test.sections).some((section) => section.questions?.length));
  const rawOnly = tests.filter((test) => test.valid && !Object.values(test.sections).some((section) => section.questions?.length));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted">Local admin</p>
          <h1 className="text-2xl font-semibold">Import and structure tests</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            PDF and audio files are source materials. Formal practice should start only after a test has generated structured JSON and has been reviewed.
          </p>
        </div>
        <Button href="/tests">Open test library</Button>
      </div>

      <section className="mt-6 grid gap-3 rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Local pipeline</h2>
        <div className="grid gap-2 text-sm text-muted">
          <p>1. Put raw files under a content folder, then sync source files into the app.</p>
          <p>2. Run the import pipeline to register PDFs, match audio, preserve OCR review points, and regenerate the import report.</p>
          <p>3. Review and edit generated JSON before publishing the test for formal practice.</p>
        </div>
        <div className="rounded-md bg-slate-100 p-3 font-mono text-xs dark:bg-slate-950">npm run import-test -- --test test-001</div>
        <div className="rounded-md bg-slate-100 p-3 font-mono text-xs dark:bg-slate-950">npm run validate-test -- --test test-001</div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Structured tests</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {structured.map((test) => (
            <article key={test.id} className="rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="font-semibold">{test.title}</div>
              <div className="mt-1 text-xs text-muted">{test.id}</div>
              <div className="mt-3 flex gap-2">
                <Button href={`/admin/tests/${test.id}/editor`} variant="primary">Review generated data</Button>
                <Button href={`/tests/${test.id}`}>Open</Button>
              </div>
            </article>
          ))}
          {structured.length === 0 ? <p className="text-sm text-muted">No structured tests found yet.</p> : null}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Raw-only folders</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {rawOnly.slice(0, 12).map((test) => (
            <article key={test.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
              <div className="font-semibold">{test.title}</div>
              <div className="mt-1 text-xs opacity-80">{test.id}</div>
              <div className="mt-3"><Button href={`/admin/tests/${test.id}/editor`}>Open import editor</Button></div>
            </article>
          ))}
          {rawOnly.length === 0 ? <p className="text-sm text-muted">No raw-only folders found.</p> : null}
        </div>
      </section>
    </main>
  );
}
