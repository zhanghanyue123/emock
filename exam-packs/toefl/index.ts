import { registerExamPack, registerNavigationStrategy, registerQuestionRenderer, registerScoringStrategy } from "@/core/exam/exam-registry";
import type { ExamDefinition, ExamPack, ValidationResult } from "@/core/exam/types";
import { ListeningChoiceQuestion } from "./components/ListeningChoiceQuestion";
import { ToeflBuildSentenceQuestion } from "./components/ToeflBuildSentenceQuestion";
import { ToeflChoiceQuestion } from "./components/ToeflChoiceQuestion";
import { ToeflCompleteWordsQuestion } from "./components/ToeflCompleteWordsQuestion";
import { ToeflRecordingQuestion } from "./components/ToeflRecordingQuestion";
import { ToeflTextResponseQuestion } from "./components/ToeflTextResponseQuestion";
import { toeflFreeNavigation, toeflForwardOnlyNavigation } from "./navigation";
import { TOEFL_NAVIGATION, TOEFL_QUESTION_TYPES, TOEFL_RENDERERS, TOEFL_SCORING } from "./question-types";
import { TOEFL_SECTION_TYPES } from "./section-types";
import { toeflBuildSentenceScoring, toeflCompleteWordsScoring, toeflManualScoring, toeflMultipleChoiceScoring, toeflSingleChoiceScoring } from "./scoring";

export const toeflExamPack: ExamPack = {
  id: "toefl",
  name: "TOEFL Practice",
  version: "0.1.0",
  sectionDefinitions: [
    { id: TOEFL_SECTION_TYPES.reading, title: "Reading" },
    { id: TOEFL_SECTION_TYPES.listening, title: "Listening" },
    { id: TOEFL_SECTION_TYPES.writing, title: "Writing" },
    { id: TOEFL_SECTION_TYPES.speaking, title: "Speaking" }
  ],
  questionTypes: [
    { id: TOEFL_QUESTION_TYPES.completeWords, title: "Complete the Words", rendererId: TOEFL_RENDERERS.completeWords, scoringStrategyId: TOEFL_SCORING.completeWords },
    { id: TOEFL_QUESTION_TYPES.dailyLifeChoice, title: "Daily Life Choice", rendererId: TOEFL_RENDERERS.readingChoice, scoringStrategyId: TOEFL_SCORING.exactSingleChoice },
    { id: TOEFL_QUESTION_TYPES.listenChooseResponse, title: "Listen and Choose Response", rendererId: TOEFL_RENDERERS.listeningChoice, scoringStrategyId: TOEFL_SCORING.exactSingleChoice },
    { id: TOEFL_QUESTION_TYPES.listeningGroupChoice, title: "Listening Group Choice", rendererId: TOEFL_RENDERERS.listeningChoice, scoringStrategyId: TOEFL_SCORING.exactSingleChoice },
    { id: TOEFL_QUESTION_TYPES.academicPassageChoice, title: "Academic Passage Choice", rendererId: TOEFL_RENDERERS.readingChoice, scoringStrategyId: TOEFL_SCORING.exactSingleChoice },
    { id: TOEFL_QUESTION_TYPES.buildSentence, title: "Build a Sentence", rendererId: TOEFL_RENDERERS.buildSentenceInline, scoringStrategyId: TOEFL_SCORING.buildSentence },
    { id: TOEFL_QUESTION_TYPES.writeEmail, title: "Write an Email", rendererId: TOEFL_RENDERERS.text, scoringStrategyId: TOEFL_SCORING.manualOrAi },
    { id: TOEFL_QUESTION_TYPES.academicDiscussion, title: "Academic Discussion", rendererId: TOEFL_RENDERERS.text, scoringStrategyId: TOEFL_SCORING.manualOrAi },
    { id: TOEFL_QUESTION_TYPES.listenRepeat, title: "Listen and Repeat", rendererId: TOEFL_RENDERERS.recording, scoringStrategyId: TOEFL_SCORING.manualOrAi },
    { id: TOEFL_QUESTION_TYPES.interviewResponse, title: "Take an Interview", rendererId: TOEFL_RENDERERS.recording, scoringStrategyId: TOEFL_SCORING.manualOrAi }
  ],
  validateExam(exam: ExamDefinition): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (exam.examPackId !== "toefl") errors.push("ExamDefinition.examPackId must be toefl for the TOEFL pack.");
    for (const section of exam.sections) {
      if (!Object.values(TOEFL_SECTION_TYPES).includes(section.sectionType as never)) warnings.push(`Unknown TOEFL section type: ${section.sectionType}`);
    }
    return { ok: errors.length === 0, errors, warnings };
  },
  getQuestionRenderer(rendererId) {
    return rendererId === TOEFL_RENDERERS.completeWords
      ? { id: TOEFL_RENDERERS.completeWords, component: ToeflCompleteWordsQuestion }
      : rendererId === TOEFL_RENDERERS.listeningChoice
        ? { id: TOEFL_RENDERERS.listeningChoice, component: ListeningChoiceQuestion }
      : rendererId === TOEFL_RENDERERS.choice || rendererId === TOEFL_RENDERERS.readingChoice
        ? { id: rendererId, component: ToeflChoiceQuestion }
        : rendererId === TOEFL_RENDERERS.buildSentence || rendererId === TOEFL_RENDERERS.buildSentenceInline
          ? { id: rendererId, component: ToeflBuildSentenceQuestion }
        : rendererId === TOEFL_RENDERERS.text
          ? { id: TOEFL_RENDERERS.text, component: ToeflTextResponseQuestion }
          : rendererId === TOEFL_RENDERERS.recording
            ? { id: TOEFL_RENDERERS.recording, component: ToeflRecordingQuestion }
        : undefined;
  },
  getScoringStrategy(strategyId) {
    return [toeflSingleChoiceScoring, toeflMultipleChoiceScoring, toeflCompleteWordsScoring, toeflBuildSentenceScoring, toeflManualScoring].find((strategy) => strategy.id === strategyId);
  },
  getNavigationStrategy(strategyId) {
    return [toeflFreeNavigation, toeflForwardOnlyNavigation].find((strategy) => strategy.id === strategyId);
  }
};

