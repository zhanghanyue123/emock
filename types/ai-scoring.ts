export type AiScoringTaskType = "writing_score" | "speaking_transcription" | "speaking_score";
export type AiScoringStatus = "queued" | "processing" | "completed" | "failed" | "needs_review";

export interface ScoreModelConfig {
  id: string;
  examProfile: string;
  version: string;
  status: "practice_estimate" | "calibrated_estimate" | "officially_supported";
  taskRubrics: Record<string, TaskRubric>;
}

export interface TaskRubric {
  id: string;
  version: string;
  maxScore: number;
  dimensions: { id: string; label: string; maxScore: number }[];
}

export interface RubricDimensionScore {
  id: string;
  score: number;
  maxScore: number;
  confidence: number;
  evidence: string[];
  feedback: string;
}

export interface WritingScoringInput {
  questionId: string;
  taskType: string;
  instructions?: string;
  sourceMaterial?: string;
  prompt: string;
  response: string;
  wordCount: number;
  responseDurationSeconds?: number;
  rubric: TaskRubric;
  rubricVersion: string;
}

export interface WritingScoringResult {
  overallScore: number;
  maxScore: number;
  dimensions: RubricDimensionScore[];
  strengths: string[];
  improvements: string[];
  conciseFeedback: string;
  detailedFeedback?: string;
  confidence: number;
  needsHumanReview: boolean;
  flags: string[];
  scoreLabel: "AI-estimated score";
  scoreStatus: "practice_estimate";
}

export interface SpeakingTranscriptResult {
  transcript: string;
  words?: { text: string; startMs: number; endMs: number; confidence?: number }[];
  detectedLanguage?: string;
  confidence: number;
  durationMs: number;
  emptyAudio: boolean;
  warnings: string[];
}

export interface SpeakingAcousticFeatures {
  totalDurationMs: number;
  speechDurationMs?: number;
  silenceRatio?: number;
  longPauseCount?: number;
  wordsPerMinute?: number;
  restartCount?: number;
  fillerCount?: number;
  lowVolume?: boolean;
  clippedAudio?: boolean;
  noisyAudio?: boolean;
}

export interface SpeakingScoringResult {
  overallScore: number;
  maxScore: number;
  transcript: string;
  dimensions: RubricDimensionScore[];
  strengths: string[];
  improvements: string[];
  acousticSummary: {
    durationSeconds: number;
    wordsPerMinute?: number;
    silenceRatio?: number;
    longPauseCount?: number;
  };
  confidence: number;
  needsHumanReview: boolean;
  flags: string[];
  scoreLabel: "AI-estimated score";
  scoreStatus: "practice_estimate";
}

export interface AiScoringJob {
  id: string;
  attemptId: string;
  questionId: string;
  taskType: AiScoringTaskType;
  status: AiScoringStatus;
  provider: string;
  model: string;
  rubricVersion: string;
  inputHash: string;
  retryCount: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AiEvaluationRecord {
  id: string;
  attemptId: string;
  questionId: string;
  recordingId?: string;
  provider: string;
  model: string;
  promptVersion: string;
  rubricVersion: string;
  scoreModelVersion: string;
  temperature: number;
  inputHash: string;
  result: WritingScoringResult | SpeakingScoringResult | SpeakingTranscriptResult;
  confidence: number;
  createdAt: string;
  supersedesEvaluationId?: string;
}

export interface HumanScoreOverride {
  id: string;
  attemptId: string;
  questionId: string;
  finalScore: number;
  maxScore: number;
  feedback?: string;
  createdAt: string;
}

export interface AiScoringStore {
  schemaVersion: number;
  jobs: AiScoringJob[];
  evaluations: AiEvaluationRecord[];
  humanOverrides: HumanScoreOverride[];
}
