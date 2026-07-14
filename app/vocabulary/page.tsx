"use client";

import { useEffect, useMemo, useState } from "react";
import { AddVocabularyButton } from "@/components/vocabulary/AddVocabularyButton";
import { VocabularyExportModal } from "@/components/vocabulary/VocabularyExportModal";
import { VocabularyFilters } from "@/components/vocabulary/VocabularyFilters";
import { VocabularyList } from "@/components/vocabulary/VocabularyList";
import { VocabularyStudyMode } from "@/components/vocabulary/VocabularyStudyMode";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useI18n } from "@/hooks/useI18n";
import { LocalStorageVocabularyRepository } from "@/lib/repositories/vocabulary-repository";
import { filterVocabularyItems, type VocabularyFilterState } from "@/lib/vocabulary/vocabulary-filters";
import type { VocabularyItem } from "@/types/practice";

const repository = new LocalStorageVocabularyRepository();
const initialFilters: VocabularyFilterState = { query: "", filter: "all", section: "all", testId: "", tag: "", sort: "recent" };

export default function VocabularyPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [view, setView] = useState<"list" | "study">("list");
  const [exportOpen, setExportOpen] = useState(false);
  const [now] = useState(() => Date.now());

  async function refresh() {
    setItems(await repository.getAll());
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => filterVocabularyItems(items, filters), [filters, items]);
  const tags = useMemo(() => [...new Set(items.flatMap((item) => item.tags))].sort(), [items]);
  const testIds = useMemo(() => [...new Set(items.flatMap((item) => item.sources.map((source) => source.testId).filter(Boolean) as string[]))].sort(), [items]);
  const recentCount = useMemo(() => {
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    return items.filter((item) => new Date(item.createdAt).getTime() >= cutoff).length;
  }, [items, now]);

  async function update(id: string, patch: Partial<VocabularyItem>) {
    await repository.update(id, patch);
    await refresh();
  }

  async function remove(id: string) {
    await repository.remove(id);
    await refresh();
  }

  async function review(item: VocabularyItem, result: "again" | "learning" | "know") {
    const now = new Date().toISOString();
    await repository.update(item.id, {
      status: result === "know" ? "mastered" : "learning",
      reviewCount: item.reviewCount + 1,
      lastReviewedAt: now,
      masteredAt: result === "know" ? now : undefined
    });
    await refresh();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{t("vocabularyTitle")}</h1><p className="mt-1 text-sm text-muted">{t("vocabularyIntro")}</p></div>
        <div className="flex gap-2"><AddVocabularyButton source={{ addedFrom: "manual" }} onSaved={refresh} label={t("addVocabulary")} /><Button onClick={() => setExportOpen(true)} disabled={!items.length}>{t("exportVocabulary")}</Button></div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <Card><p className="text-sm text-muted">{t("total")}</p><p className="mt-2 text-2xl font-semibold">{items.length}</p></Card>
        <Card><p className="text-sm text-muted">{t("new")}</p><p className="mt-2 text-2xl font-semibold">{items.filter((item) => item.status === "new").length}</p></Card>
        <Card><p className="text-sm text-muted">{t("learning")}</p><p className="mt-2 text-2xl font-semibold">{items.filter((item) => item.status === "learning").length}</p></Card>
        <Card><p className="text-sm text-muted">{t("mastered")}</p><p className="mt-2 text-2xl font-semibold">{items.filter((item) => item.status === "mastered").length}</p></Card>
        <Card><p className="text-sm text-muted">{t("recent")}</p><p className="mt-2 text-2xl font-semibold">{recentCount}</p></Card>
      </div>
      <div className="mt-6"><VocabularyFilters state={filters} tags={tags} testIds={testIds} onChange={setFilters} /></div>
      <div className="mt-4 flex gap-2"><Button variant={view === "list" ? "primary" : "secondary"} onClick={() => setView("list")}>{t("list")}</Button><Button variant={view === "study" ? "primary" : "secondary"} onClick={() => setView("study")}>{t("study")}</Button></div>
      <div className="mt-4">{view === "study" ? <VocabularyStudyMode items={filtered} onReview={review} /> : <VocabularyList items={filtered} onUpdate={update} onRemove={remove} />}</div>
      <VocabularyExportModal open={exportOpen} allItems={items} filteredItems={filtered} onClose={() => setExportOpen(false)} />
    </div>
  );
}