export function registerToeflExamPack() {
  registerQuestionRenderer({ id: TOEFL_RENDERERS.completeWords, component: ToeflCompleteWordsQuestion });
  registerQuestionRenderer({ id: TOEFL_RENDERERS.listeningChoice, component: ListeningChoiceQuestion });
  registerQuestionRenderer({ id: TOEFL_RENDERERS.readingChoice, component: ToeflChoiceQuestion });
  registerQuestionRenderer({ id: TOEFL_RENDERERS.choice, component: ToeflChoiceQuestion });
  registerQuestionRenderer({ id: TOEFL_RENDERERS.buildSentence, component: ToeflBuildSentenceQuestion });
  registerQuestionRenderer({ id: TOEFL_RENDERERS.buildSentenceInline, component: ToeflBuildSentenceQuestion });
  registerQuestionRenderer({ id: TOEFL_RENDERERS.text, component: ToeflTextResponseQuestion });
  registerQuestionRenderer({ id: TOEFL_RENDERERS.recording, component: ToeflRecordingQuestion });
  registerScoringStrategy(toeflSingleChoiceScoring);
  registerScoringStrategy(toeflMultipleChoiceScoring);
  registerScoringStrategy(toeflCompleteWordsScoring);
  registerScoringStrategy(toeflBuildSentenceScoring);
  registerScoringStrategy(toeflManualScoring);
  registerNavigationStrategy(toeflFreeNavigation);
  registerNavigationStrategy(toeflForwardOnlyNavigation);
  registerExamPack(toeflExamPack);
}

registerToeflExamPack();
