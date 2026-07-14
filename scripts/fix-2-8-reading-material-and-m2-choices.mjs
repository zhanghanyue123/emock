import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const EXAM_FOLDER = path.resolve("真题合集7-5/2.8新托福真题");
const GENERATED_DIR = path.join(EXAM_FOLDER, "generated");
const DERIVED_DIR = path.join(GENERATED_DIR, "derived-assets", "reading");
const EXAM_ID = "28-12326eea";
const SHARED_STIMULUS_ID = "reading-m2-approximation-theory";

const passage = {
  title: "Approximation Theory",
  sourceAssetId: "28-12326eea-2.8新托福真题阅读-image20-7b1e9812",
  originalAssetIds: ["28-12326eea-2.8新托福真题阅读-image20-7b1e9812"],
  paragraphs: [
    "Approximation theory is a part of mathematics that helps us simplify complex problems. Instead of working with difficult functions directly, scientists use simpler ones that are “close enough” to get useful results. These simplified functions are often used to build algorithms—step-by-step procedures that solve problems efficiently. This is especially helpful in fields like computer science, where exact calculations can take too much time or power.",
    "One common method is polynomial approximation, which uses basic math expressions (polynomials) to stand in for more complicated functions. A special type, called the Taylor series, breaks a function into an infinite sum based on its behavior at a single point. This helps us work with functions that are otherwise hard to handle.",
    "Another key tool is the Fourier series, which decomposes repeating patterns—like sound waves—into a mix of sine and cosine waves. This is widely used in signal processing; engineers use Fourier series to filter out noise and enhance data quality.",
    "While these methods are powerful, they are not perfect. Accuracy remains a challenge. The difference between the original and the simplified version—called the error—needs to be as small as possible. New techniques, like adaptive approximation, adjust the level of detail based on how accurate the result needs to be."
  ]
};

const questions = {
  "reading-m2-q11": {
    sourceImageNumber: 20,
    sourceQuestionNumber: 11,
    answer: "D",
    prompt: "According to the passage, simpler functions help scientists",
    options: [
      "achieve exact calculations",
      "avoid relying on algorithms",
      "tackle difficult functions more effectively over time",
      "develop steps for solving problems relatively quickly"
    ]
  },
  "reading-m2-q12": {
    sourceImageNumber: 21,
    sourceQuestionNumber: 12,
    answer: "D",
    prompt: "What is indicated about polynomial approximation in the passage?",
    options: [
      "It varies in behavior from one point to another.",
      "It is less accurate than the Fourier series.",
      "It cannot handle infinite sums of terms as well as the Taylor series can.",
      "It uses simple math expressions to make complex functions easier to work with."
    ]
  },
  "reading-m2-q13": {
    sourceImageNumber: 22,
    sourceQuestionNumber: 13,
    answer: "B",
    prompt: "The word “decomposes” in the passage is closest in meaning to",
    options: [
      "runs",
      "breaks down",
      "mixes",
      "enters"
    ]
  },
  "reading-m2-q14": {
    sourceImageNumber: 23,
    sourceQuestionNumber: 14,
    answer: "B",
    prompt: "What is one application of Fourier series mentioned in the passage?",
    options: [
      "Simplifying sine and cosine waves",
      "Removing unwanted noise from signals",
      "Compressing images",
      "Modeling heat distribution"
    ]
  },
  "reading-m2-q15": {
    sourceImageNumber: 24,
    sourceQuestionNumber: 15,
    answer: "A",
    prompt: "Why does the author mention “the error”?",
    options: [
      "To help illustrate the issue of accuracy as it relates to approximation theory",
      "To add another explanation of how polynomial approximation works",
      "To demonstrate an additional benefit of the Fourier series",
      "To suggest that new approximation techniques have so far been inadequate"
    ]
  }
};

async function readJson(fileName) {
  return JSON.parse(await readFile(path.join(GENERATED_DIR, fileName), "utf8"));
}

