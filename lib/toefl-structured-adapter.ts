import { TOEFL_NAVIGATION, TOEFL_QUESTION_TYPES, TOEFL_RENDERERS, TOEFL_SCORING } from "@/exam-packs/toefl/question-types";
import { TOEFL_SECTION_TYPES } from "@/exam-packs/toefl/section-types";
import type { ExamQuestion, ExamResponse } from "@/core/exam/types";
import type { AnswerValue } from "@/types/test";
import type { TestQuestion } from "@/types/structured-test";

export function toeflSectionType(section: string) {
  if (section === "reading") return TOEFL_SECTION_TYPES.reading;
  if (section === "listening") return TOEFL_SECTION_TYPES.listening;
  if (section === "writing") return TOEFL_SECTION_TYPES.writing;
  if (section === "speaking") return TOEFL_SECTION_TYPES.speaking;
  return `toefl.${section}`;
}

function mappedType(question: TestQuestion) {
  if (question.type === "complete_words") {
    return {
      questionType: TOEFL_QUESTION_TYPES.completeWords,
      rendererId: TOEFL_RENDERERS.completeWords,
      scoringStrategyId: TOEFL_SCORING.completeWords
    };
  }
  if (question.type === "single_choice") {
    return {
      questionType: TOEFL_QUESTION_TYPES.academicPassageChoice,
      rendererId: question.section === "reading" ? TOEFL_RENDERERS.readingChoice : TOEFL_RENDERERS.choice,
      scoringStrategyId: TOEFL_SCORING.exactSingleChoice
    };
  }
  if (question.type === "listen_choose_response") {
    return {
      questionType: TOEFL_QUESTION_TYPES.listenChooseResponse,
      rendererId: TOEFL_RENDERERS.listeningChoice,
      scoringStrategyId: TOEFL_SCORING.exactSingleChoice
    };
  }
  if (question.type === "listening_group_question") {
    return {
      questionType: TOEFL_QUESTION_TYPES.listeningGroupChoice,
      rendererId: TOEFL_RENDERERS.listeningChoice,
      scoringStrategyId: TOEFL_SCORING.exactSingleChoice
    };
  }
  if (question.type === "multiple_choice") {
    return {
      questionType: TOEFL_QUESTION_TYPES.academicPassageChoice,
      rendererId: TOEFL_RENDERERS.choice,
      scoringStrategyId: TOEFL_SCORING.exactMultipleChoice
    };
  }
  if (question.type === "build_sentence") {
    return {
      questionType: TOEFL_QUESTION_TYPES.buildSentence,
      rendererId: TOEFL_RENDERERS.buildSentenceInline,
      scoringStrategyId: TOEFL_SCORING.buildSentence
    };
  }
  if (question.type === "write_email") {
    return {
      questionType: TOEFL_QUESTION_TYPES.writeEmail,
      rendererId: TOEFL_RENDERERS.text,
      scoringStrategyId: TOEFL_SCORING.manualOrAi
    };
  }
  if (question.type === "academic_discussion") {
    return {
      questionType: TOEFL_QUESTION_TYPES.academicDiscussion,
      rendererId: TOEFL_RENDERERS.text,
      scoringStrategyId: TOEFL_SCORING.manualOrAi
    };
  }
  if (question.type === "listen_repeat") {
    return {
      questionType: TOEFL_QUESTION_TYPES.listenRepeat,
      rendererId: TOEFL_RENDERERS.recording,
      scoringStrategyId: TOEFL_SCORING.manualOrAi
    };
  }
  if (question.type === "interview_response") {
    return {
      questionType: TOEFL_QUESTION_TYPES.interviewResponse,
      rendererId: TOEFL_RENDERERS.recording,
      scoringStrategyId: TOEFL_SCORING.manualOrAi
    };
  }
  return {
    questionType: `toefl.${question.type}`,
    rendererId: TOEFL_RENDERERS.unsupported,
    scoringStrategyId: TOEFL_SCORING.manualOrAi
  };
}

