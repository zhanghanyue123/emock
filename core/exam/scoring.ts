import { getScoringStrategy } from "./exam-registry";
import type { ExamQuestion, ExamResponse, QuestionGrade } from "./types";

export function gradeExamQuestion(question: ExamQuestion, response: ExamResponse | undefined): QuestionGrade {
  const strategy = getScoringStrategy(question.scoringStrategyId);
  if (!strategy) {
    return {
      questionId: question.id,
      status: response ? "ungraded" : "unanswered",
      details: { missingScoringStrategyId: question.scoringStrategyId }
    };
  }
  return strategy.grade({ question, response });
}

export function gradeExamQuestions(questions: ExamQuestion[], responses: Record<string, ExamResponse>) {
  return questions.map((question) => gradeExamQuestion(question, responses[question.id]));
}
