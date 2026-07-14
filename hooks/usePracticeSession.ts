"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PRACTICE_SESSION_SCHEMA_VERSION } from "@/lib/constants";
import { LocalStorageAttemptRepository, attemptKey } from "@/lib/repositories/attempt-repository";
import type { PracticeSession } from "@/types/practice";
import type { AnswerValue, SectionKey } from "@/types/test";

export function sessionKey(testId: string, section: SectionKey) {
  return attemptKey(testId, section);
}

const attemptRepository = new LocalStorageAttemptRepository();

export function usePracticeSession(testId: string, section: SectionKey, durationMinutes: number) {
  const key = useMemo(() => sessionKey(testId, section), [section, testId]);
  const [session, setSession] = useState<PracticeSession>(() => ({
    id: key,
    schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION,
    testId,
    section,
    status: "in_progress",
    answers: {},
    currentQuestion: 0,
    currentPdfPage: 1,
    currentAudio: 0,
    audioPlayback: {},
    remainingSeconds: durationMinutes * 60,
    flaggedQuestions: [],
    notes: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    attemptRepository.getAttempt(testId, section).then((saved) => {
      if (!active) return;
      if (saved) setSession(saved);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [section, testId]);

  const updateSession = useCallback(
    (update: Partial<PracticeSession> | ((current: PracticeSession) => PracticeSession)) => {
      setSession((current) => {
        const next =
          typeof update === "function"
            ? update(current)
            : { ...current, ...update, updatedAt: new Date().toISOString() };
        return next;
      });
    },
    []
  );

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void attemptRepository.saveAttempt(session);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ready, session]);

  const setAnswer = useCallback(
    (questionId: string, answer: AnswerValue) => {
      updateSession((current) => ({
        ...current,
        answers: { ...current.answers, [questionId]: answer },
        updatedAt: new Date().toISOString()
      }));
    },
    [updateSession]
  );

  const setNote = useCallback(
    (questionId: string, note: string) => {
      updateSession((current) => ({
        ...current,
        notes: { ...current.notes, [questionId]: note },
        updatedAt: new Date().toISOString()
      }));
    },
    [updateSession]
  );

  const toggleFlag = useCallback(
    (questionId: string) => {
      updateSession((current) => {
        const flagged = new Set(current.flaggedQuestions);
        if (flagged.has(questionId)) flagged.delete(questionId);
        else flagged.add(questionId);
        return { ...current, flaggedQuestions: [...flagged], updatedAt: new Date().toISOString() };
      });
    },
    [updateSession]
  );

  useEffect(() => {
    const save = () => void attemptRepository.saveAttempt({ ...session, updatedAt: new Date().toISOString() });
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, [session]);

  return { session, ready, updateSession, setAnswer, setNote, toggleFlag };
}
