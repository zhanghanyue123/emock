import path from "node:path";
import { ensureGeneratedDir, readJson, writeJson } from "./utils.mjs";

function emptyTest(testId) {
  return {
    id: testId,
    title: testId,
    version: 1,
    status: "draft",
    sections: []
  };
}

export async function parseQuestionsStage(testId) {
  const { generatedDir } = await ensureGeneratedDir(testId);
  const testPath = path.join(generatedDir, "test.json");
  const test = await readJson(testPath, emptyTest(testId));
  await writeJson(testPath, test);
  await writeJson(path.join(generatedDir, "passages.json"), await readJson(path.join(generatedDir, "passages.json"), []));
  return {
    sections: test.sections.length,
    modules: test.sections.reduce((sum, section) => sum + section.modules.length, 0),
    questions: test.sections.reduce((sum, section) => sum + section.modules.reduce((moduleSum, module) => moduleSum + module.questions.length, 0), 0)
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const testId = process.argv[2];
  if (!testId) throw new Error("Usage: node parse-questions.mjs <testId>");
  console.log(await parseQuestionsStage(testId));
}
