import path from "node:path";
import { ensureGeneratedDir, readJson, writeJson } from "./utils.mjs";

export async function importAnswerKeyStage(testId) {
  const { generatedDir } = await ensureGeneratedDir(testId);
  const test = await readJson(path.join(generatedDir, "test.json"));
  const answers = {};
  for (const section of test?.sections || []) {
    for (const testModule of section.modules || []) {
      for (const question of testModule.questions || []) {
        if (question.correctAnswer) answers[question.id] = question.correctAnswer;
      }
    }
  }
  await writeJson(path.join(generatedDir, "answer-key.json"), answers);
  return { importedAnswers: Object.keys(answers).length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const testId = process.argv[2];
  if (!testId) throw new Error("Usage: node import-answer-key.mjs <testId>");
  console.log(await importAnswerKeyStage(testId));
}
