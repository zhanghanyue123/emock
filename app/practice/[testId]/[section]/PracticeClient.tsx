"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioPlayer } from "@/components/practice/AudioPlayer";
import { PdfViewer } from "@/components/practice/PdfViewer";
import { PracticeHeader } from "@/components/practice/PracticeHeader";
import { QuestionNavigator } from "@/components/practice/QuestionNavigator";
import { QuestionPanel } from "@/components/practice/QuestionPanel";
import { Button } from "@/components/ui/Button";
import { useCountdown } from "@/hooks/useCountdown";
import { usePracticeSession } from "@/hooks/usePracticeSession";
import { useSettings } from "@/hooks/useSettings";
import { publicAssetPath } from "@/lib/assets";
import { LocalStorageAttemptRepository } from "@/lib/repositories/attempt-repository";
import { scoreAttempt, isAnswerPresent } from "@/lib/scoring";
import { storage } from "@/lib/storage";
import type { AttemptHistoryItem } from "@/types/practice";
import type { SectionKey, TestManifest } from "@/types/test";

export function PracticeClient({ test, sectionKey }: { test: TestManifest; sectionKey: SectionKey }) {
  const section = test.sections[sectionKey];
  const router = useRouter();
  const { settings } = useSettings();
  const { session, updateSession, setAnswer, setNote, toggleFlag } = usePracticeSession(test.id, sectionKey, section.durationMinutes);
  const [mobileView, setMobileView] = useState<"pdf" | "answers">("pdf");
  const questions = section.questions;
  const currentQuestion = questions[session.currentQuestion];
  const pdfSrc = publicAssetPath(test.id, section.pdf);
  const expectedPath = `content/${test.id}/${section.pdf || "pdf/questions.pdf"}`;
  const attemptRepository = useMemo(() => new LocalStorageAttemptRepository(), []);

  const startNewAttempt = useCallback(async () => {
    await attemptRepository.deleteAttempt(test.id, sectionKey);
    window.location.reload();
  }, [attemptRepository, sectionKey, test.id]);

  const submit = useCallback(() => {
    if (session.status === "submitted") return;
    const answered = questions.filter((question) => isAnswerPresent(session.answers[question.id])).length;
    const unanswered = Math.max(0, questions.length - answered);
    const flagged = session.flaggedQuestions.length;
    const confirmed = window.confirm(
      `Submit this practice?\n\nAnswered: ${answered}\nUnanswered: ${unanswered}\nFlagged: ${flagged}\n\nYou will not be able to edit this submitted attempt.`
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    const score = scoreAttempt(questions, session.answers);
    const submitted = { ...session, status: "submitted" as const, submittedAt: now, updatedAt: now, score };
    void attemptRepository.submitAttempt(submitted);
    const secondsSpent = Math.max(0, section.durationMinutes * 60 - submitted.remainingSeconds);
    const item: AttemptHistoryItem = {
      id: `${test.id}:${sectionKey}`,
      testId: test.id,
      testTitle: test.title,
      section: sectionKey,
      answers: { ...submitted.answers },
      score,
      flaggedQuestions: [...submitted.flaggedQuestions],
      notes: { ...submitted.notes },
      startedAt: submitted.startedAt,
      updatedAt: now,
      submittedAt: now,
      secondsSpent,
      durationSeconds: secondsSpent
    };
    storage.setHistory([item, ...storage.getHistory().filter((entry) => !(entry.testId === test.id && entry.section === sectionKey))]);
    router.push(`/review/${test.id}/${sectionKey}`);
  }, [attemptRepository, questions, router, section.durationMinutes, sectionKey, session, test.id, test.title]);

  useCountdown({
    seconds: session.remainingSeconds,
    running: session.status === "in_progress",
    enabled: settings.showCountdown,
    onTick: (seconds) => updateSession({ remainingSeconds: seconds }),
    onDone: () => {
      if (window.confirm("Time is up. Submit this practice now?")) submit();
      else updateSession({ status: "expired" });
    }
  });

  const sidePanel = useMemo(() => (
    <div className="grid gap-4 p-4">
      <AudioPlayer
        testId={test.id}
        items={section.audio || []}
        currentIndex={session.currentAudio}
        practiceMode={settings.practiceMode}
        playbackRate={settings.defaultPlaybackRate}
        onIndexChange={(currentAudio) => updateSession({ currentAudio })}
        playbackStates={session.audioPlayback}
        onPlaybackStateChange={(audioId, state) => {
          if (session.status === "submitted") return;
          updateSession((current) => ({ ...current, audioPlayback: { ...current.audioPlayback, [audioId]: state }, updatedAt: new Date().toISOString() }));
        }}
      />
      <QuestionNavigator
        questions={questions}
        current={session.currentQuestion}
        answers={session.answers}
        flagged={session.flaggedQuestions}
        onSelect={(currentQuestion) => updateSession({ currentQuestion })}
        onPrevious={() => updateSession({ currentQuestion: Math.max(0, session.currentQuestion - 1) })}
        onNext={() => updateSession({ currentQuestion: Math.min(questions.length - 1, session.currentQuestion + 1) })}
        onFlag={() => currentQuestion && session.status !== "submitted" && toggleFlag(currentQuestion.id)}
      />
      <QuestionPanel
        question={currentQuestion}
        answer={currentQuestion ? session.answers[currentQuestion.id] : undefined}
        note={currentQuestion ? session.notes[currentQuestion.id] : ""}
        disabled={session.status === "submitted"}
        onAnswer={(answer) => currentQuestion && session.status !== "submitted" && setAnswer(currentQuestion.id, answer)}
        onNote={(note) => currentQuestion && session.status !== "submitted" && setNote(currentQuestion.id, note)}
      />
    </div>
  ), [currentQuestion, questions, section.audio, session, setAnswer, setNote, settings.defaultPlaybackRate, settings.practiceMode, test.id, toggleFlag, updateSession]);

  return (
    <div>
      <PracticeHeader
        title={test.title}
        section={section.title}
        remainingSeconds={session.remainingSeconds}
        paused={session.status === "paused"}
        onPause={() => session.status !== "submitted" && updateSession({ status: session.status === "paused" ? "in_progress" : "paused" })}
        onSave={() => router.push("/tests")}
        onSubmit={submit}
      />
      {session.status === "submitted" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-100">
          <span>This attempt has been submitted. Answers are locked. Open the review page to see your score.</span>
          <div className="flex gap-2">
            <Button href={`/review/${test.id}/${sectionKey}`} variant="primary">Review score</Button>
            <Button onClick={startNewAttempt}>Start new attempt</Button>
          </div>
        </div>
      ) : null}
      <div className="border-b border-line bg-white p-2 dark:border-slate-700 dark:bg-slate-950 md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={mobileView === "pdf" ? "primary" : "secondary"} onClick={() => setMobileView("pdf")}>Paper</Button>
          <Button variant={mobileView === "answers" ? "primary" : "secondary"} onClick={() => setMobileView("answers")}>Answers</Button>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl md:grid-cols-[minmax(0,1fr)_420px]">
        <div className={mobileView === "pdf" ? "block" : "hidden md:block"}><PdfViewer src={pdfSrc} expectedPath={expectedPath} page={session.currentPdfPage} onPageChange={(currentPdfPage) => session.status !== "submitted" && updateSession({ currentPdfPage })} /></div>
        <aside className={mobileView === "answers" ? "block" : "hidden md:block"}>{sidePanel}</aside>
      </div>
    </div>
  );
}
