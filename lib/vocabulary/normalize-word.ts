const EDGE_PUNCTUATION = /^[\s"'“”‘’.,!?;:()[\]{}<>，。！？；：（）【】《》]+|[\s"'“”‘’.,!?;:()[\]{}<>，。！？；：（）【】《》]+$/g;

export function normalizeVocabularyWord(input: string) {
  return input.replace(EDGE_PUNCTUATION, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function cleanVocabularyDisplayText(input: string) {
  return input.replace(EDGE_PUNCTUATION, "").replace(/\s+/g, " ").trim();
}
