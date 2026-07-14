import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LocalContentRepository } from "@/lib/repositories/content-repository";
import { getStructuredTestBundle } from "@/lib/structured-content";

function formatPercent(value?: number) {
  if (typeof value !== "number") return "n/a";
  return `${Math.round(value * 100)}%`;
}

export default async function TestEditorPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const test = await new LocalContentRepository().getTestById(testId);
  const bundle = await getStructuredTestBundle(testId, { includeDrafts: true });
  if (!test && !bundle) notFound();
  const questions = bundle?.test.sections.flatMap((section) => section.modules.flatMap((module) => module.questions)) || [];
  const report = bundle?.importReport;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted">Import editor</p>
          <h1 className="text-2xl font-semibold">{bundle?.test.title || test?.title || testId}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            This page is for reviewing generated structure. Raw PDFs remain source evidence, while the published exam renders passages, questions, options, audio, and answers from JSON.
          </p>
        </div>
        <div className="flex gap-2">
          <Button href="/admin/import">Import home</Button>
          <Button href={`/tests/${testId}`} variant="primary">Open test</Button>
        </div>
      </div>

      <section className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-xs uppercase text-muted">Status</div>
          <div className="mt-1 text-xl font-semibold">{bundle?.test.status || "raw only"}</div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-xs uppercase text-muted">Questions</div>
          <div className="mt-1 text-xl font-semibold">{questions.length}</div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-xs uppercase text-muted">Needs review</div>
          <div className="mt-1 text-xl font-semibold">{questions.filter((question) => question.needsReview).length}</div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-xs uppercase text-muted">Matched audio</div>
          <div className="mt-1 text-xl font-semibold">{report?.matchedAudio ?? bundle?.audioGroups.length ?? 0}</div>
        </div>
      </section>

      {report ? (
        <section className="mt-6 rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Import report</h2>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <div>PDF files: <span className="font-semibold">{report.sourceSummary.pdfFiles}</span></div>
            <div>Audio files: <span className="font-semibold">{report.sourceSummary.audioFiles}</span></div>
            <div>Pages rendered: <span className="font-semibold">{report.sourceSummary.pagesRendered}</span></div>
            <div>Text-layer pages: <span className="font-semibold">{report.sourceSummary.pagesWithTextLayer}</span></div>
            <div>OCR-needed pages: <span className="font-semibold">{report.sourceSummary.pagesNeedingOcr}</span></div>
            <div>Imported answers: <span className="font-semibold">{report.importedAnswers}</span></div>
          </div>
          <div className="mt-3 grid gap-1 text-sm text-muted">
            {report.notes.map((note) => <p key={note}>{note}</p>)}
          </div>
        </section>
      ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Generated questions</h2>
          <div className="mt-3 grid gap-3">
            {questions.map((question) => (
              <article key={question.id} className="rounded-md border border-line p-4 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">Q{question.number} · {question.type}</div>
                  <div className="text-xs text-muted">page {question.sourcePage || "n/a"} · confidence {formatPercent(question.confidence)}</div>
                </div>
                <p className="mt-2 text-sm">{question.prompt || question.instructions || "No prompt text yet."}</p>
                {question.options?.length ? (
                  <div className="mt-3 grid gap-1 text-sm text-muted">
                    {question.options.map((option) => <div key={option.id}>{option.label || option.id}. {option.text}</div>)}
                  </div>
                ) : null}
                {question.needsReview ? <div className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">Needs manual review</div> : null}
              </article>
            ))}
            {questions.length === 0 ? <p className="text-sm text-muted">No generated questions yet. Run the import pipeline, then add or review structured JSON.</p> : null}
          </div>
        </div>

        <aside className="grid gap-4">
          <section className="rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">Assets</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {bundle?.assets.map((asset) => (
                <div key={asset.id} className="rounded-md bg-slate-100 p-2 dark:bg-slate-950">
                  <div className="font-medium">{asset.type}</div>
                  <div className="break-all text-xs text-muted">{asset.file}</div>
                </div>
              ))}
              {!bundle?.assets.length ? <p className="text-sm text-muted">No structured asset records yet.</p> : null}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">Audio groups</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {bundle?.audioGroups.map((audio) => (
                <div key={audio.id} className="rounded-md bg-slate-100 p-2 dark:bg-slate-950">
                  <div className="font-medium">{audio.title || audio.id}</div>
                  <div className="text-xs text-muted">asset {audio.audioAssetId} · replay {audio.allowReplay ? "yes" : "no"}</div>
                </div>
              ))}
              {!bundle?.audioGroups.length ? <p className="text-sm text-muted">No audio groups matched.</p> : null}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
