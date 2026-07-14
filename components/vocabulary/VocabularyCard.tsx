"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import { VocabularyStatusBadge } from "./VocabularyStatusBadge";
import { VocabularyEditorModal } from "./VocabularyEditorModal";
import type { CreateVocabularyInput, VocabularyItem, VocabularyStatus } from "@/types/practice";

export function VocabularyCard({ item, onUpdate, onRemove }: {
  item: VocabularyItem;
  onUpdate: (id: string, patch: Partial<VocabularyItem>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const latest = item.sources[item.sources.length - 1] || item.source;

  async function save(input: CreateVocabularyInput) {
    await onUpdate(item.id, input);
    setEditing(false);
  }

  async function setStatus(status: VocabularyStatus) {
    await onUpdate(item.id, { status, masteredAt: status === "mastered" ? new Date().toISOString() : undefined });
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{item.word}</h2>
            <button className="text-sm text-amber-500" onClick={() => void onUpdate(item.id, { isStarred: !item.isStarred })}>{item.isStarred ? "Starred" : "Star"}</button>
          </div>
          <p className="mt-1 text-sm text-muted">{item.translation || "No translation yet."} {item.partOfSpeech ? `· ${item.partOfSpeech}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            <VocabularyStatusBadge status={item.status} />
            {item.tags.map((tag) => <span key={tag} className="rounded-full border border-line px-2 py-1">{tag}</span>)}
          </div>
        </div>
        <div className="text-right text-sm text-muted">
          <p>{latest?.testTitle || latest?.testId || "Manual"}</p>
          <p>{latest?.section || ""} {latest?.questionNumber ? `Q${latest.questionNumber}` : ""}</p>
          <p>{item.mistakeCount} mistakes · {formatDate(item.createdAt)}</p>
        </div>
      </div>
      {expanded ? (
        <div className="mt-4 grid gap-3 text-sm">
          <p><span className="text-muted">Definition:</span> {item.definition || "No definition yet."}</p>
          <p><span className="text-muted">Example:</span> {item.exampleSentence || "No example yet."}</p>
          <p><span className="text-muted">Note:</span> {item.personalNote || "No note yet."}</p>
          <p><span className="text-muted">Last reviewed:</span> {formatDate(item.lastReviewedAt)}</p>
          <div><span className="text-muted">Sources:</span> {item.sources.length ? item.sources.map((source, index) => <span key={`${source.questionId}-${index}`} className="ml-2 rounded-md border border-line px-2 py-1">{source.addedFrom || "manual"} {source.testTitle || source.testId || ""} {source.questionNumber ? `Q${source.questionNumber}` : ""}</span>) : "Manual"}</div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => setExpanded(!expanded)}>{expanded ? "Collapse" : "Expand"}</Button>
        <Button onClick={() => setEditing(true)}>Edit</Button>
        <Button onClick={() => setStatus("mastered")}>Mark as learned</Button>
        <Button onClick={() => setStatus("learning")}>Needs review</Button>
        <Button variant="danger" onClick={() => window.confirm(`Delete "${item.word}"?`) && void onRemove(item.id)}>Delete</Button>
      </div>
      <VocabularyEditorModal open={editing} item={item} onClose={() => setEditing(false)} onSave={save} />
    </div>
  );
}
