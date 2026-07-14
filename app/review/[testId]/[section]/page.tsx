import { notFound } from "next/navigation";
import { SECTION_KEYS } from "@/lib/constants";
import { LocalContentRepository } from "@/lib/repositories/content-repository";
import { getStructuredTestBundle } from "@/lib/structured-content";
import type { SectionKey } from "@/types/test";
import { ReviewClient } from "./ReviewClient";

export default async function ReviewPage({ params }: { params: Promise<{ testId: string; section: string }> }) {
  const { testId, section } = await params;
  if (!SECTION_KEYS.includes(section as SectionKey)) notFound();
  const test = await new LocalContentRepository().getTestById(testId);
  if (!test) notFound();
  const structuredBundle = await getStructuredTestBundle(testId);
  return <ReviewClient test={test} sectionKey={section as SectionKey} structuredBundle={structuredBundle || undefined} />;
}
