import type { ExamPack, ExamQuestionRenderer, NavigationStrategy, ScoringStrategy } from "./types";

const packs = new Map<string, ExamPack>();
const renderers = new Map<string, ExamQuestionRenderer>();
const scoringStrategies = new Map<string, ScoringStrategy>();
const navigationStrategies = new Map<string, NavigationStrategy>();

export function registerQuestionRenderer(renderer: ExamQuestionRenderer) {
  renderers.set(renderer.id, renderer);
}

export function getQuestionRenderer(rendererId: string) {
  return renderers.get(rendererId);
}

export function registerScoringStrategy(strategy: ScoringStrategy) {
  scoringStrategies.set(strategy.id, strategy);
}

export function getScoringStrategy(strategyId: string) {
  return scoringStrategies.get(strategyId);
}

export function registerNavigationStrategy(strategy: NavigationStrategy) {
  navigationStrategies.set(strategy.id, strategy);
}

export function getNavigationStrategy(strategyId: string) {
  return navigationStrategies.get(strategyId);
}

export function registerExamPack(pack: ExamPack) {
  packs.set(pack.id, pack);
}

export function getExamPack(packId: string) {
  return packs.get(packId);
}

export function listExamPacks() {
  return [...packs.values()];
}
