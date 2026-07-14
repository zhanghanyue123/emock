"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useI18n } from "@/hooks/useI18n";
import { SECTION_KEYS } from "@/lib/constants";
import { formatDate, formatSeconds } from "@/lib/format";
import { storage } from "@/lib/storage";
import type { PracticeHistoryItem } from "@/types/practice";
import type { TestListItem } from "@/types/test";

export function DashboardClient({ tests }: { tests: TestListItem[] }) {
  const { t } = useI18n();
  const [history, setHistory] = useState<PracticeHistoryItem[]>([]);
  const [last, setLast] = useState<{ testId: string; section: string } | null>(null);

  useEffect(() => {
    setHistory(storage.getHistory());
    setLast(storage.getLastSession());
  }, []);

  const stats = useMemo(() => {
    const totalSeconds = history.reduce((sum, item) => sum + item.secondsSpent, 0);
    const completed = new Set(history.filter((item) => item.submittedAt).map((item) => item.testId)).size;
    return { totalSeconds, completed };
  }, [history]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("toeflPractice")}</h1>
          <p className="mt-1 text-sm text-muted">{t("privateWorkspace")}</p>
        </div>
        {last ? <Button href={`/practice/${last.testId}/${last.section}`} variant="primary">{t("continuePractice")}</Button> : <Button href="/tests" variant="primary">{t("chooseSet")}</Button>}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm text-muted">{t("practiceSets")}</p><p className="mt-2 text-2xl font-semibold">{tests.length}</p></Card>
        <Card><p className="text-sm text-muted">{t("totalPracticeTime")}</p><p className="mt-2 text-2xl font-semibold">{formatSeconds(stats.totalSeconds)}</p></Card>
        <Card><p className="text-sm text-muted">{t("completedSets")}</p><p className="mt-2 text-2xl font-semibold">{stats.completed}</p></Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {SECTION_KEYS.map((section) => {
          const done = history.filter((item) => item.section === section && item.submittedAt).length;
          return (
            <Card key={section}>
              <div className="flex items-center justify-between"><h2 className="font-semibold capitalize">{section}</h2><span className="text-sm text-muted">{done}</span></div>
              <div className="mt-3"><ProgressBar value={Math.min(100, done * 20)} /></div>
            </Card>
          );
        })}
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">{t("recentPractice")}</h2>
        {history.length === 0 ? (
          <EmptyState title={t("noPracticeYet")} body={t("recentPracticeEmpty")} />
        ) : (
          <div className="grid gap-3">
            {history.slice(0, 5).map((item) => (
              <Card key={`${item.testId}-${item.section}-${item.startedAt}`} className="flex items-center justify-between">
                <div><p className="font-medium">{item.testTitle}</p><p className="text-sm text-muted">{item.section} · {formatDate(item.updatedAt)}</p></div>
                <Button href={`/review/${item.testId}/${item.section}`}>{t("review")}</Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
