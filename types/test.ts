export type SectionKey = "reading" | "listening" | "speaking" | "writing";

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "text"
  | "essay"
  | "speaking_placeholder";

export type AnswerValue = string | string[] | Record<string, unknown>;

export interface AudioItem {
  id: string;
  title: string;
  file: string;
  allowReplay?: boolean;
}

export type SectionImportStatus = "not_detected" | "detected" | "importing" | "ready" | "needs_review" | "failed";
export type TestKind = "exam" | "materials";
export type TestOverallStatus = "ready" | "in_progress" | "materials";

export interface MaterialItem {
  id: string;
  title: string;
  file: string;
  type: "pdf" | "audio" | "video" | "other";
  category?: "source" | "answer" | "transcript" | "review" | "audio" | "other";
}

export interface Question {
  id: string;
  number: number;
  type: QuestionType;
  prompt?: string;
  options?: string[];
  correctAnswer?: AnswerValue;
  explanation?: string;
  page?: number;
  audioId?: string;
  tags?: string[];
  notes?: string;
  maxSelections?: number;
}

export interface TestSection {
  enabled: boolean;
  title: string;
  durationMinutes: number;
  pdf?: string | null;
  audio?: AudioItem[];
  questions: Question[];
  importStatus?: SectionImportStatus;
  sourceFiles?: string[];
  audioCount?: number;
  importedAnswerCount?: number;
  issueCount?: number;
  error?: string;
}

export type SectionsMap = Record<SectionKey, TestSection>;

export interface TestManifest {
  id: string;
  title: string;
  description?: string;
  version: number;
  sections: SectionsMap;
  kind?: TestKind;
  overallStatus?: TestOverallStatus;
  materials?: MaterialItem[];
  reviewMaterials?: MaterialItem[];
}

export interface TestListItem {
  id: string;
  title: string;
  description?: string;
  version?: number;
  sections: Partial<SectionsMap>;
  valid: boolean;
  error?: string;
  kind?: TestKind;
  overallStatus?: TestOverallStatus;
  materials?: MaterialItem[];
  reviewMaterials?: MaterialItem[];
}

export type AssetType = "question_pdf" | "answer_pdf" | "audio" | "transcript" | "image" | "other";

export interface TestAsset {
  id: string;
  testId: string;
  section?: string;
  type: AssetType;
  fileName: string;
  relativePath: string;
  mimeType?: string;
  size?: number;
  order?: number;
}

export interface TestSet extends TestManifest {
  workspaceId?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TestManifestSummary = TestListItem;
