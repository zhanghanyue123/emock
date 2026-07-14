"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExamHeader } from "./ExamHeader";
import { PauseOverlay } from "./PauseOverlay";
import { SectionInstructions } from "./SectionInstructions";
import { StimulusPanel } from "./StimulusPanel";
import { StructuredQuestionPanel } from "./QuestionPanel";
import { Button } from "@/components/ui/Button";
import { LocalStorageAttemptRepository } from "@/lib/repositories/attempt-repository";
import { scoreStructuredAttempt } from "@/lib/structured-scoring";
import { storage } from "@/lib/storage";
import { queueAiScoringForAttempt } from "@/lib/ai-scoring/client-store";
import type { AttemptHistoryItem, AttemptTimingState, PauseConfig, PracticeRunMode, PracticeSession } from "@/types/practice";
import type { AnswerValue, SectionKey } from "@/types/test";
import type { StructuredTestBundle } from "@/types/structured-test";
import type { TestQuestion } from "@/types/structured-test";

const attemptRepository = new LocalStorageAttemptRepository();
const EXAM_SECTION_ORDER: SectionKey[] = ["reading", "listening", "writing", "speaking"];

function nowIso() {
  return new Date().toISOString();
}

function secondsBetween(start?: string, end = nowIso()) {
  if (!start) return 0;
  return Math.max(0, Math.floor((Date.parse(end) - Date.parse(start)) / 1000));
}

function initialTiming(durationSeconds: number): AttemptTimingState {
  const now = nowIso();
  return {
    status: "running",
    scope: "section",
    durationSeconds,
    remainingSeconds: durationSeconds,
    startedAt: now,
    lastTickAt: now,
    pauseCount: 0,
    totalPausedSeconds: 0
  };
}

function reconcileTiming(timing: AttemptTimingState): AttemptTimingState {
  if (timing.status !== "running") return timing;
  const elapsed = secondsBetween(timing.lastTickAt);
  const remainingSeconds = Math.max(0, timing.remainingSeconds - elapsed);
  return {
    ...timing,
    status: remainingSeconds <= 0 ? "expired" : "running",
    remainingSeconds,
    lastTickAt: nowIso(),
    expiredAt: remainingSeconds <= 0 ? nowIso() : timing.expiredAt
  };
}

function pauseAllowed(timing: AttemptTimingState, config: PauseConfig) {
  if (timing.remainingSeconds <= 0 || timing.status === "expired" || timing.status === "completed") return { ok: false, reason: "Timer is no longer running." };
  if (config.policy === "disabled") return { ok: false, reason: "Pause is disabled for this exam." };
  if (config.maxPauseCount !== undefined && timing.pauseCount >= config.maxPauseCount) return { ok: false, reason: "Pause limit reached." };
  if (config.maxTotalPauseSeconds !== undefined && timing.totalPausedSeconds >= config.maxTotalPauseSeconds) return { ok: false, reason: "Total pause time limit reached." };
  return { ok: true, reason: "" };
}

interface DisplayUnit {
  id: string;
  questions: TestQuestion[];
  label: string;
}

function isCompleteWords(question: TestQuestion) {
  return question.type === "complete_words";
}

function displayUnitsFor(questions: TestQuestion[]): DisplayUnit[] {
  const units: DisplayUnit[] = [];
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (isCompleteWords(question)) {
      const group = [question];
      let cursor = index + 1;
      while (
        cursor < questions.length &&
        isCompleteWords(questions[cursor]) &&
        questions[cursor].moduleId === question.moduleId &&
        questions[cursor].passageId === question.passageId &&
        questions[cursor].number === questions[cursor - 1].number + 1
      ) {
        group.push(questions[cursor]);
        cursor += 1;
      }
      const first = group[0].number;
      const last = group.at(-1)?.number || first;
      units.push({ id: `${question.moduleId}-complete-words-${first}-${last}`, questions: group, label: first === last ? `Question ${first}` : `Questions ${first}-${last}` });
      index = cursor - 1;
      continue;
    }
    units.push({ id: question.id, questions: [question], label: `Question ${question.number}` });
  }
  return units;
}

