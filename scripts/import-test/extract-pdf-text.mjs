import path from "node:path";
import { ensureGeneratedDir, readJson, writeJson } from "./utils.mjs";

export async function extractPdfTextStage(testId) {
  const { generatedDir } = await ensureGeneratedDir(testId);
  const report = await readJson(path.join(generatedDir, "text-extraction.json"), { pages: [] });
  await writeJson(path.join(generatedDir, "text-extraction.json"), {
    ...report,
    updatedAt: new Date().toISOString(),
    status: "not_run",
    notes: ["Automatic PDF text extraction is intentionally staged. Add OCR/text output here before parsing questions."]
  });
  return { pagesWithTextLayer: report.pages?.filter((page) => page.text?.trim()).length || 0, pagesNeedingOcr: 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const testId = process.argv[2];
  if (!testId) throw new Error("Usage: node extract-pdf-text.mjs <testId>");
  console.log(await extractPdfTextStage(testId));
}
