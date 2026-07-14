import { TOEFL_SCORING, isToeflBuildSentenceConfig, isToeflChoiceConfig, isToeflCompleteWordsConfig } from "./question-types";
import type { ScoringStrategy } from "@/core/exam/types";

function hasResponse(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") return Object.values(value).some((entry) => String(entry || "").trim().length > 0);
  return false;
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export const toeflSingleChoiceScoring: ScoringStrategy = {
  id: TOEFL_SCORING.exactSingleChoice,
  grade({ question, response }) {
    if (!isToeflChoiceConfig(question.config)) return { questionId: question.id, status: "invalid" };
    const optionIds = (response?.value as { optionIds?: string[] } | undefined)?.optionIds || [];
    if (!hasResponse(optionIds)) return { questionId: question.id, status: "unanswered", rawScore: 0, maxRawScore: 1 };
    return {
      questionId: question.id,
      status: optionIds[0] === question.config.correctOptionId ? "correct" : "incorrect",
      rawScore: optionIds[0] === question.config.correctOptionId ? 1 : 0,
      maxRawScore: 1
    };
  }
};

export const toeflMultipleChoiceScoring: ScoringStrategy = {
  id: TOEFL_SCORING.exactMultipleChoice,
  grade({ question, response }) {
    if (!isToeflChoiceConfig(question.config)) return { questionId: question.id, status: "invalid" };
    const actual = [...new Set((response?.value as { optionIds?: string[] } | undefined)?.optionIds || [])].sort();
    const expected = [...new Set(question.config.correctOptionIds || [])].sort();
    if (!hasResponse(actual)) return { questionId: question.id, status: "unanswered", rawScore: 0, maxRawScore: 1 };
    const correct = actual.join("|") === expected.join("|");
    return { questionId: question.id, status: correct ? "correct" : "incorrect", rawScore: correct ? 1 : 0, maxRawScore: 1 };
  }
};

export const toeflCompleteWordsScoring: ScoringStrategy = {
  id: TOEFL_SCORING.completeWords,
  grade({ question, response }) {
    if (!isToeflCompleteWordsConfig(question.config)) return { questionId: question.id, status: "invalid" };
    const values = response?.value as Record<string, string> | undefined;
    if (!hasResponse(values)) return { questionId: question.id, status: "unanswered", rawScore: 0, maxRawScore: 1 };
    const expected = question.config.correctValues || Object.fromEntries(question.config.blanks.filter((blank) => blank.answer).map((blank) => [blank.id, blank.answer || ""]));
    const blankResults = Object.entries(expected).map(([blankId, answer]) => {
      const userAnswer = String(values?.[blankId] || "").trim();
      const correct = normalize(userAnswer) === normalize(answer);
      return {
        blankId,
        userAnswer,
        correctAnswer: answer,
        status: userAnswer ? (correct ? "correct" : "incorrect") : "unanswered"
      };
    });
    const correctBlanks = blankResults.filter((result) => result.status === "correct").length;
    const correct = correctBlanks === blankResults.length;
    return {
      questionId: question.id,
      status: correct ? "correct" : "incorrect",
      rawScore: correctBlanks,
      maxRawScore: blankResults.length,
      details: { totalBlanks: blankResults.length, correctBlanks, blankResults }
    };
  }
};

export const toeflManualScoring: ScoringStrategy = {
  id: TOEFL_SCORING.manualOrAi,
  grade({ question, response }) {
    return { questionId: question.id, status: response ? "ungraded" : "unanswered" };
  }
};

export const toeflBuildSentenceScoring: ScoringStrategy = {
  id: TOEFL_SCORING.buildSentence,
  grade({ question, response }) {
    if (!isToeflBuildSentenceConfig(question.config)) return { questionId: question.id, status: "invalid" };
    const actual = Array.isArray((response?.value as { tokenIds?: unknown })?.tokenIds)
      ? ((response?.value as { tokenIds: unknown[] }).tokenIds).map(String)
      : Array.isArray(response?.value)
        ? (response.value as unknown[]).map(String)
        : [];
    if (!hasResponse(actual)) return { questionId: question.id, status: "unanswered", rawScore: 0, maxRawScore: 1 };
    const expected = question.config.correctTokenOrder || [];
    if (!expected.length) return { questionId: question.id, status: "ungraded" };
    const correct = actual.length === expected.length && actual.every((tokenId, index) => tokenId === expected[index]);
    return { questionId: question.id, status: correct ? "correct" : "incorrect", rawScore: correct ? 1 : 0, maxRawScore: 1 };
  }
};
