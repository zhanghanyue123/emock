import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CONTENT_ROOT = path.join(ROOT, "真题合集7-5");
const onlyArgIndex = process.argv.findIndex((arg) => arg === "--only");
const onlyFolder = onlyArgIndex >= 0 ? process.argv[onlyArgIndex + 1] : "";

const PLACEHOLDER_PROMPTS = [
  /^Read the material and answer the question\.$/i,
  /^Read the academic passage and answer the question\.$/i,
  /^Choose the best answer\.$/i,
  /^Question \d+$/i,
  /^Listening question \d+$/i,
  /^Write your response here\.$/i,
  /^Options are still being extracted/i
];

const PLACEHOLDER_OPTIONS = [
  /^Option [A-D]$/i,
  /^[A-D]$/
];

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function promptText(question) {
  const prompt = question.prompt;
  if (typeof prompt === "string") return prompt.trim();
  if (prompt?.type === "plain_text") return String(prompt.text || "").trim();
  return "";
}

function optionList(question) {
  const options = Array.isArray(question.config?.options) ? question.config.options : Array.isArray(question.options) ? question.options : [];
  return options.filter(isRecord).map((option) => ({
    id: String(option.id || ""),
    text: String(option.text || "").trim()
  }));
}

function isPlaceholderPrompt(text) {
  return !text || PLACEHOLDER_PROMPTS.some((pattern) => pattern.test(text));
}

function hasPlaceholderOptions(options) {
  return options.some((option) => !option.text || PLACEHOLDER_OPTIONS.some((pattern) => pattern.test(option.text)));
}

function hasStructuredStimulus(question, stimuliById) {
  if (!question.stimulusId) return false;
  const stimulus = stimuliById.get(question.stimulusId);
  if (!stimulus) return false;
  const content = stimulus.content;
  if (content?.type === "plain_text" && String(content.text || "").trim()) return true;
  if (content?.type === "blocks" && Array.isArray(content.blocks)) {
    return content.blocks.some((block) => {
      if (block.type === "paragraph" || block.type === "heading" || block.type === "callout") return String(block.text || "").trim();
      if (block.type === "table") return Array.isArray(block.rows) && block.rows.length > 0;
      return false;
    });
  }
  return false;
}

function hasStimulusAsset(question, stimuliById) {
  const ids = new Set([...(Array.isArray(question.assetIds) ? question.assetIds : [])]);
  if (typeof question.config?.imageAssetId === "string") ids.add(question.config.imageAssetId);
  if (typeof question.config?.sourceAssetId === "string") ids.add(question.config.sourceAssetId);
  if (question.stimulusId) {
    const stimulus = stimuliById.get(question.stimulusId);
    for (const assetId of stimulus?.assetIds || []) ids.add(assetId);
  }
  return ids.size > 0;
}

function correctOptionId(question) {
  return typeof question.config?.correctOptionId === "string" ? question.config.correctOptionId : "";
}

function answerExists(question, answerKey) {
  if (correctOptionId(question)) return true;
  if (answerKey && Object.prototype.hasOwnProperty.call(answerKey, question.id)) return true;
  if (question.config?.correctValues && Object.keys(question.config.correctValues).length > 0) return true;
  if (Array.isArray(question.config?.correctTokenOrder) && question.config.correctTokenOrder.length > 0) return true;
  return question.scoringStrategyId === "toefl.manual_or_ai";
}

function sourceQuestionNumber(question) {
  const fromReading = question.config?.readingQuestionSource?.sourceQuestionNumber;
  const fromListening = question.config?.listeningQuestionSource?.sourceQuestionNumber;
  const fromWriting = question.config?.writingQuestionSource?.sourceQuestionNumber;
  const value = fromReading ?? fromListening ?? fromWriting ?? question.config?.sourceQuestionNumber;
  return typeof value === "number" ? value : undefined;
}

