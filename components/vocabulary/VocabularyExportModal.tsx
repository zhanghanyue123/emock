"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { vocabularyExportFileName, vocabularyToCsv, vocabularyToJson, vocabularyToText, vocabularyToTsv, type VocabularyExportFormat, type VocabularyTextMode } from "@/lib/vocabulary/export-vocabulary";
import type { VocabularyItem } from "@/types/practice";

type Scope = "all" | "filtered" | "starred" | "new-learning";

export function VocabularyExportModal({ open, allItems, filteredItems, onClose }: { open: boolean; allItems: VocabularyItem[]; filteredItems: VocabularyItem[]; onClose: () => void }) {
  const [scope, setScope] = useState<Scope>("filtered");
  const [format, setFormat] = useState<VocabularyExportFormat>("csv");
  const [textMode, setTextMode] = useState<VocabularyTextMode>("word-only");
  const items = useMemo(() => {
    if (scope === "all") return allItems;
    if (scope === "starred") return allItems.filter((item) => item.isStarred);
    if (scope === "new-learning") return allItems.filter((item) => item.status === "new" || item.status === "learning");
    return filteredItems;
  }, [allItems, filteredItems, scope]);

  if (!open) return null;

  function download() {
    if (!items.length) return;
    const content = format === "csv" ? vocabularyToCsv(items) : format === "tsv" ? vocabularyToTsv(items) : format === "json" ? vocabularyToJson(items) : vocabularyToText(items, textMode);
    const blob = new Blob([content], { type: format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = vocabularyExportFileName(format);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Export vocabulary</h2><Button variant="ghost" onClick={onClose}>Close</Button></div>
        <div className="mt-4 grid gap-3">
          <label className="text-sm">Range<select className="mt-1 h-10 w-full rounded-md border border-line px-3 dark:bg-slate-950" value={scope} onChange={(event) => setScope(event.target.value as Scope)}><option value="all">All words</option><option value="filtered">Current filtered results</option><option value="starred">Starred words</option><option value="new-learning">New and learning words</option></select></label>
          <label className="text-sm">Format<select className="mt-1 h-10 w-full rounded-md border border-line px-3 dark:bg-slate-950" value={format} onChange={(event) => setFormat(event.target.value as VocabularyExportFormat)}><option value="csv">CSV</option><option value="tsv">TSV</option><option value="json">JSON</option><option value="txt">TXT</option></select></label>
          {format === "tsv" ? <p className="text-sm text-muted">TSV can be imported into many flashcard applications.</p> : null}
          {format === "txt" ? <label className="text-sm">TXT mode<select className="mt-1 h-10 w-full rounded-md border border-line px-3 dark:bg-slate-950" value={textMode} onChange={(event) => setTextMode(event.target.value as VocabularyTextMode)}><option value="word-only">word</option><option value="word-translation">word - translation</option></select></label> : null}
          {!items.length ? <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">No vocabulary items match the current selection.</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!items.length} onClick={download}>Export</Button></div>
      </div>
    </div>
  );
}
