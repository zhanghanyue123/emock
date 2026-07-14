import type { AttemptScore, QuestionResult, QuestionResultStatus } from "@/types/practice";
import type { AnswerValue } from "@/types/test";
import type { QuestionAnswer, TestQuestion } from "@/types/structured-test";
import "@/exam-packs/toefl";
import { gradeExamQuestion } from "@/core/exam/scoring";
import { answerValueToExamResponse, structuredQuestionToExamQuestion } from "@/lib/toefl-structured-adapter";

function isAnswered(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") return Object.values(value).some((entry) => String(entry || "").trim().length > 0);
  return false;
}

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function sameStringArray(left: unknown, right: string[]) {
  if (!Array.isArray(left)) return false;
  return [...new Set(left.map(String))].sort().join("|") === [...new Set(right)].sort().join("|");
}

function statusFor(question: TestQuestion, answer: AnswerValue | undefined): { status: QuestionResultStatus; isObjective: boolean; details?: Record<string, unknown> } {
  const examQuestion = structuredQuestionToExamQuestion(question);
  const grade = gradeExamQuestion(examQuestion, answerValueToExamResponse(question, answer));
  if (grade.status === "correct" || grade.status === "incorrect" || grade.status === "unanswered" || grade.status === "ungraded") {
    return {
      status: grade.status,
      isObjective: grade.status !== "ungraded" || Boolean(question.correctAnswer && question.correctAnswer.type !== "manual_or_ai"),
      details: grade.details
    };
  }
  const correct = question.correctAnswer;
  if (!correct || correct.type === "manual_or_ai") return { status: "ungraded", isObjective: false };
  if (!isAnswered(answer)) return { status: "unanswered", isObjective: true };

  if (correct.type === "single_choice" || correct.type === "listen_choose_response" || correct.type === "listening_group_question") {
    return { status: answer === correct.optionId ? "correct" : "incorrect", isObjective: true };
  }
  if (correct.type === "multiple_choice") {
    return { status: sameStringArray(answer, correct.optionIds) ? "correct" : "incorrect", isObjective: true };
  }
  if (correct.type === "sentence_insertion") {
    return { status: answer === correct.locationId ? "correct" : "incorrect", isObjective: true };
  }
  if (correct.type === "build_sentence") {
    const actual = Array.isArray(answer) ? answer.map(normalizeText).join(" ") : normalizeText(answer);
    const expected = correct.tokens.map(normalizeText).join(" ");
    return { status: actual === expected ? "correct" : "incorrect", isObjective: true };
  }
  if (correct.type === "complete_words") {
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) return { status: "incorrect", isObjective: true };
    const allCorrect = Object.entries(correct.values).every(([blankId, value]) => normalizeText(answer[blankId]) === normalizeText(value));
    return { status: allCorrect ? "correct" : "incorrect", isObjective: true };
  }
  return { status: "ungraded", isObjective: false };
}

export function scoreStructuredAttempt(questions: TestQuestion[], answers: Record<string, AnswerValue>): AttemptScore {
  let answeredQuestions = 0;
  let objectiveQuestions = 0;
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let ungradedQuestions = 0;

  const questionResults: QuestionResult[] = questions.map((question) => {
    const userAnswer = answers[question.id];
    const answered = isAnswered(userAnswer);
    if (answered) answeredQuestions += 1;
    const result = statusFor(question, userAnswer);
    if (result.isObjective) objectiveQuestions += 1;
    else ungradedQuestions += 1;
    if (result.status === "correct") correctAnswers += 1;
    if (result.status === "incorrect") incorrectAnswers += 1;
    return {
      questionId: question.id,
      questionNumber: question.number,
      status: result.status,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isAnswered: answered,
      isObjective: result.isObjective,
      details: result.details
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

export function structuredCorrectAnswerText(answer?: QuestionAnswer) {
  if (!answer) return undefined;
  if (answer.type === "single_choice") return answer.optionId;
  if (answer.type === "multiple_choice") return answer.optionIds;
  if (answer.type === "complete_words") return answer.values;
  if (answer.type === "build_sentence") return answer.tokens;
  if (answer.type === "sentence_insertion") return answer.locationId;
  return undefined;
}