async function writeJson(fileName, value) {
  await writeFile(path.join(GENERATED_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function optionId(questionId, label) {
  return `${questionId}-option-${label.toLowerCase()}`;
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function questionRegion(width, height) {
  const x = Math.floor(width * 0.51);
  const y = Math.floor(height * 0.16);
  return {
    x,
    y,
    width: Math.max(1, width - x - Math.floor(width * 0.02)),
    height: Math.max(1, Math.floor(height * 0.70))
  };
}

async function cropQuestionAsset(sourceAsset, questionId, sourceQuestionNumber, assets) {
  const sourcePath = path.join(EXAM_FOLDER, sourceAsset.relativePath);
  const metadata = await sharp(sourcePath).metadata();
  const width = metadata.width || 1;
  const height = metadata.height || 1;
  const region = questionRegion(width, height);
  await mkdir(DERIVED_DIR, { recursive: true });
  const relativePath = path.join("generated", "derived-assets", "reading", `${questionId}-question.png`);
  const outputPath = path.join(EXAM_FOLDER, relativePath);
  const buffer = await sharp(sourcePath).extract({ left: region.x, top: region.y, width: region.width, height: region.height }).png().toBuffer();
  await writeFile(outputPath, buffer);
  const assetId = `${EXAM_ID}-${questionId}-question-${hashBuffer(Buffer.from(questionId)).slice(0, 8)}`;
  const record = {
    id: assetId,
    examId: EXAM_ID,
    type: "image",
    fileName: `${questionId}-question.png`,
    relativePath,
    mimeType: "image/png",
    metadata: {
      section: "reading",
      role: "question_image",
      derivedFrom: sourceAsset.id,
      questionId,
      questionNumber: sourceQuestionNumber,
      detectedSection: "reading",
      detectedModule: 2,
      detectedQuestionStart: sourceQuestionNumber,
      detectedQuestionEnd: sourceQuestionNumber,
      cropRegion: { ...region, sourceAssetId: sourceAsset.id, questionNumber: sourceQuestionNumber },
      hash: hashBuffer(buffer)
    }
  };
  const existingIndex = assets.findIndex((asset) => asset.id === assetId);
  if (existingIndex >= 0) assets[existingIndex] = record;
  else assets.push(record);
  return { assetId, region };
}

function setStimulus(stimuli) {
  const next = {
    id: SHARED_STIMULUS_ID,
    examPackId: "toefl",
    stimulusType: "toefl.reading_passage",
    title: passage.title,
    content: {
      type: "blocks",
      blocks: passage.paragraphs.map((text) => ({ type: "paragraph", text }))
    },
    assetIds: [],
    config: {
      materialType: "academic_passage",
      extractionStatus: "human_verified",
      extractionConfidence: 1,
      defaultDisplayMode: "structured_text",
      originalImageAvailable: true,
      originalAssetIds: passage.originalAssetIds,
      sourceAssetId: passage.sourceAssetId,
      sourceRegion: { x: 0, y: 120, width: 620, height: 900, sourceAssetId: passage.sourceAssetId },
      ocrProvenance: {
        sourceAssetId: passage.sourceAssetId,
        sourceRegion: { x: 0, y: 120, width: 620, height: 900, sourceAssetId: passage.sourceAssetId },
        rawResults: [{ engine: "manual_transcription", preprocessingProfile: "source_image_human_verified", text: passage.paragraphs.join("\n\n"), confidence: 1 }],
        normalizedText: passage.paragraphs.join("\n\n"),
        reviewedText: passage.paragraphs.join("\n\n"),
        uncertainSpans: [],
        status: "human_verified"
      },
      validation: {
        sourceAssetId: passage.sourceAssetId,
        lineCount: 24,
        paragraphCount: passage.paragraphs.length,
        uncertainSpanCount: 0,
        numericConflictCount: 0,
        suspectedMissingLines: false,
        suspectedMergedColumns: false,
        containsQuestionText: false,
        confidence: 1,
        readyForStructuredDisplay: true,
        warnings: []
      }
    }
  };
  const index = stimuli.findIndex((stimulus) => stimulus.id === SHARED_STIMULUS_ID);
  if (index >= 0) stimuli[index] = next;
  else stimuli.push(next);
}

const generatedQuestions = await readJson("questions.json");
const assets = await readJson("assets.json");
const stimuli = await readJson("stimuli.json");
const answerKey = await readJson("answer-key.json");
const materialAudit = {
  examId: EXAM_ID,
  generatedAt: new Date().toISOString(),
  materials: [],
  interactiveQuestions: []
};

setStimulus(stimuli);

for (const [questionId, fixture] of Object.entries(questions)) {
  const question = generatedQuestions.find((item) => item.id === questionId);
  if (!question) throw new Error(`Missing ${questionId}`);
  const sourceAsset = assets.find((asset) => asset.relativePath?.endsWith(`image${fixture.sourceImageNumber}.png`) && asset.metadata?.section === "reading");
  if (!sourceAsset) throw new Error(`Missing source asset image${fixture.sourceImageNumber}.png`);
  const { assetId: questionAssetId, region } = await cropQuestionAsset(sourceAsset, questionId, fixture.sourceQuestionNumber, assets);
  const options = fixture.options.map((text, index) => {
    const label = String.fromCharCode(65 + index);
    return { id: optionId(questionId, label), label, text };
  });
  const correctOptionId = optionId(questionId, fixture.answer);
  question.questionType = "toefl.reading_choice";
  question.rendererId = "toefl.reading_choice";
  question.scoringStrategyId = "toefl.exact_single_choice";
  question.stimulusId = SHARED_STIMULUS_ID;
  question.prompt = { type: "plain_text", text: fixture.prompt };
  question.assetIds = [];
  question.assetRefs = [
    { assetId: passage.sourceAssetId, role: "stimulus", order: 1 },
    { assetId: questionAssetId, role: "question_image", order: 2 }
  ];
  question.config = {
    ...question.config,
    selectionMode: "single",
    options,
    correctOptionId,
    importedAnswer: fixture.answer.toLowerCase(),
    questionImageAssetId: questionAssetId,
    sourceAssetId: sourceAsset.id,
    originalImageAssetId: sourceAsset.id,
    imageAssetId: undefined,
    displayMode: "structured",
    readiness: "structured_ready",
    materialDisplayMode: "structured_text",
    readingQuestionSource: {
      materialAssetId: passage.sourceAssetId,
      materialRegion: { x: 0, y: 120, width: 620, height: 900, sourceAssetId: sourceAsset.id, questionNumber: fixture.sourceQuestionNumber },
      questionAssetId,
      questionRegion: { ...region, sourceAssetId: sourceAsset.id, questionNumber: fixture.sourceQuestionNumber },
      fullSourceAssetId: sourceAsset.id,
      sourceQuestionNumber: fixture.sourceQuestionNumber
    }
  };
  delete question.config.imageAssetId;
  question.needsReview = false;
  question.status = "published";
  question.confidence = 0.95;
  answerKey[question.id] = correctOptionId;
  materialAudit.interactiveQuestions.push({
    questionId,
    questionNumber: question.number,
    detectedSourceQuestionNumber: fixture.sourceQuestionNumber,
    rendererId: question.rendererId,
    optionCount: options.length,
    hasQuestionImage: true,
    isInteractive: true,
    selectedOptionPersisted: "optionId",
    needsReview: false
  });
}

materialAudit.materials.push({
  id: SHARED_STIMULUS_ID,
  sourceAssetId: passage.sourceAssetId,
  materialType: "academic_passage",
  title: passage.title,
  paragraphCount: passage.paragraphs.length,
  characterCount: passage.paragraphs.join("\n\n").length,
  extractionStatus: "human_verified",
  extractionConfidence: 1,
  defaultDisplayMode: "structured_text",
  originalImageAvailable: true,
  containsQuestionText: false,
  warnings: []
});

await writeJson("questions.json", generatedQuestions);
await writeJson("assets.json", assets);
await writeJson("stimuli.json", stimuli);
await writeJson("answer-key.json", answerKey);
await writeJson("reading-material-audit.json", materialAudit);

console.log(JSON.stringify({
  material: materialAudit.materials[0],
  questions: materialAudit.interactiveQuestions
}, null, 2));
