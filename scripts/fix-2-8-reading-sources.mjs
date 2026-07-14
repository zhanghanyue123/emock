import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const EXAM_FOLDER = path.resolve("真题合集7-5/2.8新托福真题");
const GENERATED_DIR = path.join(EXAM_FOLDER, "generated");
const DERIVED_DIR = path.join(GENERATED_DIR, "derived-assets", "reading");
const EXAM_ID = "28-12326eea";

const structuredFixtures = {
  "reading-m1-q21": {
    prompt: "What is the main purpose of the sign?",
    answer: "A",
    options: [
      "To provide rules for library use",
      "To promote library memberships",
      "To announce recent library acquisitions",
      "To advertise library events"
    ]
  },
  "reading-m1-q22": {
    prompt: "What is indicated about the library?",
    answer: "D",
    options: [
      "It encourages patrons to reshelve books.",
      "It has meeting rooms.",
      "It is closed on Sundays.",
      "It has a place to buy and eat food."
    ]
  },
  "reading-m1-q23": {
    prompt: "The notice suggests that",
    answer: "A",
    options: [
      "people new to photography can benefit from the workshop",
      "participants must pay an entrance fee",
      "participants will leave campus to take pictures",
      "students can learn fashion photography"
    ]
  },
  "reading-m1-q24": {
    prompt: "What would most likely be a part of the event on Sunday from 3:00 p.m. to 4:30 p.m.?",
    answer: "A",
    options: [
      "An exhibition of participants' photography",
      "A sale of used photo equipment",
      "A lecture by a university visual arts professor",
      "An opportunity to learn more photography techniques"
    ]
  },
  "reading-m1-q25": {
    prompt: "Which of the following is NOT true about the photography workshop?",
    answer: "D",
    options: [
      "There will be a photography competition.",
      "Photo editing methods will be presented.",
      "Multiple photography genres will be featured.",
      "Participants must pay for lunch."
    ]
  },
  "reading-m1-q26": {
    prompt: "What are phase-change materials designed to do?",
    answer: "B",
    options: [
      "Generate electricity from movement",
      "Adapt to changes in temperature",
      "Monitor heart rate and body temperature",
      "Change color based on electrical stimuli"
    ]
  },
  "reading-m1-q27": {
    prompt: "Which of the following is NOT mentioned as a challenge for smart textiles?",
    answer: "D",
    options: [
      "Washability",
      "Cost",
      "Durability",
      "Availability"
    ]
  },
  "reading-m1-q28": {
    prompt: "The word \"harvest\" in the passage is closest in meaning to",
    answer: "B",
    options: [
      "grow",
      "collect",
      "spin",
      "discover"
    ]
  },
  "reading-m1-q29": {
    prompt: "What is the main purpose of paragraph 3?",
    answer: "A",
    options: [
      "To present obstacles to the ideas previously introduced",
      "To expand on the benefits mentioned in paragraph 2",
      "To provide information on the future applications of smart textiles",
      "To summarize the main points of the reading"
    ]
  },
  "reading-m1-q31": {
    prompt: "What is coral bleaching?",
    answer: "B",
    options: [
      "An increase in coral growth",
      "An effect of high temperatures that harms coral",
      "A method of coral reproduction",
      "A protective mechanism used by corals"
    ]
  },
  "reading-m1-q32": {
    prompt: "What is the effect of ocean acidification on coral reefs?",
    answer: "C",
    options: [
      "It leads to temperature changes in the surrounding waters.",
      "It can increase atmospheric CO2 levels, resulting in coral bleaching.",
      "It reduces the availability of the calcium carbonate needed for coral structures.",
      "It leads to more stability within existing reefs."
    ]
  },
  "reading-m1-q33": {
    prompt: "The word \"mitigate\" in the passage is closest in meaning to",
    answer: "B",
    options: [
      "research",
      "alleviate",
      "measure",
      "predict"
    ]
  },
  "reading-m1-q34": {
    prompt: "What is suggested in the passage about selective breeding and genetic modification?",
    answer: "B",
    options: [
      "They are the only solutions to coral bleaching.",
      "They are potential methods to develop resilient coral species.",
      "They are proven to reverse ocean acidification.",
      "They help reduce CO2 emissions."
    ]
  }
};

