import type { ComponentType } from "react";

export type RichContent =
  | { type: "plain_text"; text: string }
  | { type: "blocks"; blocks: ContentBlock[] };

export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: number }
  | { type: "image"; assetId: string; alt?: string }
  | { type: "audio"; assetId: string }
  | { type: "table"; rows: string[][] }
  | { type: "formula"; latex: string }
  | { type: "callout"; text: string };

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExamDefinition {
  id: string;
  examPackId: string;
  title: string;
  version: number;
  status: "draft" | "review" | "published" | "partially_published";
  sections: ExamSection[];
  config?: Record<string, unknown>;
}

export interface ExamSection {
  id: string;
  examPackId: string;
  sectionType: string;
  title: string;
  modules: ExamModule[];
  timing?: ExamTimingConfig;
  instructions?: RichContent;
  status?: "draft" | "detected" | "importing" | "needs_review" | "failed" | "pending_import" | "published";
  config?: Record<string, unknown>;
}

export interface ExamModule {
  id: string;
  title?: string;
  moduleType?: string;
  questionIds: string[];
  navigationStrategyId: string;
  timing?: ExamTimingConfig;
  config?: Record<string, unknown>;
}

export interface ExamStimulus {
  id: string;
  examPackId: string;
  stimulusType: string;
  title?: string;
  content?: RichContent;
  assetIds?: string[];
  config?: Record<string, unknown>;
}

export interface ExamQuestion {
  id: string;
  examPackId: string;
  sectionId: string;
  moduleId?: string;
  number: number;
  questionType: string;
  rendererId: string;
  scoringStrategyId: string;
  stimulusId?: string;
  assetIds?: string[];
  assetRefs?: QuestionAssetReference[];
  prompt?: RichContent;
  config: Record<string, unknown>;
  source?: ExamSourceReference;
  status?: "draft" | "reviewed" | "published";
  confidence?: number;
  needsReview?: boolean;
}

export interface ExamSourceReference {
  file?: string;
  sourceAssetId?: string;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  page?: number;
  paragraphId?: string;
  confidence?: number;
}

export type ExamAssetType = "pdf" | "image" | "audio" | "video" | "transcript" | "data" | "other";
export type ExamAssetRole = "stimulus" | "question_image" | "speaker_image" | "diagram" | "audio" | "transcript" | "source_page" | "review_reference";

export interface QuestionAssetReference {
  assetId: string;
  role: ExamAssetRole;
  order?: number;
}

export interface ExamAsset {
  id: string;
  examId: string;
  type: ExamAssetType;
  fileName: string;
  relativePath: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export interface AudioPlaybackPolicy {
  playLimit?: number;
  allowSeek?: boolean;
  allowReplay?: boolean;
  allowSpeedChange?: boolean;
  autoStart?: boolean;
}

export interface ExamTimingConfig {
  scope: "exam" | "section" | "module" | "question" | "response_phase";
  durationSeconds?: number;
  preparationSeconds?: number;
  responseSeconds?: number;
  autoSubmit?: boolean;
}

export interface ExamResponse {
  questionId: string;
  responseType: string;
  value: unknown;
  updatedAt: string;
}

export type QuestionResultStatus = "correct" | "incorrect" | "partially_correct" | "unanswered" | "ungraded" | "invalid";

export interface QuestionGrade {
  questionId: string;
  status: QuestionResultStatus;
  rawScore?: number;
  maxRawScore?: number;
  details?: Record<string, unknown>;
}

export interface ScoringStrategy {
  id: string;
  grade(input: { question: ExamQuestion; response: ExamResponse | undefined }): QuestionGrade;
}

export interface NavigationContext {
  questionIds: string[];
  currentQuestionId: string;
  visitedQuestionIds: string[];
  lockedQuestionIds?: string[];
}

export interface NavigationStrategy {
  id: string;
  canGoPrevious(context: NavigationContext): boolean;
  canGoNext(context: NavigationContext): boolean;
  canJumpTo(context: NavigationContext, targetQuestionId: string): boolean;
  shouldLockCurrentQuestion?(context: NavigationContext): boolean;
}

export interface ExamQuestionRendererProps {
  question: ExamQuestion;
  response?: ExamResponse;
  onResponse: (response: ExamResponse) => void;
}

export interface ExamQuestionRenderer {
  id: string;
  component: ComponentType<ExamQuestionRendererProps>;
}

export interface ExamSectionDefinition {
  id: string;
  title: string;
}

export interface ExamQuestionTypeDefinition {
  id: string;
  title: string;
  rendererId: string;
  scoringStrategyId: string;
}

export interface ExamPack {
  id: string;
  name: string;
  version: string;
  sectionDefinitions: ExamSectionDefinition[];
  questionTypes: ExamQuestionTypeDefinition[];
  validateExam(exam: ExamDefinition): ValidationResult;
  getQuestionRenderer(rendererId: string): ExamQuestionRenderer | undefined;
  getScoringStrategy(strategyId: string): ScoringStrategy | undefined;
  getNavigationStrategy(strategyId: string): NavigationStrategy | undefined;
}

export interface ExamBundle {
  exam: ExamDefinition;
  stimuli: ExamStimulus[];
  questions: ExamQuestion[];
  assets: ExamAsset[];
  answerKey?: Record<string, unknown>;
  importReport?: unknown;
}
