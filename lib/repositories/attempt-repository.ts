import { PRACTICE_SESSION_SCHEMA_VERSION, STORAGE_KEYS } from "@/lib/constants";
import { storage } from "@/lib/storage";
import type { PersistedPracticeSession, PracticeSession } from "@/types/practice";

export interface AttemptRepository {
  getAttempt(testId: string, section: string): Promise<PracticeSession | null>;
  saveAttempt(session: PracticeSession): Promise<void>;
  submitAttempt(session: PracticeSession): Promise<void>;
  deleteAttempt(testId: string, section: string): Promise<void>;
}

export function attemptKey(testId: string, section: string) {
  return `${testId}:${section}`;
}

function normalizeSession(raw: unknown): PracticeSession | null {
  const value = raw as PracticeSession | PersistedPracticeSession | undefined;
  if (!value) return null;
  const session = "session" in value ? value.session : value;
  if (!session || typeof session !== "object") return null;
  const now = new Date().toISOString();
  const remainingSeconds = typeof session.remainingSeconds === "number" ? session.remainingSeconds : 0;
  return {
    ...session,
    schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION,
    status: session.status || (session.submittedAt ? "submitted" : "in_progress"),
    currentPdfPage: session.currentPdfPage || 1,
    audioPlayback: session.audioPlayback || {},
    remainingSeconds,
    timingState: session.timingState || {
      status: session.status === "paused" ? "paused" : session.submittedAt ? "completed" : "running",
      scope: "section",
      durationSeconds: remainingSeconds,
      remainingSeconds,
      startedAt: session.startedAt || now,
      lastTickAt: session.updatedAt || now,
      pauseCount: 0,
      totalPausedSeconds: 0
    },
    flaggedQuestions: session.flaggedQuestions || [],
    notes: session.notes || {}
  };
}

export class LocalStorageAttemptRepository implements AttemptRepository {
  async getAttempt(testId: string, section: string) {
    const raw = storage.getRawSessions()[attemptKey(testId, section)];
    return normalizeSession(raw);
  }

  async saveAttempt(session: PracticeSession) {
    const existing = normalizeSession(storage.getRawSessions()[attemptKey(session.testId, session.section)]);
    if (existing?.status === "submitted" && session.status !== "submitted") return;
    const next = { ...session, schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION, updatedAt: new Date().toISOString() };
    storage.saveRawSession(attemptKey(session.testId, session.section), {
      schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION,
      session: next
    });
    storage.setLastSession({ testId: session.testId, section: session.section });
  }

  async submitAttempt(session: PracticeSession) {
    await this.saveAttempt({ ...session, status: "submitted", submittedAt: session.submittedAt || new Date().toISOString() });
  }

  async deleteAttempt(testId: string, section: string) {
    const sessions = storage.getRawSessions();
    delete sessions[attemptKey(testId, section)];
    window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
  }
}
