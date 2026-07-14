import type { SectionKey } from "@/types/test";
import type { VocabularyItem, VocabularyStatus } from "@/types/practice";

export type VocabularyFilter = "all" | VocabularyStatus | "starred" | "incorrect";
export type VocabularySort = "recent" | "oldest" | "alphabetical" | "mistakes" | "reviewed";

export interface VocabularyFilterState {
  query: string;
  filter: VocabularyFilter;
  section: "all" | SectionKey;
  testId: string;
  tag: string;
  sort: VocabularySort;
}

function searchable(item: VocabularyItem) {
  return [
    item.word,
    item.normalizedWord,
    item.definition,
    item.translation,
    item.exampleSentence,
    item.personalNote,
    item.tags.join(" ")
  ].filter(Boolean).join(" ").toLowerCase();
}

export function filterVocabularyItems(items: VocabularyItem[], state: VocabularyFilterState) {
  const query = state.query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (query && !searchable(item).includes(query)) return false;
    if (state.filter === "starred" && !item.isStarred) return false;
    if (state.filter === "incorrect" && !item.sources.some((source) => source.resultStatus === "incorrect")) return false;
    if (["new", "learning", "mastered", "archived"].includes(state.filter) && item.status !== state.filter) return false;
    if (state.section !== "all" && !item.sources.some((source) => source.section === state.section)) return false;
    if (state.testId && !item.sources.some((source) => source.testId === state.testId)) return false;
    if (state.tag && !item.tags.includes(state.tag)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (state.sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (state.sort === "alphabetical") return a.normalizedWord.localeCompare(b.normalizedWord);
    if (state.sort === "mistakes") return b.mistakeCount - a.mistakeCount;
    if (state.sort === "reviewed") return (b.lastReviewedAt || "").localeCompare(a.lastReviewedAt || "");
    return b.createdAt.localeCompare(a.createdAt);
  });
}