function baseRow(question, status, errors, warnings) {
  return {
    questionId: question.id,
    moduleId: question.moduleId,
    number: question.number,
    sourceQuestionNumber: sourceQuestionNumber(question),
    rendererId: question.rendererId,
    questionType: question.questionType,
    readiness: question.config?.readiness,
    needsReview: Boolean(question.needsReview),
    prompt: promptText(question),
    optionCount: optionList(question).length,
    answer: correctOptionId(question) || (question.config?.correctValues ? "complete_words" : question.config?.correctTokenOrder ? "build_sentence" : undefined),
    stimulusId: question.stimulusId,
    imageAssetId: question.config?.imageAssetId,
    questionImageAssetId: question.config?.questionImageAssetId,
    audioGroupId: question.config?.audioGroupId,
    status,
    errors,
    warnings
  };
}

function auditReadingQuestion(question, context) {
  const errors = [];
  const warnings = [];
  const text = promptText(question);
  const options = optionList(question);
  const isCompleteWords = question.questionType.includes("complete_words");
  const isChoice = question.questionType.includes("choice");
  const sourceFallback = question.config?.displayMode === "source_image_fallback" || question.config?.displayMode === "source_question_ready" || question.config?.readiness === "source_question_ready";

  if (isCompleteWords) {
    const blanks = Array.isArray(question.config?.blanks) ? question.config.blanks : [];
    if (!hasStructuredStimulus(question, context.stimuliById)) errors.push("missing_structured_complete_words_material");
    if (!blanks.length) errors.push("missing_complete_words_blanks");
    if (!question.config?.correctValues || Object.keys(question.config.correctValues).length === 0) errors.push("missing_complete_words_answers");
  } else if (isChoice) {
    if (!hasStructuredStimulus(question, context.stimuliById)) errors.push("missing_structured_reading_material");
    if (isPlaceholderPrompt(text)) errors.push("placeholder_or_missing_prompt");
    if (options.length < 2) errors.push("missing_options");
    if (hasPlaceholderOptions(options)) errors.push("placeholder_options");
    if (question.rendererId !== "toefl.reading_choice") errors.push("wrong_reading_renderer");
    if (!correctOptionId(question)) errors.push("missing_correct_option");
    if (correctOptionId(question) && !options.some((option) => option.id === correctOptionId(question))) errors.push("answer_option_not_found");
    if (sourceFallback) errors.push("source_image_fallback_marked_for_reading_choice");
  }

  const status = errors.length ? "needs_review" : "ready";
  return baseRow(question, status, errors, warnings);
}

function auditListeningQuestion(question, context) {
  const errors = [];
  const warnings = [];
  const text = promptText(question);
  const options = optionList(question);
  const audioGroupId = typeof question.config?.audioGroupId === "string" ? question.config.audioGroupId : "";
  const sourceNumber = sourceQuestionNumber(question);

  if (isPlaceholderPrompt(text)) errors.push("placeholder_or_missing_prompt");
  if (options.length < 2) errors.push("missing_options");
  if (hasPlaceholderOptions(options)) errors.push("placeholder_options");
  if (!correctOptionId(question)) errors.push("missing_correct_option");
  if (correctOptionId(question) && !options.some((option) => option.id === correctOptionId(question))) errors.push("answer_option_not_found");
  if (!hasStimulusAsset(question, context.stimuliById)) errors.push("missing_listening_stimulus");
  if (!audioGroupId || !context.audioGroupsById.has(audioGroupId)) errors.push("missing_listening_audio_segment");
  if (sourceNumber !== undefined && sourceNumber !== question.number) errors.push("ui_source_question_number_mismatch");
  if (!question.rendererId.includes("listening") && !question.rendererId.includes("choice")) errors.push("wrong_listening_renderer");

  const status = errors.length ? "needs_review" : "ready";
  return baseRow(question, status, errors, warnings);
}

