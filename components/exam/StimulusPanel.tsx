"use client";

import { WordBlankInput } from "@/exam-packs/toefl/components/WordBlankInput";
import { publicAssetPath } from "@/lib/assets";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AnswerValue } from "@/types/test";
import type { Passage, SentenceToken, SpeakingImageDisplay, TestAssetRecord, TestQuestion } from "@/types/structured-test";

function renderTextWithBlanks(text: string, question?: TestQuestion, answers?: Record<string, string>, onBlankChange?: (blankId: string, value: string) => void) {
  if (!question?.blanks?.length || question.type !== "complete_words") return <p className="leading-8">{text}</p>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const blank of question.blanks) {
    const prefix = blank.prefix || "";
    const suffix = blank.suffix || "";
    const target = `${prefix}${suffix}`;
    const index = text.indexOf(target, cursor);
    if (index < 0) continue;
    parts.push(text.slice(cursor, index));
    parts.push(
      <WordBlankInput
        key={blank.id}
        blank={{ id: blank.id, prefix, suffix, missingLength: blank.missingLength }}
        value={answers?.[blank.id] || ""}
        onChange={(value) => onBlankChange?.(blank.id, value)}
      />
    );
    cursor = index + target.length;
  }
  parts.push(text.slice(cursor));
  return <p className="leading-9">{parts}</p>;
}

function isVisualAsset(asset?: TestAssetRecord): asset is TestAssetRecord {
  return asset?.type === "image" || asset?.type === "page_image";
}

function tokenId(token: string | SentenceToken, index: number) {
  return typeof token === "string" ? `token-${index + 1}` : token.id;
}

function tokenText(token: string | SentenceToken) {
  return typeof token === "string" ? token : token.text;
}

function tokenOrder(token: string | SentenceToken, index: number) {
  return typeof token === "string" ? index : token.order;
}

function tokenColor(token: string | SentenceToken, fallback = "#dbeafe") {
  return typeof token === "string" ? fallback : token.color || fallback;
}

function answerTokenIds(answer?: AnswerValue) {
  return Array.isArray(answer) ? answer.map(String).filter(Boolean) : [];
}

function sentenceText(parts: string[]) {
  return parts.filter(Boolean).join(" ").replace(/\s+([.,!?;:])/g, "$1").replace(/\s+/g, " ").trim();
}

function paragraphsFor(passage: Passage) {
  return passage.paragraphs.map((paragraph) => paragraph.text).filter(Boolean);
}

function renderLabelText(text: string, labelPattern = /^([^:]+):\s*(.*)$/) {
  const match = text.match(labelPattern);
  if (!match) return text;
  return (
    <>
      <span className="font-semibold">{match[1]}:</span>
      {match[2] ? ` ${match[2]}` : ""}
    </>
  );
}

function renderFormattedParagraph(paragraph: Passage["paragraphs"][number], question?: TestQuestion, onAnswer?: (value: AnswerValue) => void) {
  const role = paragraph.config?.role;
  if (role === "bullet") {
    return (
      <p className="flex gap-3 leading-8">
        <span aria-hidden="true" className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
        <span>{renderInlineMarkers(paragraph.text, question, onAnswer)}</span>
      </p>
    );
  }
  if (role === "speaker") {
    return (
      <p className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 leading-8">
        {renderLabelText(paragraph.text)}
      </p>
    );
  }
  if (role === "instruction" || paragraph.config?.weight === "bold") {
    return <p className="font-semibold leading-8">{renderInlineMarkers(paragraph.text, question, onAnswer)}</p>;
  }
  if (role === "email_header") {
    return <p className="leading-8">{renderLabelText(paragraph.text)}</p>;
  }
  return <p className="leading-8">{renderInlineMarkers(paragraph.text, question, onAnswer)}</p>;
}

function optionIdForLabel(question: TestQuestion | undefined, label: string) {
  return question?.options?.find((option) => option.label === label || option.text === `Location ${label}`)?.id;
}

