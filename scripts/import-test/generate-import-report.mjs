import path from "node:path";
import { ensureGeneratedDir, readJson, walkFiles, writeJson } from "./utils.mjs";

const audioExtensions = new Set([".mp3", ".m4a", ".wav", ".mp4"]);

export async function generateImportReportStage(testId, stageResults = {}) {
  const { folder, generatedDir } = await ensureGeneratedDir(testId);
  const files = await walkFiles(folder);
  const test = await readJson(path.join(generatedDir, "test.json"), { sections: [] });
  const audioGroups = await readJson(path.join(generatedDir, "audio-groups.json"), []);
  const answers = await readJson(path.join(generatedDir, "answer-key.json"), {});
  const questions = (test.sections || []).flatMap((section) => (section.modules || []).flatMap((module) => module.questions || []));
  const report = {
    testId,
    generatedAt: new Date().toISOString(),
    sourceSummary: {
      pdfFiles: files.filter((file) => path.extname(file).toLowerCase() === ".pdf").length,
      audioFiles: files.filter((file) => audioExtensions.has(path.extname(file).toLowerCase())).length,
      pagesRendered: stageResults.pagesRendered || 0,
      pagesWithTextLayer: stageResults.pagesWithTextLayer || 0,
      pagesNeedingOcr: stageResults.pagesNeedingOcr || 0
    },
    recognized: {
      sections: (test.sections || []).length,
      modules: (test.sections || []).reduce((sum, section) => sum + (section.modules || []).length, 0),
      questions: questions.length
    },
    needsReview: questions.filter((question) => question.needsReview || (question.confidence ?? 1) < 0.85).map((question) => question.id),
    matchedAudio: audioGroups.length,
    importedAnswers: Object.keys(answers).length,
    notes: [
      "PDF and audio files are import sources only; formal practice uses generated structured JSON.",
      "This pipeline records staged metadata and validates existing generated JSON. It does not guess answers or publish drafts automatically."
    ]
  };
  await writeJson(path.join(generatedDir, "import-report.json"), report);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const testId = process.argv[2];
  if (!testId) throw new Error("Usage: node generate-import-report.mjs <testId>");
  console.log(await generateImportReportStage(testId));
}
