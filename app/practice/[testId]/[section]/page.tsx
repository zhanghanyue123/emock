import { notFound } from "next/navigation";
import { ExamShell } from "@/components/exam/ExamShell";
import { Button } from "@/components/ui/Button";
import { SECTION_KEYS } from "@/lib/constants";
import { LocalContentRepository } from "@/lib/repositories/content-repository";
import { getStructuredTestBundle, getStructuredSection } from "@/lib/structured-content";
import type { SectionKey } from "@/types/test";

export default async function PracticePage({ params, searchParams }: { params: Promise<{ testId: string; section: string }>; searchParams?: Promise<{ mode?: string }> }) {
  const { testId, section: sectionParam } = await params;
  const modeParam = (await searchParams)?.mode;
  const mode = modeParam === "exam" ? "exam" : "review";
  if (!SECTION_KEYS.includes(sectionParam as SectionKey)) notFound();
  const structured = await getStructuredTestBundle(testId);
  const structuredSection = structured ? getStructuredSection(structured, sectionParam) : null;
  if (structured && structuredSection) {
    const hasQuestions = structuredSection.modules.some((module) => module.questions.length > 0);
    if (hasQuestions && structuredSection.importStatus !== "detected" && structuredSection.importStatus !== "not_detected" && structuredSection.importStatus !== "failed") return <ExamShell bundle={structured} sectionKey={sectionParam as SectionKey} mode={mode} />;
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <h1 className="text-xl font-semibold">This section has been detected but has not finished conversion.</h1>
          <p className="mt-2 text-sm">Current status: {structuredSection.importStatus || "detected"}.</p>
          <div className="mt-4 flex gap-2">
            <Button href={`/tests/${testId}`} variant="primary">Build this section</Button>
            <Button href={`/tests/${testId}`}>Back to exam</Button>
          </div>
        </div>
      </div>
    );
  }
  const test = await new LocalContentRepository().getTestById(testId);
  if (!test) notFound();
  const sectionKey = sectionParam as SectionKey;
  const section = test.sections[sectionKey];
  if (!section.enabled) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        <h1 className="text-xl font-semibold">This test has source files but has not been converted into an interactive test yet.</h1>
        <p className="mt-2 text-sm">Raw PDF and audio are now import materials only. Use the local import editor to create and publish structured questions before starting formal practice.</p>
        <div className="mt-4 flex gap-2">
          <Button href={`/admin/tests/${testId}/editor`} variant="primary">Open import editor</Button>
          <Button href={`/tests/${testId}`}>Back to test</Button>
        </div>
      </div>
    </div>
  );
}