export function structuredQuestionToExamQuestion(question: TestQuestion): ExamQuestion {
  const mapped = mappedType(question);
  const config: Record<string, unknown> = {};
  if (question.type === "complete_words") {
    config.blanks = question.blanks || [];
    config.correctValues = question.correctAnswer?.type === "complete_words" ? question.correctAnswer.values : undefined;
    config.explanation = question.explanation;
  }
  if (question.type === "single_choice" || question.type === "multiple_choice" || question.type === "listen_choose_response" || question.type === "listening_group_question") {
    config.options = question.options || [];
    config.correctOptionId = question.correctAnswer?.type === "single_choice" || question.correctAnswer?.type === "listen_choose_response" || question.correctAnswer?.type === "listening_group_question" ? question.correctAnswer.optionId : undefined;
    config.correctOptionIds = question.correctAnswer?.type === "multiple_choice" ? question.correctAnswer.optionIds : undefined;
    config.explanation = question.explanation;
    config.displayMode = question.displayMode;
  }
  if (question.type === "build_sentence") {
    config.tokens = question.wordBank || [];
    config.slots = question.buildSentenceSlots || [];
    config.correctTokenOrder = question.correctAnswer?.type === "build_sentence" ? question.correctAnswer.tokens : undefined;
    config.context = question.instructions;
    config.conversationPrompt = question.conversationPrompt;
    config.fixedPrefix = question.fixedPrefix || "";
    config.fixedSuffix = question.fixedSuffix || "";
    config.displayMode = question.displayMode;
    config.explanation = question.explanation;
  }
  if (question.type === "write_email" || question.type === "academic_discussion" || question.type === "listen_repeat" || question.type === "interview_response") {
    config.context = question.instructions;
    config.displayMode = question.displayMode;
    config.preparationSeconds = question.preparationSeconds;
    config.responseSeconds = question.responseSeconds;
    config.explanation = question.explanation;
    if (question.type === "listen_repeat" || question.type === "interview_response") {
      config.speakingImageDisplay = question.speakingImageDisplay;
    }
  }
  return {
    id: question.id,
    examPackId: "toefl",
    sectionId: question.section,
    moduleId: question.moduleId,
    number: question.number,
    ...mapped,
    stimulusId: question.passageId || question.audioGroupId,
    assetIds: [question.imageAssetId].filter((item): item is string => Boolean(item)),
    prompt: question.prompt || question.instructions ? { type: "plain_text", text: question.prompt || question.instructions || "" } : undefined,
    config,
    source: { page: question.sourcePage, confidence: question.confidence },
    status: question.needsReview ? "reviewed" : "published",
    confidence: question.confidence,
    needsReview: question.needsReview
  };
}

export function answerValueToExamResponse(question: TestQuestion, value: AnswerValue | undefined): ExamResponse | undefined {
  if (value === undefined) return undefined;
  const examQuestion = structuredQuestionToExamQuestion(question);
  if (question.type === "single_choice" || question.type === "listen_choose_response" || question.type === "listening_group_question") {
    return { questionId: question.id, responseType: "choice", value: { optionIds: typeof value === "string" ? [value] : [] }, updatedAt: new Date().toISOString() };
  }
  if (question.type === "multiple_choice") {
    return { questionId: question.id, responseType: "choice", value: { optionIds: Array.isArray(value) ? value : [] }, updatedAt: new Date().toISOString() };
  }
  if (question.type === "build_sentence") {
    return { questionId: question.id, responseType: TOEFL_RENDERERS.buildSentenceInline, value: { tokenIds: Array.isArray(value) ? value : [] }, updatedAt: new Date().toISOString() };
  }
  if (question.type === "write_email" || question.type === "academic_discussion") {
    return { questionId: question.id, responseType: "text", value: typeof value === "string" ? value : "", updatedAt: new Date().toISOString() };
  }
  return { questionId: question.id, responseType: examQuestion.questionType, value, updatedAt: new Date().toISOString() };
}

export function examResponseToAnswerValue(response: ExamResponse): AnswerValue {
  const tokenIds = (response.value as { tokenIds?: unknown } | undefined)?.tokenIds;
  if (Array.isArray(tokenIds)) return tokenIds.map(String);
  const optionIds = (response.value as { optionIds?: string[] } | undefined)?.optionIds;
  if (Array.isArray(optionIds)) return optionIds.length === 1 ? optionIds[0] : optionIds;
  if (response.value && typeof response.value === "object" && !Array.isArray(response.value)) return response.value as Record<string, string>;
  if (Array.isArray(response.value)) return response.value.map(String);
  return String(response.value || "");
}
