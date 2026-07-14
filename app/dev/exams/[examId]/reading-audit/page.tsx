import { AuditSectionPage } from "../AuditSectionPage";

export default async function ReadingAuditPage({ params, searchParams }: { params: Promise<{ examId: string }>; searchParams?: Promise<{ mismatch?: string }> }) {
  const { examId } = await params;
  const mismatchIndex = Number((await searchParams)?.mismatch || 0);
  return <AuditSectionPage examId={examId} section="reading" mismatchIndex={Number.isFinite(mismatchIndex) ? mismatchIndex : 0} />;
}
