"use client";

import { useMemo } from "react";
import { SECTION_KEYS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { storage } from "@/lib/storage";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { TestListItem } from "@/types/test";

export function TestCard({ test }: { test: TestListItem }) {
  const { t } = useI18n();
  const isMaterials = test.kind === "materials";
  const isReady = test.overallStatus === "ready";
  const isInProgress = test.overallStatus === "in_progress";
  const stats = useMemo(() => {
    const sessions = typeof window === "undefined" ? {} : storage.getSessions();
    const enabled = SECTION_KEYS.filter((key) => test.sections[key]?.enabled);
    const issueCount = enabled.reduce((sum, key) => sum + (test.sections[key]?.issueCount || 0), 0);
    const related = Object.values(sessions).filter((session) => session.testId === test.id);
    return {
      enabled,
      issueCount,
      complete: related.some((session) => session.submittedAt),
      started: related.length > 0,
      last: related.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.updatedAt
    };
  }, [test]);
  const statusLabel = isMaterials ? "资料" : stats.complete ? t("completed") : stats.started ? "进行中" : "未开始";
  const statusClass = stats.complete
    ? "border-green-300 text-green-700"
    : stats.started
      ? "border-amber-300 text-amber-700"
      : "border-line text-muted";

  return (
    <Card className={!test.valid ? "opacity-70" : ""}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase text-muted">{test.id}</p>
          <h2 className="mt-1 text-lg font-semibold text-ink dark:text-white">{test.title}</h2>
          <p className="mt-1 text-sm text-muted dark:text-slate-400">{test.description || "No description yet."}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-xs ${statusClass}`}>{statusLabel}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted">{t("sections")}</span><div>{stats.enabled.join(", ") || "None"}</div></div>
        <div><span className="text-muted">{t("last")}</span><div>{formatDate(stats.last)}</div></div>
      </div>
      {!isMaterials && !isReady && stats.issueCount > 0 ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
          仍有 {stats.issueCount} 个内容项需要校对，暂不开放正式考试模式。
        </p>
      ) : null}
      {test.error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{test.error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {isMaterials ? <Button href={`/tests/${test.id}`} variant="primary">查看资料</Button> : null}
        {isReady ? <Button href={`/practice/${test.id}/reading?mode=exam`} variant="primary" disabled={!test.valid}>Exam mode</Button> : null}
        {isReady ? <Button href={`/practice/${test.id}/reading?mode=review`} disabled={!test.valid}>Review mode</Button> : null}
        {!isMaterials && !isReady ? <Button href={`/tests/${test.id}`} variant="primary">{isInProgress ? "查看进度" : t("sectionPractice")}</Button> : null}
        {isReady ? <Button href={`/tests/${test.id}`} disabled={!test.valid}>{t("sectionPractice")}</Button> : null}
      </div>
    </Card>
  );
}