function auditWritingQuestion(question, context) {
  const errors = [];
  const warnings = [];
  const text = promptText(question);
  const isBuildSentence = question.questionType.includes("build_sentence");
  const isLong = question.questionType.includes("write_email") || question.questionType.includes("academic_discussion");

  if (isPlaceholderPrompt(text)) errors.push("placeholder_or_missing_prompt");
  if (!hasStimulusAsset(question, context.stimuliById) && !hasStructuredStimulus(question, context.stimuliById)) errors.push("missing_writing_stimulus");
  if (isBuildSentence) {
    const tokens = Array.isArray(question.config?.tokens) ? question.config.tokens : [];
    if (!tokens.length) errors.push("missing_sentence_tokens");
    if (!Array.isArray(question.config?.correctTokenOrder) || !question.config.correctTokenOrder.length) errors.push("missing_sentence_answer");
  }
  if (isLong) {
    if (!text || /^(Write an Email|Academic Discussion)$/i.test(text)) errors.push("missing_long_writing_prompt");
    if (!hasStructuredStimulus(question, context.stimuliById)) errors.push("missing_structured_writing_material");
  }
  if (!isBuildSentence && !isLong) warnings.push("unclassified_writing_task");

  const status = errors.length ? "needs_review" : "ready";
  return baseRow(question, status, errors, warnings);
}

function countBy(rows, predicate) {
  return rows.filter(predicate).length;
}

async function auditGeneratedDir(generatedDir) {
  const exam = await readJson(path.join(generatedDir, "exam.json"), null);
  const questions = await readJson(path.join(generatedDir, "questions.json"), []);
  const stimuli = await readJson(path.join(generatedDir, "stimuli.json"), []);
  const audioGroups = await readJson(path.join(generatedDir, "audio-groups.json"), []);
  const answerKey = await readJson(path.join(generatedDir, "answer-key.json"), {});
  const stimuliById = new Map(stimuli.map((stimulus) => [stimulus.id, stimulus]));
  const audioGroupsById = new Map(audioGroups.map((group) => [group.id, group]));
  const context = { stimuliById, audioGroupsById, answerKey };

  const readingRows = [];
  const listeningRows = [];
  const writingRows = [];
  for (const question of questions) {
    if (question.sectionId === "reading") readingRows.push(auditReadingQuestion(question, context));
    if (question.sectionId === "listening") listeningRows.push(auditListeningQuestion(question, context));
    if (question.sectionId === "writing") writingRows.push(auditWritingQuestion(question, context));
  }

  const reading = {
    totalQuestions: readingRows.length,
    displayUnits: new Set(readingRows.map((row) => row.stimulusId || row.questionId)).size,
    structuredMaterials: countBy(readingRows, (row) => !row.errors.includes("missing_structured_reading_material") && !row.errors.includes("missing_structured_complete_words_material")),
    interactiveChoices: countBy(readingRows, (row) => row.rendererId === "toefl.reading_choice" && row.optionCount >= 2 && !row.errors.includes("missing_correct_option")),
    completeWordsGroups: new Set(readingRows.filter((row) => row.questionType.includes("complete_words")).map((row) => row.stimulusId || row.questionId)).size,
    needsReview: countBy(readingRows, (row) => row.status !== "ready"),
    missingPrompt: countBy(readingRows, (row) => row.errors.includes("placeholder_or_missing_prompt")),
    missingOptions: countBy(readingRows, (row) => row.errors.includes("missing_options")),
    rows: readingRows
  };
  const listening = {
    totalQuestions: listeningRows.length,
    correctImageMappings: countBy(listeningRows, (row) => !row.errors.includes("missing_listening_stimulus") && !row.errors.includes("ui_source_question_number_mismatch")),
    realPrompts: countBy(listeningRows, (row) => !row.errors.includes("placeholder_or_missing_prompt")),
    realOptions: countBy(listeningRows, (row) => row.optionCount >= 2 && !row.errors.includes("placeholder_options")),
    audioSegments: countBy(listeningRows, (row) => !row.errors.includes("missing_listening_audio_segment")),
    imageMismatches: countBy(listeningRows, (row) => row.errors.includes("ui_source_question_number_mismatch")),
    needsReview: countBy(listeningRows, (row) => row.status !== "ready"),
    rows: listeningRows
  };
  const writing = {
    totalQuestions: writingRows.length,
    completeSentenceTasks: countBy(writingRows, (row) => row.questionType.includes("build_sentence") && row.status === "ready"),
    completeLongResponseTasks: countBy(writingRows, (row) => (row.questionType.includes("write_email") || row.questionType.includes("academic_discussion")) && row.status === "ready"),
    missingPrompts: countBy(writingRows, (row) => row.errors.includes("placeholder_or_missing_prompt") || row.errors.includes("missing_long_writing_prompt")),
    missingStimuli: countBy(writingRows, (row) => row.errors.includes("missing_writing_stimulus")),
    missingTokens: countBy(writingRows, (row) => row.errors.includes("missing_sentence_tokens")),
    needsReview: countBy(writingRows, (row) => row.status !== "ready"),
    rows: writingRows
  };

  const publishable = reading.needsReview === 0 && listening.needsReview === 0 && writing.needsReview === 0 && reading.totalQuestions > 0 && listening.totalQuestions > 0 && writing.totalQuestions > 0;
  return {
    examId: exam?.id || path.basename(path.dirname(generatedDir)),
    title: exam?.title || path.basename(path.dirname(generatedDir)),
    generatedAt: new Date().toISOString(),
    publishable,
    reading,
    listening,
    writing
  };
}

