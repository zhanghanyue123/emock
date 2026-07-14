import { TOEFL_NAVIGATION } from "./question-types";
import type { NavigationStrategy } from "@/core/exam/types";

export const toeflFreeNavigation: NavigationStrategy = {
  id: TOEFL_NAVIGATION.freeWithinModule,
  canGoPrevious({ questionIds, currentQuestionId }) {
    return questionIds.indexOf(currentQuestionId) > 0;
  },
  canGoNext({ questionIds, currentQuestionId }) {
    return questionIds.indexOf(currentQuestionId) < questionIds.length - 1;
  },
  canJumpTo({ questionIds }, targetQuestionId) {
    return questionIds.includes(targetQuestionId);
  }
};

export const toeflForwardOnlyNavigation: NavigationStrategy = {
  id: TOEFL_NAVIGATION.forwardOnly,
  canGoPrevious() {
    return false;
  },
  canGoNext({ questionIds, currentQuestionId }) {
    return questionIds.indexOf(currentQuestionId) < questionIds.length - 1;
  },
  canJumpTo({ questionIds, currentQuestionId }, targetQuestionId) {
    return questionIds.indexOf(targetQuestionId) > questionIds.indexOf(currentQuestionId);
  }
};
