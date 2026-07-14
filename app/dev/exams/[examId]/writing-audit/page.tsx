import { AuditSectionPage } from "../AuditSectionPage";

export default async function WritingAuditPage({ params, searchParams }: { params: Promise<{ examId: string }>; searchParams?: Promise<{ mismatch?: string }> }) {
  const { examId } = await params;
  const mismatchIndex = Number((await searchParams)?.mismatch || 0);
  return <AuditSectionPage examId={examId} section="writing" mismatchIndex={Number.isFinite(mismatchIndex) ? mismatchIndex : 0} />;
}