async function readJson(fileName) {
  return JSON.parse(await readFile(path.join(GENERATED_DIR, fileName), "utf8"));
}

async function writeJson(fileName, value) {
  await writeFile(path.join(GENERATED_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

async function writeExamRootJson(fileName, value) {
  await writeFile(path.join(EXAM_FOLDER, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function optionId(questionId, label) {
  return `${questionId}-option-${label.toLowerCase()}`;
}

function stableAssetId(questionId, role) {
  const hash = crypto.createHash("sha256").update(`${questionId}:${role}`).digest("hex").slice(0, 8);
  return `${EXAM_ID}-${questionId}-${role}-${hash}`;
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function questionCropRegion(width, height) {
  const left = Math.floor(width * 0.50);
  const top = Math.floor(height * 0.16);
  return {
    x: left,
    y: top,
    width: Math.max(1, width - left - Math.floor(width * 0.02)),
    height: Math.max(1, Math.floor(height * 0.70))
  };
}

async function cropQuestionAsset(question, sourceAsset, assets) {
  const sourcePath = path.join(EXAM_FOLDER, sourceAsset.relativePath);
  const image = sharp(sourcePath);
  const metadata = await image.metadata();
  const width = metadata.width || question.config?.sourceRegion?.width || 1;
  const height = metadata.height || question.config?.sourceRegion?.height || 1;
  const crop = questionCropRegion(width, height);
  const fileName = `${question.id}-question.png`;
  const relativePath = path.join("generated", "derived-assets", "reading", fileName);
  const outputPath = path.join(EXAM_FOLDER, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const buffer = await sharp(sourcePath).extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height }).png().toBuffer();
  await writeFile(outputPath, buffer);
  const assetId = stableAssetId(question.id, "question");
  const record = {
    id: assetId,
    examId: EXAM_ID,
    type: "image",
    fileName,
    relativePath,
    mimeType: "image/png",
    metadata: {
      section: "reading",
      role: "question_image",
      derivedFrom: sourceAsset.id,
      questionId: question.id,
      questionNumber: question.number,
      detectedSection: "reading",
      detectedModule: question.moduleId === "reading-m2" ? 2 : 1,
      detectedQuestionStart: question.number,
      detectedQuestionEnd: question.number,
      cropRegion: { ...crop, sourceAssetId: sourceAsset.id, questionNumber: question.number },
      hash: hashBuffer(buffer)
    }
  };
  const index = assets.findIndex((asset) => asset.id === assetId);
  if (index >= 0) assets[index] = record;
  else assets.push(record);
  return { assetId, crop };
}

function updateStimulus(stimuli, question) {
  const existing = stimuli.find((stimulus) => stimulus.id === question.stimulusId);
  const next = {
    id: question.stimulusId,
    examPackId: "toefl",
    stimulusType: "reading_material",
    title: `${question.id} material`,
    assetIds: question.config?.imageAssetId ? [question.config.imageAssetId] : [],
    config: {
      ...(existing?.config || {}),
      readiness: question.config.readiness,
      questionId: question.id,
      questionNumber: question.number,
      readingQuestionSource: question.config.readingQuestionSource
    }
  };
  if (existing) Object.assign(existing, next);
  else stimuli.push(next);
}

function applyStructuredFixture(question, fixture) {
  const labels = ["A", "B", "C", "D"];
  const options = fixture.options.map((text, index) => ({
    id: optionId(question.id, labels[index]),
    label: labels[index],
    text
  }));
  const correctOptionId = optionId(question.id, fixture.answer);
  question.questionType = "toefl.reading_choice";
  question.rendererId = "toefl.renderer.choice";
  question.scoringStrategyId = "toefl.exact_single_choice";
  question.prompt = { type: "plain_text", text: fixture.prompt };
  question.config = {
    ...question.config,
    options,
    correctOptionId,
    importedAnswer: fixture.answer.toLowerCase(),
    readiness: "structured_ready",
    displayMode: "structured"
  };
  question.needsReview = false;
  question.status = "published";
  question.confidence = Math.max(question.confidence || 0, 0.9);
}

function applySourceQuestionFallback(question) {
  question.questionType = "toefl.reading_choice";
  question.rendererId = "toefl.renderer.choice";
  question.scoringStrategyId = "toefl.exact_single_choice";
  question.config = {
    ...question.config,
    options: [],
    correctOptionId: undefined,
    readiness: "source_question_ready",
    displayMode: "source_question_ready"
  };
  question.needsReview = true;
  question.status = "reviewed";
  question.confidence = Math.min(question.confidence || 0.55, 0.6);
}

async function main() {
  await mkdir(DERIVED_DIR, { recursive: true });
  const questions = await readJson("questions.json");
  const assets = await readJson("assets.json");
  const stimuli = await readJson("stimuli.json");
  const manifest = {
    examFolder: EXAM_FOLDER,
    generatedAt: new Date().toISOString(),
    reading: { module1: { questions: {} }, module2: { questions: {} } }
  };

  for (const question of questions) {
    const isReading = question.sectionId === "reading";
    const isChoiceRange = (question.moduleId === "reading-m1" && question.number >= 21 && question.number <= 35) ||
      (question.moduleId === "reading-m2" && question.number >= 11);
    if (!isReading || !isChoiceRange) continue;
    const sourceAssetId = question.config?.originalImageAssetId || question.config?.sourceAssetId || question.config?.imageAssetId;
    const sourceAsset = assets.find((asset) => asset.id === sourceAssetId);
    if (!sourceAsset) {
      question.config = { ...question.config, readiness: "missing_question_data", displayMode: "source_image_fallback" };
      question.needsReview = true;
      continue;
    }
    const { assetId: questionAssetId, crop: questionRegion } = await cropQuestionAsset(question, sourceAsset, assets);
    const materialAssetId = question.config?.imageAssetId;
    question.config = {
      ...question.config,
      questionImageAssetId: questionAssetId,
      readingQuestionSource: {
        materialAssetId,
        materialRegion: question.config?.sourceRegion,
        questionAssetId,
        questionRegion: { ...questionRegion, sourceAssetId, questionNumber: question.number },
        fullSourceAssetId: sourceAssetId,
        sourceQuestionNumber: question.number
      }
    };
    question.assetRefs = [
      ...(materialAssetId ? [{ assetId: materialAssetId, role: "stimulus", order: 1 }] : []),
      { assetId: questionAssetId, role: "question_image", order: 2 }
    ];
    const fixture = structuredFixtures[question.id];
    if (fixture) applyStructuredFixture(question, fixture);
    else applySourceQuestionFallback(question);
    updateStimulus(stimuli, question);

    const moduleKey = question.moduleId === "reading-m2" ? "module2" : "module1";
    manifest.reading[moduleKey].questions[String(question.number)] = {
      fullSourceAssetId: sourceAssetId,
      materialAssetId,
      questionAssetId,
      materialRegion: question.config.readingQuestionSource.materialRegion,
      questionRegion: question.config.readingQuestionSource.questionRegion,
      readiness: question.config.readiness,
      structured: Boolean(fixture)
    };
  }

  await writeJson("questions.json", questions);
  await writeJson("assets.json", assets);
  await writeJson("stimuli.json", stimuli);
  await writeJson("source-manifest.json", manifest);
  await writeExamRootJson("source-manifest.json", manifest);
  await writeJson("answer-key.json", Object.fromEntries(questions.map((question) => [question.id, question.config?.correctValues || question.config?.correctOptionId || question.config?.correctTokenOrder || question.config?.correctText || question.config?.importedAnswer || null])));

  const reading = questions.filter((question) => question.sectionId === "reading");
  const summary = reading.reduce((acc, question) => {
    const readiness = question.config?.readiness || (question.config?.options?.length ? "structured_ready" : "missing_question_data");
    acc[readiness] = (acc[readiness] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ updated: EXAM_FOLDER, summary }, null, 2));
}

await main();
