import path from "node:path";
import { readFile, readdir } from "node:fs/promises";

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function findGeneratedDirs(root) {
  const dirs = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    if (entries.some((entry) => entry.isDirectory() && entry.name === "generated")) dirs.push(path.join(dir, "generated"));
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "generated") await walk(path.join(dir, entry.name));
    }
  }
  await walk(root);
  return dirs;
}

async function validateGenerated(dir) {
  const errors = [];
  const exam = await readJson(path.join(dir, "exam.json")).catch(() => null);
  const questions = await readJson(path.join(dir, "questions.json")).catch(() => []);
  const stimuli = await readJson(path.join(dir, "stimuli.json")).catch(() => []);
  const answerKey = await readJson(path.join(dir, "answer-key.json")).catch(() => ({}));
  if (!exam?.id) errors.push("exam.json missing id");
  if (!Array.isArray(questions) || questions.length === 0) errors.push("questions.json has no questions");
  const stimulusIds = new Set((stimuli || []).map((stimulus) => stimulus.id));
  for (const question of questions || []) {
    if (!question.id) errors.push("question missing id");
    if (!question.examPackId) errors.push(`${question.id}: missing examPackId`);
    if (!question.rendererId) errors.push(`${question.id}: missing rendererId`);
    if (!question.scoringStrategyId) errors.push(`${question.id}: missing scoringStrategyId`);
    if (question.stimulusId && !stimulusIds.has(question.stimulusId)) errors.push(`${question.id}: missing stimulus ${question.stimulusId}`);
    if (question.scoringStrategyId !== "toefl.manual_or_ai" && !question.needsReview && !answerKey[question.id]) errors.push(`${question.id}: missingAnswer`);
  }
  return { dir, ok: errors.length === 0, errors, questionCount: questions.length };
}

const roots = [path.join(process.cwd(), "content")];
const configured = await readFile(path.join(process.cwd(), "content-source.local.json"), "utf8").then((raw) => JSON.parse(raw).contentDir).catch(() => null);
if (configured) roots.push(configured);
const results = [];
for (const root of roots) {
  for (const dir of await findGeneratedDirs(root)) {
    if (await readFile(path.join(dir, "exam.json"), "utf8").then(() => true).catch(() => false)) results.push(await validateGenerated(dir));
  }
}
console.log(JSON.stringify(results, null, 2));
const failed = results.filter((result) => !result.ok);
if (failed.length > 0) process.exit(1);
