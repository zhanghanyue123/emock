export const TOEFL_QUESTION_TYPES = {
  completeWords: "toefl.complete_words",
  dailyLifeChoice: "toefl.daily_life_choice",
  academicPassageChoice: "toefl.academic_passage_choice",
  sentenceInsertion: "toefl.sentence_insertion",
  listenChooseResponse: "toefl.listen_choose_response",
  listeningGroupChoice: "toefl.listening_group_choice",
  buildSentence: "toefl.build_sentence",
  writeEmail: "toefl.write_email",
  academicDiscussion: "toefl.academic_discussion",
  listenRepeat: "toefl.listen_repeat",
  interviewResponse: "toefl.interview_response"
} as const;

export const TOEFL_RENDERERS = {
  completeWords: "toefl.renderer.complete_words",
  readingChoice: "toefl.reading_choice",
  choice: "toefl.renderer.choice",
  listeningChoice: "toefl.listening_choice",
  buildSentence: "toefl.renderer.build_sentence",
  buildSentenceInline: "toefl.writing.build_sentence_inline",
  text: "toefl.renderer.text",
  recording: "toefl.renderer.recording",
  unsupported: "toefl.renderer.unsupported"
} as const;

export const TOEFL_SCORING = {
  exactSingleChoice: "toefl.exact_single_choice",
  exactMultipleChoice: "toefl.exact_multiple_choice",
  completeWords: "toefl.complete_words",
  buildSentence: "toefl.build_sentence",
  manualOrAi: "toefl.manual_or_ai"
} as const;

export const TOEFL_NAVIGATION = {
  freeWithinModule: "toefl.free_within_module",
  forwardOnly: "toefl.forward_only",
  lockAfterNext: "toefl.lock_after_next"
} as const;

export interface ToeflOption {
  id: string;
  label?: string;
  text: string;
}

export interface ToeflChoiceConfig {
  options: ToeflOption[];
  correctOptionId?: string;
  correctOptionIds?: string[];
  explanation?: string;
}

export interface ToeflCompleteWordsConfig {
  blanks: { id: string; answer?: string; prefix?: string; suffix?: string; missingLength?: number }[];
  correctValues?: Record<string, string>;
  explanation?: string;
}

export interface ToeflSentenceToken {
  id: string;
  text: string;
  order: number;
  color?: string;
  groupId?: string;
}

export interface ToeflBuildSentenceSlot {
  id: string;
  index: number;
  expectedTokenIds?: string[];
  color?: string;
}

export interface ToeflBuildSentenceConfig {
  conversationPrompt?: string;
  fixedPrefix?: string;
  fixedSuffix?: string;
  tokens: ToeflSentenceToken[];
  slots?: ToeflBuildSentenceSlot[];
  tokenColor?: string;
  slotColor?: string;
  highlightColor?: string;
  annotationColor?: string;
  inlineInteraction?: boolean;
  visualLayout?: unknown;
  correctTokenOrder?: string[];
  correctText?: string;
  punctuationPolicy?: "strict" | "normalized";
  explanation?: string;
}

export function isToeflChoiceConfig(value: unknown): value is ToeflChoiceConfig {
  const config = value as ToeflChoiceConfig;
  return Boolean(config && Array.isArray(config.options));
}

export function isToeflCompleteWordsConfig(value: unknown): value is ToeflCompleteWordsConfig {
  const config = value as ToeflCompleteWordsConfig;
  return Boolean(config && Array.isArray(config.blanks));
}

export function isToeflBuildSentenceConfig(value: unknown): value is ToeflBuildSentenceConfig {
  const config = value as ToeflBuildSentenceConfig;
  return Boolean(config && Array.isArray(config.tokens));
}
