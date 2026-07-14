import { getAllTests, getTestById } from "@/lib/content";
import type { TestManifest, TestManifestSummary } from "@/types/test";

export interface ContentRepository {
  getAllTests(): Promise<TestManifestSummary[]>;
  getTestById(testId: string): Promise<TestManifest | null>;
}

export class LocalContentRepository implements ContentRepository {
  getAllTests() {
    return getAllTests();
  }

  getTestById(testId: string) {
    return getTestById(testId);
  }
}