function officialLabel(sectionKey: SectionKey, unit: DisplayUnit, moduleQuestions: TestQuestion[], allQuestions: TestQuestion[]) {
  const first = unit.questions[0];
  const last = unit.questions.at(-1) || first;
  const maxQuestion = Math.max(...moduleQuestions.map((question) => question.number), last.number);
  const modulePart = sectionKey === "reading" && new Set(allQuestions.map((item) => item.moduleId)).size > 1 ? ` · ${first.moduleId.endsWith("m2") ? "MODULE 2" : "MODULE 1"}` : "";
  const questionPart = first.number === last.number ? `QUESTION ${first.number}` : `QUESTIONS ${first.number}-${last.number}`;
  return `${modulePart ? `${modulePart.slice(3)} · ` : ""}${questionPart} OF ${maxQuestion}`;
}

function nextSectionKey(bundle: StructuredTestBundle, current: SectionKey) {
  const currentIndex = EXAM_SECTION_ORDER.indexOf(current);
  return EXAM_SECTION_ORDER.slice(currentIndex + 1).find((key) => {
    const section = bundle.test.sections.find((item) => item.key === key);
    return section?.modules.some((module) => module.questions.length > 0);
  });
}

export function ExamShell({ bundle, sectionKey, mode = "review" }: { bundle: StructuredTestBundle; sectionKey: SectionKey; mode?: PracticeRunMode }) {
  const router = useRouter();
  const section = bundle.test.sections.find((item) => item.key === sectionKey);
  const questions = useMemo(() => section?.modules.flatMap((module) => module.questions) || [], [section]);
  const displayUnits = useMemo(() => displayUnitsFor(questions), [questions]);
  const moduleIds = useMemo(() => [...new Set(questions.map((item) => item.moduleId))], [questions]);
  const durationSeconds = section?.durationSeconds || 0;
  const isExamReading = mode === "exam" && sectionKey === "reading";
  const activeDurationSeconds = isExamReading ? Math.floor(durationSeconds / Math.max(1, moduleIds.length)) : durationSeconds;
  const pauseConfig: PauseConfig = { policy: mode === "exam" ? "disabled" : "allowed", showPausedOverlay: true };
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [startedAt] = useState(() => new Date().toISOString());
  const [timing, setTiming] = useState<AttemptTimingState>(() => initialTiming(activeDurationSeconds));
  const [ready, setReady] = useState(false);
  const [lockedModuleIds, setLockedModuleIds] = useState<string[]>([]);
  const [transition, setTransition] = useState<{ title: string; body: string } | null>(null);
  const unit = displayUnits[currentIndex];
  const unitQuestions = unit?.questions || [];
  const question = unitQuestions[0];
  const currentModuleId = question?.moduleId || "";
  const passage = bundle.passages.find((item) => item.id === question?.passageId);
  const activeSection = section;
  const moduleQuestions = questions.filter((item) => item.moduleId === question?.moduleId);

  async function saveProgress(nextTiming = timing, status: PracticeSession["status"] = nextTiming.status === "paused" ? "paused" : nextTiming.status === "expired" ? "expired" : "in_progress") {
    const now = nowIso();
    await attemptRepository.saveAttempt({
      id: `${bundle.test.id}:${sectionKey}`,
      schemaVersion: 2,
      testId: bundle.test.id,
      section: sectionKey,
      status,
      mode,
      answers,
      currentQuestion: currentIndex,
      currentPdfPage: 1,
      currentAudio: 0,
      audioPlayback: {},
      remainingSeconds: nextTiming.remainingSeconds,
      timingState: nextTiming,
      pauseConfig,
      flaggedQuestions: [],
      notes: {},
      startedAt: nextTiming.startedAt || startedAt,
      updatedAt: now
    });
  }

  function setAnswer(questionId: string, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function setBlankAnswer(blankId: string, value: string) {
    const owner = unitQuestions.find((item) => item.blanks?.some((blank) => blank.id === blankId)) || question;
    if (!owner) return;
    const current = answers[owner.id];
    const next = typeof current === "object" && !Array.isArray(current) ? { ...current, [blankId]: value } : { [blankId]: value };
    setAnswer(owner.id, next);
  }

  async function submit(confirmFirst: boolean, nextAction: "review" | "next-section" = "review") {
    if (!activeSection) return;
    if (confirmFirst) {
      const confirmed = window.confirm(`Submit this structured ${activeSection.title} section?`);
      if (!confirmed) return;
    }
    const now = nowIso();
    const finalTiming = { ...timing, status: "completed" as const, completedAt: now, lastTickAt: now };
    const score = scoreStructuredAttempt(questions, answers);
    const session: PracticeSession = {
      id: `${bundle.test.id}:${sectionKey}`,
      schemaVersion: 2,
      testId: bundle.test.id,
      section: sectionKey,
      status: "submitted",
      mode,
      answers,
      currentQuestion: currentIndex,
      currentPdfPage: 1,
      currentAudio: 0,
      audioPlayback: {},
      remainingSeconds: finalTiming.remainingSeconds,
      timingState: finalTiming,
      pauseConfig,
      flaggedQuestions: [],
      notes: {},
      startedAt,
      updatedAt: now,
      submittedAt: now,
      score
    };
    await attemptRepository.submitAttempt(session);
    const history: AttemptHistoryItem = {
      id: `${bundle.test.id}:${sectionKey}`,
      testId: bundle.test.id,
      testTitle: bundle.test.title,
      section: sectionKey,
      answers,
      score,
      flaggedQuestions: [],
      notes: {},
      startedAt,
      updatedAt: now,
      submittedAt: now,
      secondsSpent: Math.max(0, (activeSection.durationSeconds || 0) - finalTiming.remainingSeconds),
      durationSeconds: Math.max(0, (activeSection.durationSeconds || 0) - finalTiming.remainingSeconds)
    };
    storage.setHistory([history, ...storage.getHistory().filter((entry) => !(entry.testId === bundle.test.id && entry.section === sectionKey))]);
    if (sectionKey === "writing" || sectionKey === "speaking") {
      void queueAiScoringForAttempt({
        attemptId: `${bundle.test.id}:${sectionKey}`,
        questions,
        answers,
        responseDurationSeconds: Math.max(0, (activeSection.durationSeconds || 0) - finalTiming.remainingSeconds)
      });
    }
    if (nextAction === "next-section") {
      const next = nextSectionKey(bundle, sectionKey);
      setTransition(next
        ? { title: `${activeSection.title} Complete`, body: `Moving to ${next.charAt(0).toUpperCase()}${next.slice(1)}...` }
        : { title: "Exam Complete", body: "Generating results..." });
      window.setTimeout(() => {
        router.push(next ? `/practice/${bundle.test.id}/${next}?mode=exam` : `/review/${bundle.test.id}/${sectionKey}`);
      }, 1400);
      return;
    }
    router.push(`/review/${bundle.test.id}/${sectionKey}`);
  }

  function firstDisplayIndexForModule(moduleId: string) {
    return Math.max(0, displayUnits.findIndex((item) => item.questions[0]?.moduleId === moduleId));
  }

  async function completeReadingModule(confirmFirst: boolean) {
    if (!isExamReading || !currentModuleId) return false;
    const currentModuleIndex = moduleIds.indexOf(currentModuleId);
    const nextModuleId = moduleIds[currentModuleIndex + 1];
    if (!nextModuleId) return false;
    if (confirmFirst) {
      const confirmed = window.confirm("Submit this Reading module and continue to the next module?");
      if (!confirmed) return true;
    }
    setLockedModuleIds((current) => current.includes(currentModuleId) ? current : [...current, currentModuleId]);
    setCurrentIndex(firstDisplayIndexForModule(nextModuleId));
    setTiming(initialTiming(activeDurationSeconds));
    await saveProgress({ ...timing, status: "completed", completedAt: nowIso(), remainingSeconds: 0 }, "in_progress");
    return true;
  }

  function pausePractice() {
    const allowed = pauseAllowed(timing, pauseConfig);
    if (!allowed.ok) return;
    const next = { ...reconcileTiming(timing), status: "paused" as const, pausedAt: nowIso(), pauseCount: timing.pauseCount + 1 };
    setTiming(next);
    void saveProgress(next, "paused");
  }

  function resumePractice() {
    if (timing.status === "expired" || timing.status === "completed") return;
    const now = nowIso();
    const totalPausedSeconds = timing.totalPausedSeconds + secondsBetween(timing.pausedAt, now);
    const next = { ...timing, status: "running" as const, resumedAt: now, lastTickAt: now, totalPausedSeconds };
    setTiming(next);
    void saveProgress(next, "in_progress");
  }

  function saveAndExit() {
    void saveProgress(timing, "paused").then(() => router.push(`/tests/${bundle.test.id}`));
  }

  const pauseState = pauseAllowed(timing, pauseConfig);

  useEffect(() => {
    let active = true;
    void attemptRepository.getAttempt(bundle.test.id, sectionKey).then((saved) => {
      if (!active) return;
      if (saved && saved.status !== "submitted") {
        const nextTiming = reconcileTiming(saved.timingState || initialTiming(durationSeconds));
        setAnswers(saved.answers || {});
        const savedIndex = Math.min(saved.currentQuestion || 0, Math.max(0, displayUnits.length - 1));
        setCurrentIndex(savedIndex);
        const savedModuleId = displayUnits[savedIndex]?.questions[0]?.moduleId;
        if (mode === "exam" && sectionKey === "reading" && savedModuleId) {
          const savedModuleIndex = moduleIds.indexOf(savedModuleId);
          setLockedModuleIds(savedModuleIndex > 0 ? moduleIds.slice(0, savedModuleIndex) : []);
        }
        setTiming(nextTiming);
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [bundle.test.id, displayUnits, displayUnits.length, durationSeconds, mode, moduleIds, sectionKey]);

  useEffect(() => {
    if (!ready || timing.status !== "running") return;
    const timer = window.setInterval(() => {
      setTiming((current) => reconcileTiming(current));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ready, timing.status]);

  useEffect(() => {
    if (!ready) return;
    const saveTimer = window.setTimeout(() => {
      void saveProgress();
    }, 300);
    return () => window.clearTimeout(saveTimer);
  });

  useEffect(() => {
    if (timing.status !== "expired" || mode !== "exam") return;
    if (sectionKey === "reading") {
      void completeReadingModule(false).then((moved) => {
        if (!moved) void submit(false, "next-section");
      });
      return;
    }
    void submit(false, "next-section");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timing.status, mode]);

  if (!activeSection || !question || !unit) return <div className="mx-auto max-w-3xl p-6 text-sm text-muted">This structured section has no questions yet.</div>;
  const blankAnswers = Object.fromEntries(
    unitQuestions.flatMap((item) => Object.entries((answers[item.id] && typeof answers[item.id] === "object" && !Array.isArray(answers[item.id]) ? answers[item.id] : {}) as Record<string, string>))
  );
  const stimulusQuestion = unitQuestions.length > 1 && question.type === "complete_words"
    ? { ...question, blanks: unitQuestions.flatMap((item) => item.blanks || []) }
    : question;
  const isCompleteWordsUnit = question.type === "complete_words" && unitQuestions.length > 1;
  const previousUnit = displayUnits[currentIndex - 1];
  const nextUnit = displayUnits[currentIndex + 1];
  const previousDisabled = currentIndex === 0 || Boolean(isExamReading && previousUnit && lockedModuleIds.includes(previousUnit.questions[0]?.moduleId || ""));
  const nextDisabled = currentIndex >= displayUnits.length - 1 || Boolean(isExamReading && nextUnit && nextUnit.questions[0]?.moduleId !== currentModuleId);
  function autoAdvanceSpeaking() {
    if (mode !== "exam" || sectionKey !== "speaking") return;
    if (currentIndex < displayUnits.length - 1) {
      setCurrentIndex((value) => Math.min(displayUnits.length - 1, value + 1));
      return;
    }
    void submit(false, "next-section");
  }

  return (
    <div>
      <ExamHeader
        title={bundle.test.title}
        sectionTitle={activeSection.title}
        questionLabel={officialLabel(sectionKey, unit, moduleQuestions, questions)}
        remainingSeconds={timing.remainingSeconds}
        onSubmit={() => {
          if (mode === "exam" && sectionKey === "reading") {
            void completeReadingModule(true).then((moved) => {
              if (!moved) void submit(true, "next-section");
            });
            return;
          }
          void submit(true, mode === "exam" ? "next-section" : "review");
        }}
        pauseAllowed={pauseState.ok}
        pauseReason={pauseState.reason}
        paused={timing.status === "paused"}
        onPause={pausePractice}
        onResume={resumePractice}
        mode={mode}
      />
      {timing.status === "expired" && mode === "review" ? (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          Time is up. Review mode keeps this section open so you can continue checking your answers.
        </div>
      ) : null}
      <SectionInstructions instructions={activeSection.instructions} />
      {isCompleteWordsUnit ? (
        <div className="mx-auto max-w-7xl pb-20 md:h-[calc(100vh-10.5rem)] md:pb-0">
          <StimulusPanel
            key={`${question.id}:${question.passageId || "complete-words"}`}
            testId={bundle.test.id}
            passage={passage}
            question={stimulusQuestion}
            assets={bundle.assets}
            blankAnswers={blankAnswers}
            onBlankChange={setBlankAnswer}
            answer={answers[question.id]}
            onAnswer={(value) => setAnswer(question.id, value)}
            fullWidth
          />
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl pb-20 md:h-[calc(100vh-10.5rem)] md:grid-cols-[minmax(0,1.4fr)_minmax(380px,1fr)] md:pb-0">
          <StimulusPanel
            key={`${question.id}:${question.passageId || question.imageAssetId || question.assetIds?.join(",") || "no-stimulus"}`}
            testId={bundle.test.id}
            passage={passage}
            question={stimulusQuestion}
            assets={bundle.assets}
            blankAnswers={blankAnswers}
            onBlankChange={setBlankAnswer}
            answer={answers[question.id]}
            onAnswer={(value) => setAnswer(question.id, value)}
          />
          <StructuredQuestionPanel
            question={question}
            groupedQuestions={unitQuestions}
            answer={answers[question.id]}
            groupedAnswers={answers}
            displayLabel={unit.label}
            onAnswer={(value) => setAnswer(question.id, value)}
            testId={bundle.test.id}
            assets={bundle.assets}
            audioGroups={bundle.audioGroups}
            mode={mode}
            onAutoAdvance={autoAdvanceSpeaking}
          />
        </div>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 md:sticky">
        <div className="mx-auto flex max-w-7xl justify-between">
          <Button disabled={previousDisabled} onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}>Previous</Button>
          <Button disabled={nextDisabled} onClick={() => setCurrentIndex((value) => Math.min(displayUnits.length - 1, value + 1))} variant="primary">Next</Button>
        </div>
      </div>
      {transition ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white/95 px-6 text-center backdrop-blur dark:bg-slate-950/95">
          <div>
            <p className="text-2xl font-semibold">{transition.title}</p>
            <p className="mt-2 text-sm text-muted">{transition.body}</p>
          </div>
        </div>
      ) : null}
      {timing.status === "paused" && pauseConfig.showPausedOverlay !== false ? <PauseOverlay onResume={resumePractice} onExit={saveAndExit} /> : null}
    </div>
  );
}