function renderInlineMarkers(text: string, question?: TestQuestion, onAnswer?: (value: AnswerValue) => void) {
  const chunks = text.split(/(\[[A-D]\])/g);
  return chunks.map((chunk, index) => {
    const match = chunk.match(/^\[([A-D])\]$/);
    if (!match) return <span key={`${chunk}-${index}`}>{chunk}</span>;
    const optionId = optionIdForLabel(question, match[1]);
    return (
      <button
        key={`${chunk}-${index}`}
        type="button"
        className="mx-1 inline-grid h-6 w-6 translate-y-[-1px] place-items-center rounded-sm border border-teal-700 bg-teal-50 text-xs font-bold text-teal-800 shadow-sm transition hover:bg-teal-100"
        onClick={() => optionId ? onAnswer?.(optionId) : undefined}
        aria-label={`Choose insertion location ${match[1]}`}
      >
        {match[1]}
      </button>
    );
  });
}

function CompleteWordsMaterial({ passage, question, blankAnswers, onBlankChange }: {
  passage: Passage;
  question?: TestQuestion;
  blankAnswers?: Record<string, string>;
  onBlankChange?: (blankId: string, value: string) => void;
}) {
  return (
    <div className="mx-auto flex min-h-[520px] max-w-5xl flex-col justify-center">
      <h2 className="text-center text-2xl font-semibold text-slate-900">Fill in the missing letters in the paragraph.</h2>
      <div className="mt-28 rounded-sm bg-white px-8 py-6 text-[18px] leading-9 text-slate-900">
        {passage.paragraphs.map((paragraph) => (
          <div key={paragraph.id}>{renderTextWithBlanks(paragraph.text, question, blankAnswers, onBlankChange)}</div>
        ))}
      </div>
    </div>
  );
}

function FormMaterial({ passage }: { passage: Passage }) {
  const lines = paragraphsFor(passage);
  const rows = (lines[1] || "").split("\n").map((line) => {
    const [label, ...rest] = line.split(":");
    return { label, value: rest.join(":").trim() };
  });
  return (
    <div className="mx-auto max-w-3xl py-10 text-slate-900">
      <h2 className="mb-16 text-center text-3xl font-semibold">{lines[0] || passage.title}</h2>
      <div className="border-2 border-slate-500 bg-white p-6">
        <div className="grid gap-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[190px_minmax(0,1fr)] items-end gap-2 border-b border-slate-300 pb-1">
              <span className="font-semibold">{row.label}:</span>
              <span>{row.value}</span>
            </div>
          ))}
        </div>
        {lines.slice(2).map((line) => <p key={line} className="mt-6 text-[17px] leading-7">{line}</p>)}
      </div>
    </div>
  );
}

function EmailMaterial({ passage }: { passage: Passage }) {
  const lines = paragraphsFor(passage);
  const body = passage.paragraphs.slice(1);
  const to = body.find((paragraph) => /^To:/i.test(paragraph.text));
  const subject = body.find((paragraph) => /^Subject:/i.test(paragraph.text));
  const bodyWithoutHeaders = body.filter((paragraph) => paragraph !== subject && paragraph !== to);
  return (
    <div className="mx-auto max-w-3xl py-8 text-slate-900">
      <h2 className="mb-8 text-center text-3xl font-semibold">{lines[0] || "Read an email."}</h2>
      <article className="overflow-hidden rounded-sm border border-slate-400 bg-white shadow-sm">
        <div className="border-b border-slate-300 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600">E-mail</div>
        {to ? (
          <div className="grid grid-cols-[90px_minmax(0,1fr)] border-b border-slate-200 px-5 py-3 text-[17px]">
            <span className="font-semibold">To:</span>
            <span>{to.text.replace(/^To:\s*/i, "")}</span>
          </div>
        ) : null}
        {subject ? (
          <div className="grid grid-cols-[90px_minmax(0,1fr)] border-b border-slate-200 px-5 py-3 text-[17px]">
            <span className="font-semibold">Subject:</span>
            <span>{subject.text.replace(/^Subject:\s*/i, "")}</span>
          </div>
        ) : null}
        <div className="grid gap-4 px-7 py-7 text-[18px]">
          {bodyWithoutHeaders.map((paragraph, index) => (
            <div key={`${paragraph.text}-${index}`}>{renderFormattedParagraph(paragraph)}</div>
          ))}
        </div>
      </article>
    </div>
  );
}

