import type { AnswerValue, SectionKey } from "./test";

export type AttemptStatus = "not_started" | "in_progress" | "paused" | "submitted" | "expired";

export interface AudioPlaybackState {
  audioId?: string;
  currentTime: number;
  duration?: number;
  playbackRate: number;
  volume: number;
  status: "idle" | "loading" | "playing" | "paused" | "ended" | "error";
  playCount: number;
}

export interface SpeakingRecording {
  id: string;
  attemptId: string;
  examId: string;
  sectionId: string;
  questionId: string;
  takeNumber: number;
  dataUrl?: string;
  blobUrl?: string;
  storageKey?: string;
  mimeType: string;
  durationMs: number;
  createdAt: string;
  status: "recording" | "recorded" | "saved" | "uploading" | "uploaded" | "failed";
  mode: "practice" | "full_mock";
}

export interface SpeakingRecordingAnswer {
  recordingsByQuestionId: Record<string, SpeakingRecording[]>;
  selectedRecordingId?: string;
}

export type TimerStatus = "idle" | "running" | "paused" | "expired" | "completed";
export type PracticeRunMode = "exam" | "review";

export interface AttemptTimingState {
  status: TimerStatus;
  scope: "exam" | "section" | "module" | "question";
  durationSeconds: number;
  remainingSeconds: number;
  startedAt?: string;
  lastTickAt?: string;
  pausedAt?: string;
  resumedAt?: string;
  pauseCount: number;
  totalPausedSeconds: number;
  expiredAt?: string;
  completedAt?: string;
}

export type PausePolicy = "allowed" | "practice_only" | "disabled";

export interface PauseConfig {
  policy: PausePolicy;
  maxPauseCount?: number;
  maxTotalPauseSeconds?: number;
  showPausedOverlay?: boolean;
}

export interface PracticeSession {
  id?: string;
  schemaVersion?: number;
  testId: string;
  section: SectionKey;
  userId?: string;
  workspaceId?: string;
  status: AttemptStatus;
  mode?: PracticeRunMode;
  answers: Record<string, AnswerValue>;
  currentQuestion: number;
  currentPdfPage: number;
  currentAudio: number;
  audioPlayback: Record<string, AudioPlaybackState>;
  remainingSeconds: number;
  timingState?: AttemptTimingState;
  pauseConfig?: PauseConfig;
  flaggedQuestions: string[];
  notes: Record<string, string>;
  startedAt: string;
  updatedAt: string;
  submittedAt?: string;
  expiredAt?: string;
  score?: AttemptScore;
}

export interface PersistedPracticeSession {
  schemaVersion: number;
  session: PracticeSession;
}

export interface MistakeItem {
  id: string;
  testId: string;
  testTitle: string;
  section: SectionKey;
  questionId: string;
  questionNumber: number;
  userAnswer?: AnswerValue;
  correctAnswer?: AnswerValue;
  explanation?: string;
  lastWrongAt: string;
  attemptedAt?: string;
  status?: QuestionResultStatus;
  notes?: string;
}

export interface PracticeHistoryItem {
  testId: string;
  testTitle: string;
  section: SectionKey;
  startedAt: string;
  updatedAt: string;
  submittedAt?: string;
  secondsSpent: number;
}

export type QuestionResultStatus = "correct" | "incorrect" | "unanswered" | "ungraded";

export interface QuestionResult {
  questionId: string;
  questionNumber: number;
  status: QuestionResultStatus;
  userAnswer: unknown;
  correctAnswer?: unknown;
  isAnswered: boolean;
  isObjective: boolean;
  details?: Record<string, unknown>;
}

export interface AttemptScore {
  totalQuestions: number;
  answeredQuestions: number;
  unansweredQuestions: number;
  objectiveQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  ungradedQuestions: number;
  accuracy: number | null;
  questionResults: QuestionResult[];
}

export interface AttemptHistoryItem extends PracticeHistoryItem {
  id: string;
  answers: Record<string, AnswerValue>;
  score: AttemptScore;
  flaggedQuestions: string[];
  notes: Record<string, string>;
  durationSeconds: number;
}

export type UserRole = "student" | "teacher" | "admin";

export interface Workspace {
  id: string;
  name: string;
  ownerId?: string;
}

export interface Entitlement {
  plan: "free" | "personal" | "pro" | "institution";
  maxTestSets?: number;
  aiCredits?: number;
  expiresAt?: string;
}

export type VocabularyStatus = "new" | "learning" | "mastered" | "archived";

export interface VocabularySource {
  testId?: string;
  testTitle?: string;
  section?: SectionKey;
  questionId?: string;
  questionNumber?: number;
  attemptId?: string;
  resultStatus?: QuestionResultStatus;
  sourceText?: string;
  addedFrom?: "review" | "mistake" | "question" | "explanation" | "manual" | "import";
}

export interface VocabularyItem {
  id: string;
  word: string;
  normalizedWord: string;
  definition?: string;
  translation?: string;
  partOfSpeech?: string;
  pronunciation?: string;
  exampleSentence?: string;
  personalNote?: string;
  source?: VocabularySource;
  sources: VocabularySource[];
  tags: string[];
  status: VocabularyStatus;
  isStarred: boolean;
  mistakeCount: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
  masteredAt?: string;
}

export interface CreateVocabularyInput {
  word: string;
  definition?: string;
  translation?: string;
  partOfSpeech?: string;
  pronunciation?: string;
  exampleSentence?: string;
  personalNote?: string;
  source?: VocabularySource;
  tags?: string[];
  status?: VocabularyStatus;
  isStarred?: boolean;
}

export interface PersistedVocabularyData {
  schemaVersion: number;
  items: VocabularyItem[];
}
