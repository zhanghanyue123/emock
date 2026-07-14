import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { SectionKey, TestSection } from "@/types/test";

const labels: Record<string, string> = {
  not_detected: "未发现",
  detected: "未开始",
  importing: "导入中",
  ready: "可练习",
  needs_review: "待确认",
  failed: "失败"
};

export function SectionCard({ testId, sectionKey, section }: { testId: string; sectionKey: SectionKey; section: TestSection }) {
  const status = section.importStatus || (section.enabled ? "ready" : "not_detected");
  const canStart = section.questions.length > 0;
  return (
    <Card className={status === "not_detected" ? "opacity-70" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <p className="mt-1 text-sm text-muted">{section.durationMinutes} minutes · {section.questions.length} questions</p>
        </div>
        <span className="rounded-full border border-line px-2 py-1 text-xs">{status === "needs_review" ? "待结构化" : labels[status] || status}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {canStart ? <Button href={`/practice/${testId}/${sectionKey}?mode=exam`} variant="primary">Exam mode</Button> : null}
        {canStart ? <Button href={`/practice/${testId}/${sectionKey}?mode=review`}>Review mode</Button> : null}
        {!canStart ? <span className="text-sm text-muted">正在整理为可交互模考</span> : null}
      </div>
    </Card>
  );
}
