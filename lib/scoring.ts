import type { AnswerValue, Question } from "@/types/test";
import type { AttemptScore, QuestionResultStatus } from "@/types/practice";

export interface ScoreResult {
  totalQuestions: number;
  answeredQuestions: number;
  objectiveQuestions: number;
  correctAnswers: number;
  accuracy: number;
  ungradedQuestions: number;
}

function normalizeArrayAnswer(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.map(String))].sort() : [];
}

function sameAnswer(left?: AnswerValue, right?: AnswerValue) {
  if (left === undefined || right === undefined) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return normalizeArrayAnswer(left).join("|") === normalizeArrayAnswer(right).join("|");
  }
  return left === right;
}

export function isAnswerPresent(value?: AnswerValue) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

export function isCorrect(question: Question, answer?: AnswerValue) {
  if (question.correctAnswer === undefined) return null;
  if (question.type !== "single_choice" && question.type !== "multiple_choice") return null;
  return sameAnswer(answer, question.correctAnswer);
}

export function scoreQuestions(questions: Question[], answers: Record<string, AnswerValue>): ScoreResult {
  const score = scoreAttempt(questions, answers);
  return {
    totalQuestions: score.totalQuestions,
    answeredQuestions: score.answeredQuestions,
    objectiveQuestions: score.objectiveQuestions,
    correctAnswers: score.correctAnswers,
    accuracy: score.accuracy === null ? 0 : Math.round(score.accuracy * 100),
    ungradedQuestions: score.ungradedQuestions
  };
}

export function scoreAttempt(questions: Question[], answers: Record<string, AnswerValue>): AttemptScore {
  let answeredQuestions = 0;
  let objectiveQuestions = 0;
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let ungradedQuestions = 0;
  const questionResults = questions.map((question) => {
    const answer = answers[question.id];
    const isAnswered = isAnswerPresent(answer);
    if (isAnswered) answeredQuestions += 1;

    const isObjective =
      (question.type === "single_choice" || question.type === "multiple_choice") &&
      question.correctAnswer !== undefined;

    let status: QuestionResultStatus = "ungraded";
    if (!isObjective) {
      ungradedQuestions += 1;
    } else if (!isAnswered) {
      objectiveQuestions += 1;
      status = "unanswered";
    } else if (sameAnswer(answer, question.correctAnswer)) {
      objectiveQuestions += 1;
      correctAnswers += 1;
      status = "correct";
    } else {
      objectiveQuestions += 1;
      incorrectAnswers += 1;
      status = "incorrect";
    }

    return {
      questionId: question.id,
      questionNumber: question.number,
      status,
      userAnswer: answer,
      correctAnswer: question.correctAnswer,
      isAnswered,
      isObjective
    };
  });

  return {
    totalQuestions: questions.length,
    answeredQuestions,
    unansweredQuestions: questions.length - answeredQuestions,
    objectiveQuestions,
    correctAnswers,
    incorrectAnswers,
    ungradedQuestions,
    accuracy: objectiveQuestions === 0 ? null : correctAnswers / objectiveQuestions,
    questionResults
  };
}
