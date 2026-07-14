"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddVocabularyButton } from "@/components/vocabulary/AddVocabularyButton";
import { useI18n } from "@/hooks/useI18n";
import { answerToText, formatDate } from "@/lib/format";
import { LocalStorageMistakeRepository } from "@/lib/repositories/mistake-repository";
import type { MistakeItem } from "@/types/practice";

const mistakeRepository = new LocalStorageMistakeRepository();

export default function MistakesPage() {
  const { t } = useI18n();
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);

  useEffect(() => {
    void mistakeRepository.getMistakes().then(setMistakes);
  }, []);

  function remove(id: string) {
    const next = mistakes.filter((item) => item.id !== id);
    setMistakes(next);
    void mistakeRepository.removeMistake(id);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{t("mistakeBook")}</h1><p className="mt-1 text-sm text-muted">{t("mistakeIntro")}</p></div>
      </div>
      <div className="mt-6 grid gap-3">
        {mistakes.length === 0 ? <EmptyState title={t("noMistakesSaved")} body={t("noMistakesBody")} /> : mistakes.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-muted">{item.testTitle} · {item.section}</p>
                <h2 className="mt-1 font-semibold">Question {item.questionNumber}</h2>
              </div>
              <p className="text-sm text-muted">{formatDate(item.lastWrongAt)}</p>
            </div>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <p><span className="text-muted">Your answer:</span> {answerToText(item.userAnswer)}</p>
              <p><span className="text-muted">Correct:</span> {answerToText(item.correctAnswer)}</p>
            </div>
            <p className="mt-2 text-sm text-muted">{item.explanation || "No explanation yet."}</p>
            <div className="mt-4 flex gap-2">
              <Button href={`/practice/${item.testId}/${item.section}`}>{t("practice")}</Button>
              <AddVocabularyButton
                source={{
                  testId: item.testId,
                  testTitle: item.testTitle,
                  section: item.section,
                  questionId: item.questionId,
                  questionNumber: item.questionNumber,
                  resultStatus: item.status,
                  addedFrom: "mistake"
                }}
                sourceCandidates={[
                  { label: "Your answer", text: Array.isArray(item.userAnswer) ? item.userAnswer.join(" ") : String(item.userAnswer || "") },
                  { label: "Correct answer", text: Array.isArray(item.correctAnswer) ? item.correctAnswer.join(" ") : String(item.correctAnswer || "") },
                  { label: "Explanation", text: item.explanation || "" }
                ].filter((candidate) => candidate.text.trim().length > 0)}
              />
              <Button onClick={() => remove(item.id)} variant="danger">{t("remove")}</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
