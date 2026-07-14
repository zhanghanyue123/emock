import { DEFAULT_SETTINGS, LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/lib/constants";
import type { AttemptHistoryItem, PracticeHistoryItem, PracticeSession, MistakeItem } from "@/types/practice";
import type { AppSettings } from "@/types/settings";

function legacyKeyFor(key: string) {
  return Object.entries(STORAGE_KEYS).find(([, value]) => value === key)?.[0] as keyof typeof LEGACY_STORAGE_KEYS | undefined;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
    const legacyName = legacyKeyFor(key);
    const legacyKey = legacyName ? LEGACY_STORAGE_KEYS[legacyName] : undefined;
    const legacyRaw = legacyKey ? window.localStorage.getItem(legacyKey) : null;
    if (!legacyRaw) return fallback;
    window.localStorage.setItem(key, legacyRaw);
    const log = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.migrationLog) || "[]") as unknown[];
    window.localStorage.setItem(STORAGE_KEYS.migrationLog, JSON.stringify([...log, { key, legacyKey, migratedAt: new Date().toISOString(), schemaVersion: 1 }]));
    return JSON.parse(legacyRaw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function unwrapSession(value: unknown): PracticeSession | null {
  const maybe = value as PracticeSession | { session?: PracticeSession } | undefined;
  if (!maybe) return null;
  return "session" in maybe && maybe.session ? maybe.session : (maybe as PracticeSession);
}

export const storage = {
  getSettings: () => readJson<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
  setSettings: (settings: AppSettings) => writeJson(STORAGE_KEYS.settings, settings),
  getRawSessions: () => readJson<Record<string, unknown>>(STORAGE_KEYS.sessions, {}),
  saveRawSession: (key: string, value: unknown) => {
    const sessions = storage.getRawSessions();
    sessions[key] = value;
    writeJson(STORAGE_KEYS.sessions, sessions);
  },
  getSessions: () => {
    const raw = readJson<Record<string, unknown>>(STORAGE_KEYS.sessions, {});
    return Object.fromEntries(
      Object.entries(raw)
        .map(([key, value]) => [key, unwrapSession(value)] as const)
        .filter((entry): entry is readonly [string, PracticeSession] => Boolean(entry[1]))
    );
  },
  setSessions: (sessions: Record<string, PracticeSession>) => writeJson(STORAGE_KEYS.sessions, sessions),
  getSession: (key: string) => unwrapSession(readJson<Record<string, unknown>>(STORAGE_KEYS.sessions, {})[key]) || undefined,
  saveSession: (key: string, session: PracticeSession) => {
    const sessions = storage.getSessions();
    sessions[key] = session;
    writeJson(STORAGE_KEYS.sessions, sessions);
    writeJson(STORAGE_KEYS.lastSession, { testId: session.testId, section: session.section });
  },
  setLastSession: (session: { testId: string; section: string }) => writeJson(STORAGE_KEYS.lastSession, session),
  getLastSession: () => readJson<{ testId: string; section: string } | null>(STORAGE_KEYS.lastSession, null),
  getHistory: () => readJson<(PracticeHistoryItem | AttemptHistoryItem)[]>(STORAGE_KEYS.history, []),
  setHistory: (history: (PracticeHistoryItem | AttemptHistoryItem)[]) => writeJson(STORAGE_KEYS.history, history),
  getMistakes: () => readJson<MistakeItem[]>(STORAGE_KEYS.mistakes, []),
  setMistakes: (mistakes: MistakeItem[]) => writeJson(STORAGE_KEYS.mistakes, mistakes),
  clearProgress: () => {
    window.localStorage.removeItem(STORAGE_KEYS.sessions);
    window.localStorage.removeItem(STORAGE_KEYS.history);
    window.localStorage.removeItem(STORAGE_KEYS.lastSession);
  },
  clearMistakes: () => window.localStorage.removeItem(STORAGE_KEYS.mistakes)
};
