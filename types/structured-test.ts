import type { SectionKey } from "./test";

export type StructuredQuestionType =
  | "complete_words"
  | "single_choice"
  | "multiple_choice"
  | "sentence_insertion"
  | "build_sentence"
  | "write_email"
  | "academic_discussion"
  | "listen_choose_response"
  | "listening_group_question"
  | "listen_repeat"
  | "interview_response";

export interface TestDefinition {
  id: string;
  title: string;
  version: number;
  status: "draft" | "review" | "published";
  sections: StructuredTestSection[];
}

export interface StructuredTestSection {
  id: string;
  key: SectionKey;
  title: string;
  modules: TestModule[];
  instructions?: string;
  durationSeconds?: number;
  importStatus?: "not_detected" | "detected" | "importing" | "ready" | "needs_review" | "failed";
  sourceFiles?: string[];
  audioCount?: number;
  importedAnswerCount?: number;
  issueCount?: number;
}

export interface TestModule {
  id: string;
  moduleNumber: number;
  title?: string;
  questions: TestQuestion[];
  navigationMode: "free" | "forward_only" | "question_locked_after_next";
}

export interface Passage {
  id: string;
  title?: string;
  paragraphs: PassageParagraph[];
  materialType?: "plain_passage" | "academic_passage" | "email" | "notice" | "advertisement" | "schedule" | "table" | "list" | "mixed";
  extractionStatus?: "source_only" | "ocr_raw" | "auto_validated" | "needs_review" | "human_verified";
  extractionConfidence?: number;
  defaultDisplayMode?: "structured_text" | "source_image";
  originalAssetIds?: string[];
}

export interface PassageParagraph {
  id: string;
  text: string;
  config?: {
    role?: "instruction" | "bullet" | "speaker" | "email_header";
    speaker?: string;
    speakerType?: "student" | "professor";
    weight?: "bold" | "normal";
    labelWeight?: "bold" | "normal";
  };
  blanks?: WordBlank[];
  insertionLocations?: SentenceInsertionLocation[];
}

export interface WordBlank {
  id: string;
  prefix: string;
  missingLength: number;
  suffix: string;
  answer?: string;
}

export interface SentenceInsertionLocation {
  id: string;
  label: string;
  afterParagraphId: string;
}

export interface AudioGroup {
  id: string;
  title?: string;
  audioAssetId: string;
  transcript?: string;
  imageAssetId?: string;
  allowReplay: boolean;
  playLimit?: number;
  startSeconds?: number;
  endSeconds?: number;
  confidence?: number;
  needsReview?: boolean;
}

export interface TestQuestion {
  id: string;
  section: SectionKey;
  moduleId: string;
  number: number;
  type: StructuredQuestionType;
  prompt?: string;
  instructions?: string;
  passageId?: string;
  audioGroupId?: string;
  imageAssetId?: string;
  assetIds?: string[];
  displayMode?: "structured" | "source_image_fallback" | "source_question_ready";
  readiness?: "structured_ready" | "source_question_ready" | "missing_question_data";
  questionImageAssetId?: string;
  readingQuestionSource?: {
    materialAssetId?: string;
    materialRegion?: BoundingBox;
    questionAssetId?: string;
    questionRegion?: BoundingBox;
    fullSourceAssetId?: string;
    sourceQuestionNumber?: number;
  };
  options?: QuestionOption[];
  blanks?: QuestionBlank[];
  wordBank?: (string | SentenceToken)[];
  buildSentenceSlots?: BuildSentenceSlot[];
  conversationPrompt?: string;
  fixedPrefix?: string;
  fixedSuffix?: string;
  correctAnswer?: QuestionAnswer;
  explanation?: string;
  preparationSeconds?: number;
  responseSeconds?: number;
  videoStartSeconds?: number;
  videoEndSeconds?: number;
  speakingImageDisplay?: SpeakingImageDisplay;
  sourcePage?: number;
  confidence?: number;
  needsReview?: boolean;
}

export interface SpeakingImageDisplay {
  fit: "contain" | "center_crop";
  scale?: number;
  objectPosition?: string;
  translateY?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceAssetId?: string;
  questionNumber?: number;
}

export interface SentenceToken {
  id: string;
  text: string;
  order: number;
  color?: string;
  groupId?: string;
}

export interface BuildSentenceSlot {
  id: string;
  index: number;
  expectedTokenIds?: string[];
  color?: string;
}

export interface QuestionOption {
  id: string;
  label?: string;
  text: string;
}

export interface QuestionBlank {
  id: string;
  prefix?: string;
  suffix?: string;
  missingLength?: number;
}

export type QuestionAnswer =
  | { type: "single_choice"; optionId: string }
  | { type: "listen_choose_response"; optionId: string }
  | { type: "listening_group_question"; optionId: string }
  | { type: "multiple_choice"; optionIds: string[] }
  | { type: "complete_words"; values: Record<string, string> }
  | { type: "build_sentence"; tokens: string[] }
  | { type: "sentence_insertion"; locationId: string }
  | { type: "manual_or_ai" };

export interface TestAssetRecord {
  id: string;
  type: "question_pdf" | "answer_pdf" | "audio" | "image" | "page_image" | "other";
  file: string;
  title?: string;
  mimeType?: string;
  order?: number;
}

export interface StructuredTestBundle {
  test: TestDefinition;
  passages: Passage[];
  audioGroups: AudioGroup[];
  assets: TestAssetRecord[];
  importReport?: ImportReport;
}

export interface ImportReport {
  testId: string;
  generatedAt: string;
  sourceSummary: {
    pdfFiles: number;
    audioFiles: number;
    pagesRendered: number;
    pagesWithTextLayer: number;
    pagesNeedingOcr: number;
  };
  recognized: {
    sections: number;
    modules: number;
    questions: number;
  };
  needsReview: string[];
  matchedAudio: number;
  importedAnswers: number;
  notes: string[];
}
