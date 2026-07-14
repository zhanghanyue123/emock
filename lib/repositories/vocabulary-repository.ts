import { STORAGE_KEYS, VOCABULARY_SCHEMA_VERSION } from "../constants";
import { normalizeVocabularyWord } from "../vocabulary/normalize-word";
import type { CreateVocabularyInput, PersistedVocabularyData, VocabularyItem, VocabularySource } from "../../types/practice";

export interface VocabularyRepository {
  getAll(): Promise<VocabularyItem[]>;
  getById(id: string): Promise<VocabularyItem | null>;
  add(input: CreateVocabularyInput): Promise<VocabularyItem>;
  update(id: string, patch: Partial<VocabularyItem>): Promise<VocabularyItem>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  findByNormalizedWord(normalizedWord: string): Promise<VocabularyItem | null>;
}

function readPersisted(): PersistedVocabularyData {
  if (typeof window === "undefined") return { schemaVersion: VOCABULARY_SCHEMA_VERSION, items: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.vocabulary);
    if (!raw) return { schemaVersion: VOCABULARY_SCHEMA_VERSION, items: [] };
    const parsed = JSON.parse(raw) as PersistedVocabularyData | VocabularyItem[];
    const items = Array.isArray(parsed) ? parsed : parsed.items || [];
    return { schemaVersion: VOCABULARY_SCHEMA_VERSION, items: migrateItems(items) };
  } catch {
    return { schemaVersion: VOCABULARY_SCHEMA_VERSION, items: [] };
  }
}

function writePersisted(items: VocabularyItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.vocabulary, JSON.stringify({ schemaVersion: VOCABULARY_SCHEMA_VERSION, items }));
}

function sourceKey(source: VocabularySource) {
  return [source.testId, source.section, source.questionId, source.questionNumber, source.addedFrom, source.sourceText].join("|");
}

function mergeSources(existing: VocabularySource[], next?: VocabularySource) {
  const all = next ? [...existing, next] : existing;
  const map = new Map<string, VocabularySource>();
  for (const source of all) map.set(sourceKey(source), source);
  return [...map.values()];
}

function migrateItems(items: VocabularyItem[]) {
  const byWord = new Map<string, VocabularyItem>();
  for (const item of items) {
    if (!item?.word) continue;
    const normalizedWord = item.normalizedWord || normalizeVocabularyWord(item.word);
    if (!normalizedWord) continue;
    const sources = item.sources?.length ? item.sources : item.source ? [item.source] : [];
    const migrated: VocabularyItem = {
      ...item,
      id: item.id || crypto.randomUUID(),
      normalizedWord,
      tags: item.tags || [],
      sources,
      source: sources[sources.length - 1],
      status: item.status || "new",
      isStarred: Boolean(item.isStarred),
      mistakeCount: item.mistakeCount || 0,
      reviewCount: item.reviewCount || 0,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
    const existing = byWord.get(normalizedWord);
    if (existing) {
      existing.sources = mergeSources(existing.sources, migrated.source);
      existing.mistakeCount += migrated.mistakeCount;
      existing.updatedAt = existing.updatedAt > migrated.updatedAt ? existing.updatedAt : migrated.updatedAt;
    } else {
      byWord.set(normalizedWord, migrated);
    }
  }
  return [...byWord.values()];
}

export class LocalStorageVocabularyRepository implements VocabularyRepository {
  async getAll() {
    return readPersisted().items;
  }

  async getById(id: string) {
    return (await this.getAll()).find((item) => item.id === id) || null;
  }

  async findByNormalizedWord(normalizedWord: string) {
    return (await this.getAll()).find((item) => item.normalizedWord === normalizedWord) || null;
  }

  async add(input: CreateVocabularyInput) {
    const normalizedWord = normalizeVocabularyWord(input.word);
    if (!normalizedWord) throw new Error("Word or phrase is empty.");
    const items = await this.getAll();
    const existing = items.find((item) => item.normalizedWord === normalizedWord);
    if (existing) throw new Error("VOCABULARY_DUPLICATE");
    const now = new Date().toISOString();
    const sources = input.source ? [input.source] : [];
    const item: VocabularyItem = {
      id: crypto.randomUUID(),
      word: input.word.trim(),
      normalizedWord,
      definition: input.definition,
      translation: input.translation,
      partOfSpeech: input.partOfSpeech,
      pronunciation: input.pronunciation,
      exampleSentence: input.exampleSentence,
      personalNote: input.personalNote,
      source: input.source,
      sources,
      tags: input.tags || [],
      status: input.status || "new",
      isStarred: Boolean(input.isStarred),
      mistakeCount: input.source?.resultStatus === "incorrect" ? 1 : 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now
    };
    writePersisted([item, ...items]);
    return item;
  }

  async update(id: string, patch: Partial<VocabularyItem>) {
    const items = await this.getAll();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Vocabulary item not found.");
    const now = new Date().toISOString();
    const nextStatus = patch.status || items[index].status;
    const next: VocabularyItem = {
      ...items[index],
      ...patch,
      normalizedWord: patch.word ? normalizeVocabularyWord(patch.word) : items[index].normalizedWord,
      updatedAt: now,
      masteredAt: nextStatus === "mastered" ? patch.masteredAt || items[index].masteredAt || now : undefined
    };
    items[index] = next;
    writePersisted(items);
    return next;
  }

  async addSource(id: string, source: VocabularySource) {
    const item = await this.getById(id);
    if (!item) throw new Error("Vocabulary item not found.");
    return this.update(id, {
      source,
      sources: mergeSources(item.sources || [], source),
      mistakeCount: item.mistakeCount + (source.resultStatus === "incorrect" ? 1 : 0)
    });
  }

  async remove(id: string) {
    writePersisted((await this.getAll()).filter((item) => item.id !== id));
  }

  async clear() {
    writePersisted([]);
  }
}
