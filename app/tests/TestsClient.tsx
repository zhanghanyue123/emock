"use client";

import { useMemo, useState } from "react";
import { TestCard } from "@/components/tests/TestCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/hooks/useI18n";
import type { TestListItem } from "@/types/test";

export function TestsClient({ tests }: { tests: TestListItem[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => tests.filter((test) => `${test.title} ${test.id}`.toLowerCase().includes(query.toLowerCase())), [query, tests]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{t("practiceSets")}</h1><p className="mt-1 text-sm text-muted">{t("privateWorkspace")}</p></div>
        <input className="h-10 w-full max-w-sm rounded-md border border-line px-3 dark:border-slate-700 dark:bg-slate-950" placeholder={t("searchTestName")} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="mt-6 grid gap-4">{filtered.length ? filtered.map((test) => <TestCard key={test.id} test={test} />) : <EmptyState title={t("noTestsFound")} body={t("noTestsBody")} />}</div>
    </div>
  );
}
