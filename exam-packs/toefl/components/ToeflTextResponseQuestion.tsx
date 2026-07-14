"use client";

import { TOEFL_RENDERERS } from "../question-types";
import { useRef } from "react";
import type { ExamQuestionRendererProps } from "@/core/exam/types";

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function ToeflTextResponseQuestion({ question, response, onResponse }: ExamQuestionRendererProps) {
  const value = textValue(response?.value);
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEmail = question.questionType.includes("write_email");
  const updateValue = (nextValue: string) => {
    onResponse({ questionId: question.id, responseType: TOEFL_RENDERERS.text, value: nextValue, updatedAt: new Date().toISOString() });
  };
  const cutSelection = async () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selectedText = value.slice(textarea.selectionStart, textarea.selectionEnd);
    if (!selectedText) return;
    await navigator.clipboard?.writeText(selectedText).catch(() => undefined);
    updateValue(`${value.slice(0, textarea.selectionStart)}${value.slice(textarea.selectionEnd)}`);
  };
  const pasteSelection = async () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pastedText = await navigator.clipboard?.readText().catch(() => "");
    if (!pastedText) return;
    updateValue(`${value.slice(0, textarea.selectionStart)}${pastedText}${value.slice(textarea.selectionEnd)}`);
  };
  return (
    <div className="grid gap-3">
      {typeof question.config.context === "string" && question.config.context ? <p className="rounded-md bg-slate-50 p-3 text-sm leading-6 dark:bg-slate-950">{question.config.context}</p> : null}
      {Array.isArray(question.config.tokens) && question.config.tokens.length ? (
        <div className="flex flex-wrap gap-2">
          {(question.config.tokens as string[]).map((token, index) => <span key={`${token}-${index}`} className="rounded border border-line px-2 py-1 text-sm dark:border-slate-700">{token}</span>)}
        </div>
      ) : null}
      <div className="grid gap-4">
        <p className="text-base font-semibold">Your Response:</p>
        {isEmail ? (
          <div className="grid gap-2 text-sm font-semibold text-ink">
            <p>To: Ms. Taylor</p>
            <p>Subject: Resort Inquiry</p>
          </div>
        ) : null}
        <div className="overflow-hidden rounded-lg border border-line bg-white dark:border-slate-700 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={cutSelection} className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Cut</button>
              <button type="button" onClick={pasteSelection} className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700">Paste</button>
              <button type="button" onClick={() => document.execCommand("undo")} className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700">Undo</button>
              <button type="button" onClick={() => document.execCommand("redo")} className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700">Redo</button>
            </div>
            <p className="text-sm font-semibold text-muted">Word Count {words}</p>
          </div>
          <textarea
            ref={textareaRef}
            className="min-h-[360px] w-full resize-y border-0 bg-white p-4 text-base leading-7 outline-none dark:bg-slate-950"
            placeholder="Write your response here."
            value={value}
            onChange={(event) => updateValue(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
