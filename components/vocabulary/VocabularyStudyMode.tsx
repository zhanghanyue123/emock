"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { VocabularyItem } from "@/types/practice";

export function VocabularyStudyMode({ items, onReview }: { items: VocabularyItem[]; onReview: (item: VocabularyItem, result: "again" | "learning" | "know") => Promise<void> }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const item = items[index];
  if (!item) return <Card><p className="text-sm text-muted">No vocabulary to study.</p></Card>;
  const source = item.sources[item.sources.length - 1] || item.source;

  async function answer(result: "again" | "learning" | "know") {
    await onReview(item, result);
    setRevealed(false);
    setIndex((value) => Math.min(items.length - 1, value + 1));
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <div className="text-center">
        <p className="text-xs text-muted">Study mode · {index + 1}/{items.length}</p>
        <h2 className="mt-4 text-3xl font-semibold">{item.word}</h2>
        <p className="mt-2 text-sm text-muted">{item.partOfSpeech || "No part of speech"} · {source?.questionNumber ? `Q${source.questionNumber}` : "Manual"}</p>
      </div>
      {revealed ? (
        <div className="mt-6 grid gap-2 text-sm">
          <p><span className="text-muted">中文释义:</span> {item.translation || "No translation yet."}</p>
          <p><span className="text-muted">Definition:</span> {item.definition || "No definition yet."}</p>
          <p><span className="text-muted">Example:</span> {item.exampleSentence || "No example yet."}</p>
          <p><span className="text-muted">Note:</span> {item.personalNote || "No note yet."}</p>
          <div className="mt-4 grid grid-cols-3 gap-2"><Button onClick={() => void answer("again")}>Again</Button><Button onClick={() => void answer("learning")}>Still learning</Button><Button variant="primary" onClick={() => void answer("know")}>Know it</Button></div>
        </div>
      ) : (
        <div className="mt-6 text-center"><Button variant="primary" onClick={() => setRevealed(true)}>Reveal</Button></div>
      )}
    </Card>
  );
}
