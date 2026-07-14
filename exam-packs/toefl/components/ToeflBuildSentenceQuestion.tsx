"use client";

import { TOEFL_RENDERERS, isToeflBuildSentenceConfig } from "../question-types";
import type { ExamQuestionRendererProps } from "@/core/exam/types";

function selectedTokenIds(value: unknown) {
  if (Array.isArray((value as { tokenIds?: unknown })?.tokenIds)) {
    return ((value as { tokenIds: unknown[] }).tokenIds).map(String);
  }
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function sentenceText(parts: string[]) {
  return parts.filter(Boolean).join(" ").replace(/\s+([.,!?;:])/g, "$1").replace(/\s+/g, " ").trim();
}

export function ToeflBuildSentenceQuestion({ question, response, onResponse }: ExamQuestionRendererProps) {
  if (!isToeflBuildSentenceConfig(question.config)) {
    return <div className="rounded-md border border-red-300 p-3 text-sm text-red-700">Invalid TOEFL build-sentence config.</div>;
  }

  const tokenIds = selectedTokenIds(response?.value);
  const tokenById = new Map(question.config.tokens.map((token) => [token.id, token]));
  const selectedTokens = tokenIds.map((id) => tokenById.get(id)).filter((token): token is NonNullable<typeof token> => Boolean(token));
  const availableTokens = question.config.tokens.filter((token) => !tokenIds.includes(token.id)).sort((left, right) => left.order - right.order);

  function update(nextTokenIds: string[]) {
    onResponse({
      questionId: question.id,
      responseType: TOEFL_RENDERERS.buildSentenceInline,
      value: { tokenIds: nextTokenIds },
      updatedAt: new Date().toISOString()
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= tokenIds.length) return;
    const next = [...tokenIds];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }

  const preview = sentenceText([
    question.config.fixedPrefix || "",
    ...selectedTokens.map((token) => token.text),
    question.config.fixedSuffix || ""
  ]);

  return (
    <div className="grid gap-5">
      {question.config.conversationPrompt ? (
        <div className="rounded-md bg-slate-50 p-3 text-sm leading-6 dark:bg-slate-950">
          {question.config.conversationPrompt}
        </div>
      ) : null}

      <div className="grid gap-2">
        <div className="min-h-20 rounded-md border border-line bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
          <div className="flex flex-wrap items-center gap-2">
            {question.config.fixedPrefix ? <span className="text-sm">{question.config.fixedPrefix}</span> : null}
            {selectedTokens.length ? selectedTokens.map((token, index) => (
              <span key={token.id} className="inline-flex items-center gap-1 rounded-md border border-action bg-blue-50 px-2 py-1 text-sm text-action dark:bg-blue-950">
                <button type="button" className="font-medium" onClick={() => update(tokenIds.filter((id) => id !== token.id))}>{token.text}</button>
                <button type="button" className="rounded px-1 text-xs hover:bg-white/70 disabled:opacity-30 dark:hover:bg-slate-800" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${token.text} left`}>‹</button>
                <button type="button" className="rounded px-1 text-xs hover:bg-white/70 disabled:opacity-30 dark:hover:bg-slate-800" disabled={index === tokenIds.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${token.text} right`}>›</button>
              </span>
            )) : <span className="text-sm text-muted">Select tokens to build the sentence.</span>}
            {question.config.fixedSuffix ? <span className="text-sm">{question.config.fixedSuffix}</span> : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{preview || "Not answered"}</p>
          <button type="button" className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => update([])}>Clear</button>
        </div>
      </div>

      {availableTokens.length ? (
        <div className="flex flex-wrap gap-2">
          {availableTokens.map((token) => (
            <button
              key={token.id}
              type="button"
              className="rounded-md border border-line bg-white px-3 py-2 text-sm shadow-sm hover:border-action hover:text-action dark:border-slate-700 dark:bg-slate-950"
              onClick={() => update([...tokenIds, token.id])}
            >
              {token.text}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-line bg-slate-50 p-3 text-sm text-muted dark:border-slate-700 dark:bg-slate-950">All tokens are in the answer.</p>
      )}
    </div>
  );
}
