import assert from "node:assert/strict";
import { normalizeVocabularyWord } from "../lib/vocabulary/normalize-word.ts";
import { vocabularyToCsv, vocabularyToJson, vocabularyToText, vocabularyToTsv } from "../lib/vocabulary/export-vocabulary.ts";
import { filterVocabularyItems } from "../lib/vocabulary/vocabulary-filters.ts";
assert.equal(normalizeVocabularyWord("  “Counter-Intuitive,” "), "counter-intuitive");
assert.equal(normalizeVocabularyWord(" TAKE   into  account "), "take into account");
assert.equal(normalizeVocabularyWord(" children's! "), "children's");
assert.equal(normalizeVocabularyWord("..."), "");

const item = {
  id: "1",
  word: "analyse",
  normalizedWord: "analyse",
  translation: "分析",
  definition: 'to examine, "carefully"',
  partOfSpeech: "verb",
  pronunciation: "",
  exampleSentence: "Line one\nLine two",
  personalNote: "note\twith tab",
  source: { testTitle: "T", section: "reading", questionNumber: 2, resultStatus: "incorrect" },
  sources: [{ testTitle: "T", section: "reading", questionNumber: 2, resultStatus: "incorrect" }],
  tags: ["academic", "reading"],
  status: "new",
  isStarred: true,
  mistakeCount: 1,
  reviewCount: 0,
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z"
};

const csv = vocabularyToCsv([item]);
assert.ok(csv.startsWith("\uFEFF"));
assert.ok(csv.includes('""carefully""'));
assert.ok(csv.includes('"Line one\nLine two"'));

const tsv = vocabularyToTsv([item]);
assert.equal(tsv.includes("\twith tab"), false);
assert.equal(vocabularyToJson([item]), JSON.stringify([item], null, 2));
assert.equal(vocabularyToText([item], "word-only"), "analyse");
assert.equal(vocabularyToText([item], "word-translation"), "analyse - 分析");

const filtered = filterVocabularyItems([item], { query: "分析", filter: "starred", section: "reading", testId: "", tag: "academic", sort: "recent" });
assert.equal(filtered.length, 1);
const emptyFiltered = filterVocabularyItems([item], { query: "missing", filter: "all", section: "all", testId: "", tag: "", sort: "recent" });
assert.equal(emptyFiltered.length, 0);

const duplicateMap = new Map();
const normalized = normalizeVocabularyWord(" Analyse ");
duplicateMap.set(normalized, { sources: [{ questionId: "q1" }], mistakeCount: 1, status: "new" });
assert.equal(duplicateMap.has(normalizeVocabularyWord("analyse")), true);
const existing = duplicateMap.get(normalized);
existing.sources.push({ questionId: "q2" });
existing.mistakeCount += 1;
existing.status = "mastered";
assert.equal(existing.sources.length, 2);
assert.equal(existing.mistakeCount, 2);
assert.equal(existing.status, "mastered");
duplicateMap.delete(normalized);
assert.equal(duplicateMap.size, 0);

console.log("Vocabulary tests passed.");
