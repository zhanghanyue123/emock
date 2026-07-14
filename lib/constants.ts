export const STORAGE_KEYS = {
  settings: "exam.settings",
  sessions: "exam.sessions",
  history: "exam.history",
  mistakes: "exam.mistakes",
  lastSession: "exam.lastSession",
  vocabulary: "exam.vocabulary",
  aiScoring: "exam.aiScoring",
  migrationLog: "exam.migrationLog"
} as const;

export const LEGACY_STORAGE_KEYS = {
  settings: "toefl.settings",
  sessions: "toefl.sessions",
  history: "toefl.history",
  mistakes: "toefl.mistakes",
  lastSession: "toefl.lastSession",
  vocabulary: "toefl.vocabulary"
} as const;

export const SECTION_KEYS = ["reading", "listening", "speaking", "writing"] as const;

export const DEFAULT_SETTINGS = {
  language: "en",
  practiceMode: true,
  showCountdown: true,
  defaultPlaybackRate: 1,
  autosave: true,
  darkMode: false
} as const;

export const PRACTICE_SESSION_SCHEMA_VERSION = 2;
export const VOCABULARY_SCHEMA_VERSION = 1;
