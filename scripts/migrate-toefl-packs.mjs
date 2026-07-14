import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_ROOT = path.join(process.cwd(), "真题合集7-5");
const args = process.argv.slice(2);

function argValue(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

function hasArg(name) {
  return args.includes(name);
}

const options = {
  root: argValue("--root", DEFAULT_ROOT),
  reference: argValue("--reference", "3.2新托福真题B卷"),
  profile: argValue("--profile", "toefl-2026-3.2b-final"),
  only: argValue("--only", ""),
  exclude: new Set(args.flatMap((arg, index) => arg === "--exclude" ? [args[index + 1]] : []).filter(Boolean)),
  dryRun: hasArg("--dry-run"),
  resume: hasArg("--resume"),
  updateReference: hasArg("--update-reference"),
  rebuildSections: args.flatMap((arg, index) => arg === "--rebuild-section" ? [args[index + 1]] : []).filter(Boolean)
};

const CANONICAL_REFERENCE_ERROR = "canonical_reference_locked";

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function promptText(question) {
  const prompt = question.prompt;
  if (typeof prompt === "string") return prompt.trim();
  if (prompt?.type === "plain_text") return String(prompt.text || "").trim();
  return "";
}

function optionsFor(question) {
  const options = Array.isArray(question.config?.options) ? question.config.options : [];
  return options.filter(isRecord);
}

function isPlaceholderPrompt(text) {
  return !text ||
    /^(Read the material and answer the question\.|Read the academic passage and answer the question\.|Choose the best answer\.|Question \d+|Listening question \d+|Write your response here\.)$/i.test(text) ||
    /^Options are still being extracted/i.test(text);
}

function hasPlaceholderOptions(options) {
  return options.some((option) => !String(option.text || "").trim() || /^Option [A-D]$/i.test(String(option.text || "").trim()) || /^[A-D]$/.test(String(option.text || "").trim()));
}

function contentBlocks(stimulus) {
  return stimulus?.content?.type === "blocks" && Array.isArray(stimulus.content.blocks) ? stimulus.content.blocks : [];
}

function hasStructuredStimulus(question, stimuliById) {
  const stimulus = stimuliById.get(question.stimulusId);
  if (!stimulus) return false;
  if (stimulus.content?.type === "plain_text") return Boolean(String(stimulus.content.text || "").trim());
  return contentBlocks(stimulus).some((block) => {
    if (block.type === "paragraph" || block.type === "heading" || block.type === "callout") return Boolean(String(block.text || "").trim());
    if (block.type === "table") return Array.isArray(block.rows) && block.rows.length > 0;
    return false;
  });
}

function sectionCounts(questions) {
  return ["reading", "listening", "writing", "speaking"].reduce((acc, section) => {
    acc[section] = questions.filter((question) => question.sectionId === section).length;
    return acc;
  }, {});
}

function displayUnitCount(questions) {
  const units = [];
  for (const section of ["reading", "listening", "writing", "speaking"]) {
    const list = questions.filter((question) => question.sectionId === section);
    for (let index = 0; index < list.length; index += 1) {
      const question = list[index];
      if (question.questionType?.includes("complete_words")) {
        let cursor = index + 1;
        while (cursor < list.length && list[cursor].questionType?.includes("complete_words") && list[cursor].moduleId === question.moduleId && list[cursor].stimulusId === question.stimulusId && list[cursor].number === list[cursor - 1].number + 1) cursor += 1;
        units.push(`${section}:${question.moduleId}:${question.stimulusId}:${question.number}-${list[cursor - 1].number}`);
        index = cursor - 1;
      } else {
        units.push(question.id);
      }
    }
  }
  return units.length;
}

function rendererCounts(questions) {
  return questions.reduce((acc, question) => {
    const key = question.rendererId || "missing";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function structuredTemplateFor(stimulus) {
  const materialType = stimulus.config?.materialType;
  if (stimulus.id?.includes("complete-words")) return "complete_words";
  if (materialType === "email") return "email";
  if (materialType === "notice") return "notice";
  if (materialType === "form") return "table";
  if (materialType === "academic_passage") return "academic_passage";
  return materialType || "plain_passage";
}

function migrateQuestion(question, { canonical }) {
  const errors = [];
  const warnings = [];
  const section = question.sectionId;
  const qtype = question.questionType || "";
  const prompt = promptText(question);
  const options = optionsFor(question);

  question.config = question.config || {};
  if (section === "reading") {
    question.config.displayMode = "structured";
    delete question.config.readingVisualLayout;
    if (qtype.includes("complete_words")) {
      question.rendererId = "toefl.renderer.complete_words";
    } else if (qtype.includes("choice")) {
      question.rendererId = "toefl.reading_choice";
    }
  }
  if (section === "listening") {
    if (qtype.includes("choice") || qtype.includes("listen_choose_response")) question.rendererId = "toefl.listening_choice";
    question.config.displayMode = "structured";
  }
  if (section === "writing") {
    if (qtype.includes("build_sentence")) {
      question.rendererId = "toefl.writing.build_sentence_inline";
      question.config.displayMode = "structured";
      question.config.inlineInteraction = true;
      question.config.visualRestoration = "structured_dom";
      delete question.config.visualLayout;
    }
    if (qtype.includes("write_email") || qtype.includes("academic_discussion")) {
      question.config.displayMode = "structured";
    }
  }
  if (section === "speaking") {
    question.rendererId = "toefl.renderer.recording";
    question.config.displayMode = "structured";
    if (qtype.includes("listen_repeat")) {
      question.config.speakingImageDisplay = { fit: "center_crop", scale: 1.18, objectPosition: "50% 50%", translateY: "-18%" };
    } else if (qtype.includes("interview_response")) {
      question.config.speakingImageDisplay = { fit: "contain", scale: 1, objectPosition: "50% 50%", translateY: "0%" };
    }
  }

  if ((section === "reading" || section === "listening") && qtype.includes("choice")) {
    if (isPlaceholderPrompt(prompt)) errors.push("placeholder_or_missing_prompt");
    if (options.length < 2) errors.push("missing_options");
    if (hasPlaceholderOptions(options)) errors.push("placeholder_options");
    if (!question.config.correctOptionId) errors.push("missing_correct_option");
  }
  if (section === "writing" && qtype.includes("build_sentence")) {
    if (!Array.isArray(question.config.tokens) || !question.config.tokens.length) errors.push("missing_sentence_tokens");
    if (!Array.isArray(question.config.correctTokenOrder) || !question.config.correctTokenOrder.length) errors.push("missing_sentence_answer");
    if (question.config.visualLayout) errors.push("build_sentence_visual_overlay_present");
  }
  if (canonical) errors.push(CANONICAL_REFERENCE_ERROR);
  if (errors.length) question.needsReview = true;
  return { questionId: question.id, section, number: question.number, rendererId: question.rendererId, errors, warnings };
}

function migrateStimuli(stimuli) {
  for (const stimulus of stimuli) {
    if (!stimulus.id?.startsWith("reading-")) continue;
    stimulus.config = {
      ...(stimulus.config || {}),
      defaultDisplayMode: "structured_text",
      visualRestoration: "structured_dom",
      structuredTemplate: stimulus.config?.structuredTemplate || structuredTemplateFor(stimulus)
    };
  }
}

function conformanceReport({ folder, exam, questions, stimuli, audioGroups, taskGroups, rows, profile, referenceFolder }) {
  const stimuliById = new Map(stimuli.map((stimulus) => [stimulus.id, stimulus]));
  const choiceQuestions = questions.filter((question) => question.questionType?.includes("choice") || question.questionType?.includes("listen_choose_response"));
  const sourceImageFallback = questions.filter((question) => question.config?.displayMode === "source_image_fallback" || question.config?.displayMode === "source_question_ready").length;
  const placeholderQuestions = questions.filter((question) => isPlaceholderPrompt(promptText(question))).length + choiceQuestions.filter((question) => hasPlaceholderOptions(optionsFor(question))).length;
  const answerMatchCount = questions.filter((question) => question.config?.correctOptionId || question.config?.correctValues || Array.isArray(question.config?.correctTokenOrder) || question.scoringStrategyId === "toefl.manual_or_ai").length;
  const speaking = questions.filter((question) => question.sectionId === "speaking");
  const conformanceErrors = rows.flatMap((row) => row.errors.map((error) => ({ questionId: row.questionId, error })));
  const sectionCountMap = sectionCounts(questions);
  return {
    examId: exam?.id || folder,
    title: exam?.title || folder,
    sourceFolder: folder,
    referenceFolder,
    profile,
    generatedAt: new Date().toISOString(),
    publicationStatus: conformanceErrors.length ? "needs_review" : "ready",
    sectionCounts: sectionCountMap,
    displayUnitCount: displayUnitCount(questions),
    rendererCounts: rendererCounts(questions),
    structuredStimulusCounts: {
      total: stimuli.filter((stimulus) => contentBlocks(stimulus).length || stimulus.content?.type === "plain_text").length,
      reading: questions.filter((question) => question.sectionId === "reading" && hasStructuredStimulus(question, stimuliById)).length
    },
    realOptionCounts: choiceQuestions.filter((question) => optionsFor(question).length >= 2 && !hasPlaceholderOptions(optionsFor(question))).length,
    answerMatchCounts: answerMatchCount,
    audioSegmentCounts: audioGroups.length,
    speakingRecordingCounts: speaking.length,
    aiScoringReadiness: {
      writing: questions.filter((question) => question.sectionId === "writing" && (question.questionType?.includes("write_email") || question.questionType?.includes("academic_discussion")) && !question.needsReview).length,
      speaking: speaking.filter((question) => !question.needsReview).length
    },
    sourceImageFallbackCounts: sourceImageFallback,
    placeholderCounts: placeholderQuestions,
    missingQuestionCounts: {
      reading: sectionCountMap.reading === 0 ? 1 : 0,
      listening: sectionCountMap.listening === 0 ? 1 : 0,
      writing: sectionCountMap.writing === 0 ? 1 : 0,
      speaking: sectionCountMap.speaking === 0 ? 1 : 0
    },
    needsReviewCounts: {
      total: questions.filter((question) => question.needsReview).length,
      reading: questions.filter((question) => question.sectionId === "reading" && question.needsReview).length,
      listening: questions.filter((question) => question.sectionId === "listening" && question.needsReview).length,
      writing: questions.filter((question) => question.sectionId === "writing" && question.needsReview).length,
      speaking: questions.filter((question) => question.sectionId === "speaking" && question.needsReview).length
    },
    speakingTaskGroups: taskGroups.length,
    conformanceErrors,
    rows
  };
}

async function backupGenerated(generatedDir, profile) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(generatedDir, `.backup-${profile}-${stamp}`);
  await mkdir(backupDir, { recursive: true });
  for (const file of ["exam.json", "test.json", "questions.json", "stimuli.json", "audio-groups.json", "speaking-task-groups.json"]) {
    const source = path.join(generatedDir, file);
    try {
      await cp(source, path.join(backupDir, file));
    } catch {
      // Optional generated files are skipped.
    }
  }
  return backupDir;
}

async function writeArtifact(folder, report) {
  const dir = path.join(process.cwd(), "artifacts", "toefl-pack-conformance", report.examId);
  await mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, "conformance-summary.json"), {
    examId: report.examId,
    title: report.title,
    profile: report.profile,
    sourceFolder: folder,
    sectionCounts: report.sectionCounts,
    rendererCounts: report.rendererCounts,
    needsReviewCounts: report.needsReviewCounts,
    sourceImageFallbackCounts: report.sourceImageFallbackCounts,
    placeholderCounts: report.placeholderCounts
  });
  await writeJson(path.join(dir, "visual-checklist.json"), {
    examId: report.examId,
    profile: report.profile,
    sourceFolder: folder,
    canonicalReference: "3.2新托福真题B卷",
    expectedLayout: {
      reading: "structured material on the left, interactive prompt and options on the right; Complete the Words remains grouped",
      listening: "centered contain image, interactive choice renderer, audio segment card",
      writing: "structured Build a Sentence card or long-writing prompt/editor; no screenshot overlay",
      speaking: "stable image panel with configured scale and vertical focus; recording controls on the right"
    },
    checkpoints: [
      "Reading Complete the Words grouping",
      "Reading choice material and options are separated",
      "Listening image is centered and complete",
      "Writing Build a Sentence uses structured DOM",
      "Speaking listen-repeat images use center crop with translateY -18%",
      "Review page uses the same canonical component mapping"
    ],
    blockingCounts: {
      needsReview: report.needsReviewCounts,
      sourceImageFallback: report.sourceImageFallbackCounts,
      placeholders: report.placeholderCounts
    }
  });
}

async function migrateFolder(folder) {
  const generatedDir = path.join(options.root, folder, "generated");
  const questionsPath = path.join(generatedDir, "questions.json");
  try {
    await stat(questionsPath);
  } catch {
    return { folder, skipped: true, reason: "missing_generated_questions" };
  }
  const isReference = folder === options.reference;
  if (isReference && !options.updateReference) {
    return { folder, skipped: true, reason: "canonical_reference_locked" };
  }

  const exam = await readJson(path.join(generatedDir, "exam.json"), {});
  const test = await readJson(path.join(generatedDir, "test.json"), null);
  const questions = await readJson(questionsPath, []);
  const stimuli = await readJson(path.join(generatedDir, "stimuli.json"), []);
  const audioGroups = await readJson(path.join(generatedDir, "audio-groups.json"), []);
  const taskGroups = await readJson(path.join(generatedDir, "speaking-task-groups.json"), []);

  if (!options.dryRun) await backupGenerated(generatedDir, options.profile);

  const rows = [];
  migrateStimuli(stimuli);
  for (const question of questions) rows.push(migrateQuestion(question, { canonical: false }));

  const report = conformanceReport({ folder, exam, questions, stimuli, audioGroups, taskGroups, rows, profile: options.profile, referenceFolder: options.reference });
  const migrationReport = {
    examId: report.examId,
    sourceFolder: folder,
    profile: options.profile,
    referenceFolder: options.reference,
    dryRun: options.dryRun,
    resume: options.resume,
    rebuildSections: options.rebuildSections,
    generatedAt: new Date().toISOString(),
    changedFiles: options.dryRun ? [] : ["questions.json", "stimuli.json", "exam.json", "test.json", "conformance-report.json"],
    conformanceStatus: report.conformanceErrors.length ? "needs_review" : "ready",
    conformanceErrorCount: report.conformanceErrors.length
  };

  if (!options.dryRun) {
    exam.config = { ...(exam.config || {}), formatProfile: options.profile, canonicalReference: false, conformanceStatus: migrationReport.conformanceStatus, publicationStatus: migrationReport.conformanceStatus === "ready" ? "ready" : "needs_review" };
    if (test) test.config = { ...(test.config || {}), formatProfile: options.profile, canonicalReference: false, conformanceStatus: migrationReport.conformanceStatus };
    await writeJson(path.join(generatedDir, "exam.json"), exam);
    if (test) await writeJson(path.join(generatedDir, "test.json"), test);
    await writeJson(questionsPath, questions);
    await writeJson(path.join(generatedDir, "stimuli.json"), stimuli);
    await writeJson(path.join(generatedDir, "migration-report.json"), migrationReport);
    await writeJson(path.join(generatedDir, "conformance-report.json"), report);
    await writeArtifact(folder, report);
  }
  return {
    folder,
    examId: report.examId,
    status: migrationReport.conformanceStatus,
    sectionCounts: report.sectionCounts,
    realOptions: report.realOptionCounts,
    answers: report.answerMatchCounts,
    audioSegments: report.audioSegmentCounts,
    speakingRecordings: report.speakingRecordingCounts,
    needsReview: report.needsReviewCounts.total,
    sourceFallback: report.sourceImageFallbackCounts,
    placeholders: report.placeholderCounts,
    errors: report.conformanceErrors.length
  };
}

async function main() {
  const entries = await readdir(options.root, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((folder) => !options.only || folder === options.only)
    .filter((folder) => !options.exclude.has(folder))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  const results = [];
  for (const folder of folders) {
    const result = await migrateFolder(folder);
    results.push(result);
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    profile: options.profile,
    root: options.root,
    reference: options.reference,
    dryRun: options.dryRun,
    totalFolders: folders.length,
    migrated: results.filter((result) => result.status).length,
    ready: results.filter((result) => result.status === "ready").length,
    needsReview: results.filter((result) => result.status === "needs_review").length,
    skipped: results.filter((result) => result.skipped).length,
    results
  };
  await mkdir(path.join(process.cwd(), "artifacts", "toefl-pack-conformance"), { recursive: true });
  const summaryName = options.dryRun ? "dry-run-summary.json" : "migration-summary.json";
  await writeJson(path.join(process.cwd(), "artifacts", "toefl-pack-conformance", summaryName), summary);
  console.table(results.map((result) => ({
    folder: result.folder,
    status: result.status || `skipped:${result.reason}`,
    reading: result.sectionCounts?.reading ?? "",
    listening: result.sectionCounts?.listening ?? "",
    writing: result.sectionCounts?.writing ?? "",
    speaking: result.sectionCounts?.speaking ?? "",
    needsReview: result.needsReview ?? "",
    errors: result.errors ?? ""
  })));
  console.log(JSON.stringify({
    totalFolders: summary.totalFolders,
    migrated: summary.migrated,
    ready: summary.ready,
    needsReview: summary.needsReview,
    skipped: summary.skipped,
    dryRun: summary.dryRun
  }, null, 2));
}

await main();
