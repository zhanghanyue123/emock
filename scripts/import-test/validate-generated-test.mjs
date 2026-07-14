import path from "node:path";
import { ensureGeneratedDir, parseArgs, readJson, sectionKeys } from "./utils.mjs";

function fail(message, details = []) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function validateQuestion(question, seenIds, errors) {
  if (!question?.id) errors.push("question.id is required");
  if (seenIds.has(question.id)) errors.push(`duplicate question id: ${question.id}`);
  seenIds.add(question.id);
  if (!sectionKeys.has(question.section)) errors.push(`${question.id}: invalid section`);
  if (typeof question.number !== "number") errors.push(`${question.id}: number must be numeric`);
  if (!question.type) errors.push(`${question.id}: type is required`);
  if (question.type === "single_choice" && (!Array.isArray(question.options) || question.options.length < 2)) errors.push(`${question.id}: single_choice needs at least two options`);
  if (question.correctAnswer?.type === "single_choice" && !question.options?.some((option) => option.id === question.correctAnswer.optionId)) errors.push(`${question.id}: correct option is not in options`);
  if (question.correctAnswer?.type === "complete_words" && Object.keys(question.correctAnswer.values || {}).length === 0) errors.push(`${question.id}: complete_words answer is empty`);
}

export async function validateGeneratedTest(testId) {
  const { generatedDir } = await ensureGeneratedDir(testId);
  const test = await readJson(path.join(generatedDir, "test.json"));
  if (!test) fail("generated/test.json is missing or invalid JSON");
  const errors = [];
  if (test.id !== testId) errors.push(`test.id (${test.id}) does not match requested test (${testId})`);
  if (!["draft", "review", "published"].includes(test.status)) errors.push("test.status must be draft, review, or published");
  if (!Array.isArray(test.sections)) errors.push("test.sections must be an array");
  const seenIds = new Set();
  for (const section of test.sections || []) {
    if (!sectionKeys.has(section.key)) errors.push(`${section.id}: invalid section key`);
    if (!Array.isArray(section.modules)) errors.push(`${section.id}: modules must be an array`);
    for (const testModule of section.modules || []) {
      if (!Array.isArray(testModule.questions)) errors.push(`${testModule.id}: questions must be an array`);
      for (const question of testModule.questions || []) validateQuestion(question, seenIds, errors);
    }
  }
  const passages = await readJson(path.join(generatedDir, "passages.json"), []);
  const passageIds = new Set(passages.map((passage) => passage.id));
  for (const section of test.sections || []) {
    for (const testModule of section.modules || []) {
      for (const question of testModule.questions || []) {
        if (question.passageId && !passageIds.has(question.passageId)) errors.push(`${question.id}: missing passage ${question.passageId}`);
      }
    }
  }
  if (errors.length > 0) fail("Generated test validation failed", errors);
  return { ok: true, questions: seenIds.size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const testId = args.test || process.argv[2];
  if (!testId) throw new Error("Usage: npm run validate-test -- --test <testId>");
  try {
    console.log(await validateGeneratedTest(testId));
  } catch (error) {
    console.error(error.message);
    for (const detail of error.details || []) console.error(`- ${detail}`);
    process.exit(1);
  }
}
