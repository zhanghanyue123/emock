import type { VocabularyItem } from "@/types/practice";

export type VocabularyExportFormat = "csv" | "tsv" | "json" | "txt";
export type VocabularyTextMode = "word-only" | "word-translation";

function latestSource(item: VocabularyItem) {
  return item.sources?.[item.sources.length - 1] || item.source || {};
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function tsvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value);
  return text.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

export function vocabularyToCsv(items: VocabularyItem[]) {
  const header = [
    "word",
    "translation",
    "definition",
    "partOfSpeech",
    "pronunciation",
    "exampleSentence",
    "personalNote",
    "status",
    "tags",
    "testTitle",
    "section",
    "questionNumber",
    "resultStatus",
    "mistakeCount",
    "reviewCount",
    "createdAt",
    "updatedAt"
  ];
  const rows = items.map((item) => {
    const source = latestSource(item);
    return [
      item.word,
      item.translation,
      item.definition,
      item.partOfSpeech,
      item.pronunciation,
      item.exampleSentence,
      item.personalNote,
      item.status,
      item.tags,
      source.testTitle,
      source.section,
      source.questionNumber,
      source.resultStatus,
      item.mistakeCount,
      item.reviewCount,
      item.createdAt,
      item.updatedAt
    ].map(csvCell).join(",");
  });
  return `\uFEFF${header.join(",")}\n${rows.join("\n")}`;
}

export function vocabularyToTsv(items: VocabularyItem[]) {
  const rows = items.map((item) => [
    item.word,
    item.translation,
    item.definition,
    item.exampleSentence,
    item.personalNote,
    item.tags.join(", ")
  ].map(tsvCell).join("\t"));
  return rows.join("\n");
}

export function vocabularyToJson(items: VocabularyItem[]) {
  return JSON.stringify(items, null, 2);
}

export function vocabularyToText(items: VocabularyItem[], mode: VocabularyTextMode) {
  return items.map((item) => mode === "word-translation" && item.translation ? `${item.word} - ${item.translation}` : item.word).join("\n");
}

export function vocabularyExportFileName(format: VocabularyExportFormat, date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  return `toefl-vocabulary-${stamp}.${format}`;
}
