import { readFile } from "node:fs/promises";
import path from "node:path";

const GENERATED_DIR = path.resolve("真题合集7-5/2.8新托福真题/generated");
const genericPrompts = [
  /^Read the material and answer the question\.$/i,
  /^Read the academic passage and answer the question\.$/i,
  /^Choose the best answer\.$/i,
  /^Reading question \d+$/i,
  /^Question \d+$/i
];

const questions = JSON.parse(await readFile(path.join(GENERATED_DIR, "questions.json"), "utf8"));

const readingItems = questions.filter((question) => {
  if (question.sectionId !== "reading") return false;
  return (question.moduleId === "reading-m1" && question.number >= 21 && question.number <= 35) ||
    (question.moduleId === "reading-m2" && question.number >= 11);
});

const rows = [];
const errors = [];

for (const question of readingItems) {
  const readiness = question.config?.readiness || "missing_question_data";
  const prompt = question.prompt?.text || "";
  const options = Array.isArray(question.config?.options) ? question.config.options : [];
  const source = question.config?.readingQuestionSource || {};
  const sourceQuestionNumber = source.sourceQuestionNumber;
  const status = readiness;
  rows.push({
    uiQuestion: `${question.moduleId}:${question.number}`,
    sourceQuestionNumber,
    materialAsset: source.materialAssetId || question.config?.imageAssetId || "",
    questionAsset: source.questionAssetId || question.config?.questionImageAssetId || "",
    prompt,
    optionCount: options.length,
    status
  });

  if (sourceQuestionNumber !== undefined && Number(sourceQuestionNumber) !== Number(question.number)) {
    errors.push(`${question.id}: sourceQuestionNumber ${sourceQuestionNumber} does not match UI question ${question.number}`);
  }
  if (readiness === "structured_ready") {
    if (!prompt || genericPrompts.some((pattern) => pattern.test(prompt))) errors.push(`${question.id}: structured_ready has generic or missing prompt`);
    if (options.length < 4 && !question.questionType.includes("sentence_insertion")) errors.push(`${question.id}: structured_ready has fewer than four options`);
    if (!question.config?.correctOptionId && question.questionType.includes("choice")) errors.push(`${question.id}: structured_ready missing correctOptionId`);
  } else if (readiness === "source_question_ready") {
    if (!source.questionAssetId && !question.config?.questionImageAssetId) errors.push(`${question.id}: source_question_ready missing question image asset`);
  } else {
    errors.push(`${question.id}: missing_question_data`);
  }
}

console.table(rows);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const summary = rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ checked: rows.length, summary }, null, 2));
