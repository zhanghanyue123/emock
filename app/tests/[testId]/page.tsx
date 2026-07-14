import { notFound } from "next/navigation";
import { SectionCard } from "@/components/tests/SectionCard";
import { Button } from "@/components/ui/Button";
import { SECTION_KEYS } from "@/lib/constants";
import { publicAssetPath } from "@/lib/assets";
import { LocalContentRepository } from "@/lib/repositories/content-repository";
import type { MaterialItem } from "@/types/test";

function MaterialList({ testId, materials }: { testId: string; materials: MaterialItem[] }) {
  const pdfs = materials.filter((item) => item.type === "pdf");
  const audio = materials.filter((item) => item.type === "audio");
  const primaryPdf = pdfs[0];
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="overflow-hidden rounded-lg border border-line bg-white dark:border-slate-700 dark:bg-slate-900">
        {primaryPdf ? (
          <iframe title={primaryPdf.title} src={publicAssetPath(testId, primaryPdf.file) || ""} className="h-[76vh] w-full" />
        ) : (
          <div className="p-6 text-sm text-muted">No PDF material found.</div>
        )}
      </div>
      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">PDF</h2>
          <div className="mt-3 space-y-2">
            {pdfs.map((item) => <Button key={item.id} href={publicAssetPath(testId, item.file) || "#"} target="_blank" className="w-full justify-start">{item.title}</Button>)}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Audio</h2>
          <div className="mt-3 max-h-[52vh] space-y-3 overflow-auto pr-1">
            {audio.length ? audio.map((item) => (
              <div key={item.id} className="rounded-md border border-line p-3 dark:border-slate-700">
                <p className="mb-2 text-sm font-medium">{item.title}</p>
                <audio controls className="w-full" src={publicAssetPath(testId, item.file) || ""} />
              </div>
            )) : <p className="text-sm text-muted">No audio material found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function TestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const test = await new LocalContentRepository().getTestById(testId);
  if (!test) notFound();
  const isReady = test.overallStatus === "ready";
  const isMaterials = test.kind === "materials";
  const totalMinutes = SECTION_KEYS.reduce((sum, key) => sum + (test.sections[key]?.durationMinutes || 0), 0);
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Button href="/tests" variant="ghost">Back to tests</Button>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs uppercase text-muted">{test.id}</p><h1 className="text-2xl font-semibold">{test.title}</h1><p className="mt-1 text-sm text-muted">{test.description}</p></div>
        <div className="flex flex-wrap gap-2">
          {isReady ? <Button href={`/practice/${test.id}/reading?mode=exam`} variant="primary">Exam mode</Button> : null}
          {isReady ? <Button href={`/practice/${test.id}/reading?mode=review`}>Review mode</Button> : null}
          {!isReady && !isMaterials ? <span className="rounded-full border border-line px-3 py-2 text-sm text-muted">未开始</span> : null}
        </div>
      </div>
      {test.materials?.length ? <MaterialList testId={test.id} materials={test.materials} /> : null}
      {test.reviewMaterials?.length && !isMaterials ? (
        <div className="mt-6 rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">复盘资料</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {test.reviewMaterials.map((item) => <Button key={item.id} href={publicAssetPath(test.id, item.file) || "#"} target="_blank">{item.title}</Button>)}
          </div>
        </div>
      ) : null}
      {isMaterials ? null : (
      <>
      <div className="mt-6 grid gap-3 rounded-lg border border-line bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900 md:grid-cols-5">
        {SECTION_KEYS.map((key) => (
          <div key={key}>
            <p className="text-xs uppercase text-muted">{test.sections[key].title}</p>
            <p className="mt-1 text-lg font-semibold">{test.sections[key].durationMinutes} min</p>
          </div>
        ))}
        <div>
          <p className="text-xs uppercase text-muted">Total</p>
          <p className="mt-1 text-lg font-semibold">{totalMinutes} min</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {SECTION_KEYS.map((key) => <SectionCard key={key} testId={test.id} sectionKey={key} section={test.sections[key]} />)}
      </div>
      </>
      )}
    </div>
  );
}