async function main() {
  const folders = (await readdir(CONTENT_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((name) => !onlyFolder || name === onlyFolder)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  const reports = [];
  for (const folder of folders) {
    const generatedDir = path.join(CONTENT_ROOT, folder, "generated");
    const questionsPath = path.join(generatedDir, "questions.json");
    try {
      await readFile(questionsPath, "utf8");
    } catch {
      continue;
    }
    const report = await auditGeneratedDir(generatedDir);
    await writeFile(path.join(generatedDir, "content-integrity-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    reports.push({
      examId: report.examId,
      title: report.title,
      publishable: report.publishable,
      reading: {
        totalQuestions: report.reading.totalQuestions,
        structuredMaterials: report.reading.structuredMaterials,
        interactiveChoices: report.reading.interactiveChoices,
        completeWordsGroups: report.reading.completeWordsGroups,
        needsReview: report.reading.needsReview,
        missingPrompt: report.reading.missingPrompt,
        missingOptions: report.reading.missingOptions
      },
      listening: {
        totalQuestions: report.listening.totalQuestions,
        correctImageMappings: report.listening.correctImageMappings,
        realPrompts: report.listening.realPrompts,
        realOptions: report.listening.realOptions,
        audioSegments: report.listening.audioSegments,
        imageMismatches: report.listening.imageMismatches,
        needsReview: report.listening.needsReview
      },
      writing: {
        totalQuestions: report.writing.totalQuestions,
        completeSentenceTasks: report.writing.completeSentenceTasks,
        completeLongResponseTasks: report.writing.completeLongResponseTasks,
        missingPrompts: report.writing.missingPrompts,
        missingStimuli: report.writing.missingStimuli,
        missingTokens: report.writing.missingTokens,
        needsReview: report.writing.needsReview
      }
    });
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    totalExams: reports.length,
    publishableExams: reports.filter((report) => report.publishable).length,
    hiddenExams: reports.filter((report) => !report.publishable).length,
    reports
  };
  if (!onlyFolder) {
    await writeFile(path.join(CONTENT_ROOT, "content-integrity-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  }
  console.table(reports.map((report) => ({
    exam: report.title,
    publishable: report.publishable,
    readingReview: report.reading.needsReview,
    listeningReview: report.listening.needsReview,
    writingReview: report.writing.needsReview
  })));
  console.log(JSON.stringify({ totalExams: summary.totalExams, publishableExams: summary.publishableExams, hiddenExams: summary.hiddenExams }, null, 2));
}

await main();
