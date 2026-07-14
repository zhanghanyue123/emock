import path from "node:path";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";

const ROOT = path.resolve(process.argv.includes("--root") ? process.argv[process.argv.indexOf("--root") + 1] : "真题合集7-5");

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function optionId(questionId, label) {
  return `${questionId}-option-${label.toLowerCase()}`;
}

function pageNumberFromFile(value = "") {
  const match = String(value).match(/page-(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function knownReadingFixture() {
  return null;
}

function normalizeCompleteWordsQuestions(questions, stimuli) {
  const reading = questions.filter((question) => question.sectionId === "reading" && question.moduleId === "reading-m1");
  const firstGroup = reading.filter((question) => question.questionType.includes("complete_words") && question.number >= 1 && question.number <= 10);
  const secondGroup = reading.filter((question) => question.questionType.includes("complete_words") && question.number >= 11 && question.number <= 20);
  for (const group of [firstGroup, secondGroup]) {
    if (!group.length) continue;
    const first = group[0];
    const groupId = first.number <= 10 ? "reading-m1-complete-words-1" : "reading-m1-complete-words-2";
    const firstAssetId = first.config?.imageAssetId;
    for (const question of group) {
      question.stimulusId = groupId;
      question.config = {
        ...question.config,
        sourceAssetId: firstAssetId || question.config?.sourceAssetId,
        imageAssetId: firstAssetId || question.config?.imageAssetId,
        displayMode: "structured"
      };
      question.assetIds = firstAssetId ? [firstAssetId] : question.assetIds;
      question.prompt = { type: "plain_text", text: "Complete the missing letters in the passage." };
    }
    const existing = stimuli.find((stimulus) => stimulus.id === groupId);
    const nextStimulus = {
      id: groupId,
      examPackId: "toefl",
      stimulusType: "reading_material",
      title: first.number <= 10 ? "Questions 1-10" : "Questions 11-20",
      assetIds: firstAssetId ? [firstAssetId] : [],
      config: { questionRange: [group[0].number, group.at(-1).number], displayMode: "complete_words_page" }
    };
    if (existing) Object.assign(existing, nextStimulus);
    else stimuli.push(nextStimulus);
  }
}

function relinkReadingPageAssets(questions, assets) {
  const readingPageAssets = assets
    .filter((asset) => asset.type === "image" && asset.metadata?.section === "reading" && asset.metadata?.role === "source_page")
    .sort((a, b) => (a.metadata?.page || pageNumberFromFile(a.fileName)) - (b.metadata?.page || pageNumberFromFile(b.fileName)));
  if (!readingPageAssets.length) return;
  const byQuestionNumber = new Map();
  for (const asset of readingPageAssets) {
    const page = asset.metadata?.page || pageNumberFromFile(asset.fileName);
    if (page === 5) byQuestionNumber.set(26, asset);
    if (page === 6) byQuestionNumber.set(27, asset);
    if (page === 7) {
      byQuestionNumber.set(28, asset);
      byQuestionNumber.set(29, asset);
    }
    if (page === 8) {
      byQuestionNumber.set(30, asset);
      byQuestionNumber.set(31, asset);
    }
  }
  for (const question of questions) {
    if (question.sectionId !== "reading" || !question.questionType.includes("choice")) continue;
    const asset = byQuestionNumber.get(question.number);
    if (!asset) continue;
    question.config = {
      ...question.config,
      imageAssetId: asset.id,
      sourceAssetId: asset.id,
      sourcePage: asset.metadata?.page,
      displayMode: question.config.options?.length ? "structured" : "source_image_fallback",
      readiness: question.config.options?.length ? "structured_ready" : question.config?.readiness
    };
    question.assetIds = [asset.id];
    question.source = { ...(question.source || {}), page: asset.metadata?.page, file: asset.metadata?.sourcePdf || question.source?.file };
  }
}

function applyKnownFixtures(questions) {
  let changed = 0;
  for (const question of questions) {
    if (question.sectionId !== "reading" || !question.questionType.includes("choice")) continue;
    const fixture = knownReadingFixture(question);
    if (!fixture) continue;
    const options = fixture.options.map((option) => ({ id: optionId(question.id, option.label), label: option.label, text: option.text }));
    const answer = String(question.config?.importedAnswer || "").trim().toUpperCase();
    question.questionType = "toefl.daily_life_choice";
    question.rendererId = "toefl.renderer.choice";
    question.scoringStrategyId = "toefl.exact_single_choice";
    question.prompt = { type: "plain_text", text: fixture.prompt };
    const correctOptionId = /^[A-D]$/.test(answer) ? optionId(question.id, answer) : question.config?.correctOptionId;
    question.config = {
      ...question.config,
      options,
      correctOptionId,
      displayMode: "structured"
    };
    question.needsReview = !correctOptionId;
    question.status = "published";
    question.confidence = Math.max(question.confidence || 0, 0.85);
    changed += 1;
  }
  return changed;
}

async function finalizeFolder(folder) {
  const generatedDir = path.join(folder, "generated");
  const questionsPath = path.join(generatedDir, "questions.json");
  if (!await exists(questionsPath)) return null;
  const questions = await readJson(questionsPath, []);
  const stimuli = await readJson(path.join(generatedDir, "stimuli.json"), []);
  const assets = await readJson(path.join(generatedDir, "assets.json"), []);
  normalizeCompleteWordsQuestions(questions, stimuli);
  relinkReadingPageAssets(questions, assets);
  const structuredChoices = applyKnownFixtures(questions);
  await writeJson(questionsPath, questions);
  await writeJson(path.join(generatedDir, "stimuli.json"), stimuli);
  await writeJson(path.join(generatedDir, "answer-key.json"), Object.fromEntries(questions.map((question) => [question.id, question.config?.correctValues || question.config?.correctOptionId || question.config?.correctTokenOrder || question.config?.correctText || question.config?.importedAnswer || null])));
  const reading = questions.filter((question) => question.sectionId === "reading");
  const fallback = reading.filter((question) => question.config?.displayMode === "source_image_fallback").length;
  const choices = reading.filter((question) => question.questionType.includes("choice") && Array.isArray(question.config?.options) && question.config.options.length > 0).length;
  return { sourceName: path.basename(folder), reading: reading.length, choices, fallback, structuredChoices };
}

const folders = (await readdir(ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
  .map((entry) => path.join(ROOT, entry.name));
const results = [];
for (const folder of folders) {
  const result = await finalizeFolder(folder);
  if (result) results.push(result);
}
console.log(JSON.stringify(results, null, 2));
