import path from "node:path";
import { ensureGeneratedDir, readJson, writeJson } from "./utils.mjs";

export async function classifyPagesStage(testId) {
  const { generatedDir } = await ensureGeneratedDir(testId);
  const extraction = await readJson(path.join(generatedDir, "text-extraction.json"), { pages: [] });
  const pages = (extraction.pages || []).map((page) => ({
    page: page.page,
    section: page.section || null,
    confidence: page.section ? 0.8 : 0,
    needsReview: !page.section
  }));
  await writeJson(path.join(generatedDir, "page-classification.json"), { updatedAt: new Date().toISOString(), pages });
  return { classifiedPages: pages.length, needsReview: pages.filter((page) => page.needsReview).length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const testId = process.argv[2];
  if (!testId) throw new Error("Usage: node classify-pages.mjs <testId>");
  console.log(await classifyPagesStage(testId));
}