function NoticeMaterial({ passage }: { passage: Passage }) {
  const lines = paragraphsFor(passage);
  const title = lines[1] || passage.title || "Notice";
  const sections = lines.slice(3).map((block) => block.split("\n"));
  return (
    <div className="mx-auto max-w-4xl py-8 text-slate-900">
      <div className="rounded-sm border-2 border-teal-700 bg-white shadow-sm">
        <div className="border-b-2 border-teal-700 bg-teal-50 px-8 py-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">{lines[0] || "Notice"}</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950">{title}</h2>
        </div>
        <div className="px-8 py-6">
          {lines[2] ? <p className="mb-6 rounded-sm bg-slate-50 p-3 text-[17px] font-medium leading-7">{lines[2]}</p> : null}
          <div className="grid gap-5">
            {sections.map((section, index) => (
              <section key={`${section[0]}-${index}`} className="rounded-sm border border-slate-300">
                <h3 className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-xl font-bold">{section[0]}</h3>
                <div className="grid gap-2 px-4 py-3 text-[17px] leading-7">
                  {section.slice(1).map((line) => (
                    <p key={line} className={/^Section /.test(line) ? "pl-4 font-semibold text-teal-800" : ""}>{line}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PassageMaterial({ passage, question, onAnswer }: { passage: Passage; question?: TestQuestion; onAnswer?: (value: AnswerValue) => void }) {
  const paragraphs = paragraphsFor(passage);
  const title = paragraphs[0] === passage.title ? paragraphs[0] : passage.title;
  const body = title && paragraphs[0] === title ? passage.paragraphs.slice(1) : passage.paragraphs;
  return (
    <article className="mx-auto max-w-3xl py-8 text-slate-900">
      {title ? <h2 className="mb-8 text-center text-3xl font-bold">{title}</h2> : null}
      <div className="grid gap-4 text-[18px]">
        {body.map((paragraph, index) => (
          <div key={`${paragraph.text.slice(0, 20)}-${index}`}>{renderFormattedParagraph(paragraph, question, onAnswer)}</div>
        ))}
      </div>
    </article>
  );
}

function StructuredReadingMaterial({ passage, question, blankAnswers, onBlankChange, onAnswer }: {
  passage: Passage;
  question?: TestQuestion;
  blankAnswers?: Record<string, string>;
  onBlankChange?: (blankId: string, value: string) => void;
  onAnswer?: (value: AnswerValue) => void;
}) {
  if (question?.type === "complete_words") {
    return <CompleteWordsMaterial passage={passage} question={question} blankAnswers={blankAnswers} onBlankChange={onBlankChange} />;
  }
  const materialType = passage.materialType as string | undefined;
  if (materialType === "form") return <FormMaterial passage={passage} />;
  if (materialType === "email") return <EmailMaterial passage={passage} />;
  if (materialType === "notice" || materialType === "announcement" || materialType === "schedule" || materialType === "table") return <NoticeMaterial passage={passage} />;
  return <PassageMaterial passage={passage} question={question} onAnswer={onAnswer} />;
}

function BuildSentenceFallbackPanel({ question, answer, onAnswer }: {
  question: TestQuestion;
  answer?: AnswerValue;
  onAnswer?: (value: AnswerValue) => void;
}) {
  const tokens = (question.wordBank || []).map((token, index) => ({
    id: tokenId(token, index),
    text: tokenText(token),
    order: tokenOrder(token, index),
    color: tokenColor(token)
  })).sort((left, right) => left.order - right.order);
  const selectedIds = answerTokenIds(answer);
  const [activeSlot, setActiveSlot] = useState(() => Math.min(selectedIds.length, Math.max(0, tokens.length - 1)));
  const tokenById = new Map(tokens.map((token) => [token.id, token]));
  const selectedTokens = selectedIds.map((id) => tokenById.get(id)).filter((token): token is (typeof tokens)[number] => Boolean(token));
  const availableTokens = tokens.filter((token) => !selectedIds.includes(token.id));
  const slotCount = Math.max(tokens.length, selectedIds.length);

  function update(nextIds: string[], nextSlot = Math.min(nextIds.length, Math.max(0, slotCount - 1))) {
    setActiveSlot(nextSlot);
    onAnswer?.(nextIds);
  }

  function placeToken(id: string) {
    if (selectedIds.includes(id)) return;
    const next = [...selectedIds];
    const target = Math.min(activeSlot, selectedIds.length, tokens.length - 1);
    if (target < next.length) next[target] = id;
    else next.push(id);
    update(next, Math.min(target + 1, Math.max(0, tokens.length - 1)));
  }

  function removeToken(index: number) {
    update(selectedIds.filter((_, currentIndex) => currentIndex !== index), Math.min(index, Math.max(0, tokens.length - 1)));
  }

  const preview = sentenceText([question.fixedPrefix || "", ...selectedTokens.map((token) => token.text), question.fixedSuffix || ""]);

  return (
    <section className="h-full min-h-0 overflow-auto border-r border-line bg-[#f2f4f7] p-6 dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex min-h-full max-w-5xl items-center">
        <div className="w-full rounded-md border border-slate-300 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <p className="text-center text-2xl font-semibold text-slate-950 dark:text-slate-50">Build a Sentence</p>
          <div className="mt-8 grid gap-4">
            {question.conversationPrompt ? (
              <div className="rounded-md border border-slate-300 bg-slate-50 p-5 text-lg leading-8 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-2 text-xs font-semibold uppercase text-muted">Question</p>
                <p>{question.conversationPrompt}</p>
              </div>
            ) : null}
            <div className="rounded-md border border-teal-200 bg-teal-50/60 p-5 dark:border-teal-900 dark:bg-teal-950/30">
              <p className="mb-3 text-xs font-semibold uppercase text-teal-800 dark:text-teal-200">Response</p>
              <div className="flex flex-wrap items-center gap-2 text-xl leading-10">
                {question.fixedPrefix ? <span>{question.fixedPrefix}</span> : null}
                {Array.from({ length: slotCount }).map((_, index) => {
                  const token = selectedTokens[index];
                  const isActive = activeSlot === index;
                  return token ? (
                    <button key={`${token.id}-${index}`} type="button" className={`min-h-10 rounded-md border px-3 py-1 text-lg font-medium shadow-sm transition ${isActive ? "border-action ring-2 ring-action/30" : "border-slate-300"}`} style={{ backgroundColor: token.color }} onClick={() => removeToken(index)}>
                      {token.text}
                    </button>
                  ) : (
                    <button key={`slot-${index}`} type="button" className={`h-11 min-w-24 rounded-sm border-2 border-dashed px-4 transition ${isActive ? "border-action bg-blue-50" : "border-slate-300 bg-slate-50"}`} onClick={() => setActiveSlot(index)} aria-label={`Sentence slot ${index + 1}`} />
                  );
                })}
                {question.fixedSuffix ? <span>{question.fixedSuffix}</span> : null}
              </div>
              <p className="mt-4 min-h-6 text-sm text-muted">{preview || "Select the words below to complete the sentence."}</p>
            </div>
          </div>
          <div className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="mb-3 text-xs font-semibold uppercase text-muted">Word bank</p>
            <div className="flex flex-wrap justify-center gap-3">
              {availableTokens.map((token) => (
                <button key={token.id} type="button" className="rounded-md border border-slate-300 px-4 py-2 text-lg font-medium shadow-sm transition hover:border-action hover:text-action dark:border-slate-700" style={{ backgroundColor: token.color }} onClick={() => placeToken(token.id)}>
                  {token.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuildSentenceInlinePanel({ question, answer, onAnswer }: {
  question: TestQuestion;
  answer?: AnswerValue;
  onAnswer?: (value: AnswerValue) => void;
}) {
  return <BuildSentenceFallbackPanel question={question} answer={answer} onAnswer={onAnswer} />;
}

function speakingDisplayConfig(question?: TestQuestion): Required<SpeakingImageDisplay> {
  return {
    fit: question?.speakingImageDisplay?.fit || "center_crop",
    scale: question?.speakingImageDisplay?.scale || 1.1,
    objectPosition: question?.speakingImageDisplay?.objectPosition || "50% 50%",
    translateY: question?.speakingImageDisplay?.translateY || "0%"
  };
}

function SpeakingImagePanel({ testId, question, assets, fullWidth }: {
  testId: string;
  question: TestQuestion;
  assets: TestAssetRecord[];
  fullWidth?: boolean;
}) {
  const asset = assets.find((item) => item.id === question.imageAssetId);
  const src = asset ? publicAssetPath(testId, asset.file) : null;
  const display = speakingDisplayConfig(question);
  const isCrop = display.fit === "center_crop";
  if (!src) return <section className={`${fullWidth ? "" : "border-r"} h-full min-h-0 border-line bg-white dark:border-slate-700 dark:bg-slate-900`} />;
  const isVideo = asset?.file?.toLowerCase().endsWith(".mp4") || asset?.mimeType === "audio/mp4";
  const videoSrc = isVideo && typeof question.videoStartSeconds === "number"
    ? `${src}#t=${question.videoStartSeconds}${typeof question.videoEndSeconds === "number" ? `,${question.videoEndSeconds}` : ""}`
    : src;
  return (
    <section className={`${fullWidth ? "" : "border-r"} h-full min-h-0 overflow-hidden border-line bg-white dark:border-slate-700 dark:bg-slate-900`}>
      <div className="flex h-full min-h-[420px] items-center justify-center overflow-hidden p-3 md:min-h-[560px] md:p-5">
        <div className="relative h-full max-h-[820px] w-full max-w-[980px] overflow-hidden bg-white">
          {isVideo ? (
            <video
              key={`${question.id}:${videoSrc}`}
              src={videoSrc}
              className="absolute inset-0 h-full w-full object-contain"
              controls
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={asset?.title || `Speaking question ${question.number} material`}
              className="absolute inset-0 h-full w-full object-contain"
              style={{
                objectPosition: display.objectPosition,
                transform: isCrop ? `translateY(${display.translateY}) scale(${display.scale})` : undefined,
                transformOrigin: display.objectPosition
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export function StimulusPanel({ testId, passage, question, assets, blankAnswers, onBlankChange, answer, onAnswer, fullWidth }: {
  testId: string;
  passage?: Passage;
  question?: TestQuestion;
  assets: TestAssetRecord[];
  blankAnswers?: Record<string, string>;
  onBlankChange?: (blankId: string, value: string) => void;
  answer?: AnswerValue;
  onAnswer?: (value: AnswerValue) => void;
  fullWidth?: boolean;
}) {
  const originalAssets = useMemo(() => (passage?.originalAssetIds || [])
    .map((assetId) => assets.find((asset) => asset.id === assetId))
    .filter(isVisualAsset), [assets, passage?.originalAssetIds]);
  const canShowStructuredText = Boolean(passage?.paragraphs.length && passage.extractionStatus !== "needs_review" && passage.extractionStatus !== "source_only");
  const [displayMode, setDisplayMode] = useState<"structured_text" | "source_image">(() => canShowStructuredText ? "structured_text" : "source_image");
  const [zoom, setZoom] = useState(1);
  const visualAssets = [
    question?.imageAssetId,
    ...(question?.assetIds || [])
  ]
    .filter((assetId, index, all): assetId is string => Boolean(assetId) && all.indexOf(assetId) === index)
    .map((assetId) => assets.find((asset) => asset.id === assetId))
    .filter(isVisualAsset);

  if (question?.type === "build_sentence") {
    return <BuildSentenceInlinePanel question={question} answer={answer} onAnswer={onAnswer} />;
  }

  if (question?.section === "speaking" && question.imageAssetId) {
    return <SpeakingImagePanel testId={testId} question={question} assets={assets} fullWidth={fullWidth} />;
  }

  if (passage && passage.paragraphs.length > 0 && (displayMode === "structured_text" || originalAssets.length > 0)) {
    const showOriginal = displayMode === "source_image" && originalAssets.length > 0;
    return (
      <section className={`${fullWidth ? "" : "border-r"} h-full min-h-0 overflow-auto border-line bg-[#f7f8fb] p-6 dark:border-slate-700 dark:bg-slate-900`}>
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          {originalAssets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`rounded-md border px-3 py-1 text-sm ${displayMode === "structured_text" ? "border-action text-action" : "border-line"}`} onClick={() => setDisplayMode("structured_text")}>View text</button>
              <button type="button" className={`rounded-md border px-3 py-1 text-sm ${displayMode === "source_image" ? "border-action text-action" : "border-line"}`} onClick={() => setDisplayMode("source_image")}>View original</button>
            </div>
          ) : null}
        </div>
        {showOriginal ? (
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" className="rounded-md border border-line px-3 py-1 text-sm" onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.1).toFixed(1))))}>-</button>
              <button type="button" className="rounded-md border border-line px-3 py-1 text-sm" onClick={() => setZoom(1)}>100%</button>
              <button type="button" className="rounded-md border border-line px-3 py-1 text-sm" onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.1).toFixed(1))))}>+</button>
              <button type="button" className="rounded-md border border-line px-3 py-1 text-sm" onClick={() => setZoom(0.95)}>Fit width</button>
            </div>
            <div className="overflow-auto">
              {originalAssets.map((asset) => {
                const src = publicAssetPath(testId, asset.file);
                return src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={asset.id} src={src} alt={asset.title || "Original reading material"} className="block h-auto origin-top-left object-contain object-top" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }} />
                ) : null;
              })}
            </div>
          </div>
        ) : (
          <StructuredReadingMaterial passage={passage} question={question} blankAnswers={blankAnswers} onBlankChange={onBlankChange} onAnswer={onAnswer} />
        )}
      </section>
    );
  }

  if (visualAssets.length > 0) {
    const isListeningVisual = question?.section === "listening";
    const isWritingLongResponse = question?.section === "writing" && (question.type === "write_email" || question.type === "academic_discussion");
    if (isListeningVisual) {
      return (
        <section className={`${fullWidth ? "" : "border-r"} h-full min-h-0 overflow-hidden border-line bg-white dark:border-slate-700 dark:bg-slate-900`}>
          <div className="flex h-full min-h-[420px] items-center justify-center overflow-hidden p-4 md:min-h-[560px] md:p-6">
            <div className="flex h-[68%] w-[72%] items-center justify-center overflow-hidden">
              {visualAssets.map((asset) => {
                const src = publicAssetPath(testId, asset.file);
                if (!src) return null;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={asset.id}
                    src={src}
                    alt={asset.title || "Listening question material"}
                    className="block h-full w-full object-contain object-center"
                  />
                );
              })}
            </div>
          </div>
        </section>
      );
    }
    return (
      <section className={`${fullWidth ? "" : "border-r"} h-full min-h-0 overflow-auto border-line bg-white dark:border-slate-700 dark:bg-slate-900`}>
        <div className="flex h-full min-h-0 items-start justify-center overflow-auto p-4">
          <div className="grid w-full justify-items-center gap-4">
            {visualAssets.map((asset) => {
              const src = publicAssetPath(testId, asset.file);
              if (!src) return null;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={asset.id} src={src} alt={asset.title || "Question material"} className={`block h-auto object-contain object-top ${isWritingLongResponse ? "max-w-[86%]" : "max-w-full"}`} />
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return <section className="h-full min-h-0 overflow-auto border-r border-line bg-white dark:border-slate-700 dark:bg-slate-900" />;
}
