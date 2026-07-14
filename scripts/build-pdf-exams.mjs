import crypto from "node:crypto";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";

const SECTION_KEYS = ["reading", "listening", "writing", "speaking"];
const SECTION_TITLES = { reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking" };
const SECTION_TYPE = { reading: "toefl.reading", listening: "toefl.listening", writing: "toefl.writing", speaking: "toefl.speaking" };
const DURATION = { reading: 1200, listening: 2160, writing: 1740, speaking: 960 };
const ROOT = path.resolve(process.argv.includes("--root") ? process.argv[process.argv.indexOf("--root") + 1] : "真题合集7-5");
const SOURCE = process.argv.includes("--source") ? path.resolve(process.argv[process.argv.indexOf("--source") + 1]) : "";
const FORCE = process.argv.includes("--force");
const POPPLER = "/Users/hanyue/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin";
const PYTHON = "/Users/hanyue/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const RENDER_DPI = "96";

function slug(value) {
  const ascii = value.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().toLowerCase().replace(/\s+/g, "-").replace(/_+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const hash = crypto.createHash("sha1").update(value).digest("hex").slice(0, 8);
  return ascii ? `${ascii}-${hash}` : `exam-${hash}`;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "generated") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath, base));
    else {
      const info = await stat(fullPath);
      files.push({ fullPath, relativePath: path.relative(base, fullPath).split(path.sep).join("/"), name: entry.name, ext: path.extname(entry.name).toLowerCase(), size: info.size });
    }
  }
  return files;
}

function sectionForName(name) {
  if (/阅读|reading/i.test(name)) return "reading";
  if (/听力|listening/i.test(name)) return "listening";
  if (/写作|writing/i.test(name)) return "writing";
  if (/口语|speaking/i.test(name)) return "speaking";
  return null;
}

function roleFor(file) {
  const name = file.name.toLowerCase();
  if (name.includes("答案") || name.includes("answer") || name.includes("参考")) return "answer";
  if ([".mp3", ".m4a", ".wav", ".mp4"].includes(file.ext)) return "audio";
  if (file.ext === ".zip" && sectionForName(file.name)) return "audio_archive";
  if (file.ext === ".pdf") return "pdf";
  return "other";
}

function mimeFor(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".m4a" || ext === ".mp4") return "audio/mp4";
  if (ext === ".wav") return "audio/wav";
  return "application/octet-stream";
}

function pdfText(filePath) {
  const script = "import pdfplumber,sys,json\np=sys.argv[1]\nwith pdfplumber.open(p) as pdf:\n print(json.dumps('\\n'.join((page.extract_text(x_tolerance=1,y_tolerance=3) or '') for page in pdf.pages)))";
  const result = spawnSync(PYTHON, ["-c", script, filePath], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
  if (result.status !== 0) return "";
  return JSON.parse(result.stdout || "\"\"");
}

function parseAnswerSections(text) {
  const sections = {};
  const markers = [
    ["reading", /(?:阅读|Reading(?:,\s*Module1)?)/i],
    ["listening", /(?:听力|Listening\s*module1|Listening)/i],
    ["writing", /(?:写作|Writing)/i],
    ["speaking", /(?:口语|Speaking)/i]
  ];
  const hits = markers.map(([key, rx]) => ({ key, index: text.search(rx) })).filter((item) => item.index >= 0).sort((a, b) => a.index - b.index);
  for (let index = 0; index < hits.length; index += 1) {
    sections[hits[index].key] = text.slice(hits[index].index, hits[index + 1]?.index ?? text.length);
  }
  const pairs = (value = "") => {
    const map = new Map();
    for (const match of String(value).matchAll(/(?:^|\s)(\d{1,2})[.、\s]*([A-Za-z]+)/g)) {
      const number = Number(match[1]);
      if (!map.has(number)) map.set(number, match[2]);
    }
    return map;
  };
  const splitExtra = (value = "") => String(value).split(/加试|Module2\s*:/i);
  const reading = splitExtra(sections.reading || "");
  const listening = splitExtra(sections.listening || "");
  const writingLines = String(sections.writing || "").split(/\r?\n/).map((line) => line.trim()).filter((line) => /^\d+[.)、\s]/.test(line));
  const speakingLines = String(sections.speaking || "").split(/\r?\n/).map((line) => line.trim()).filter((line) => /^\d+[.)、\s]/.test(line));
  return {
    reading: pairs(reading[0]),
    readingExtra: pairs(reading[1] || ""),
    listening: pairs(listening[0]),
    listeningExtra: pairs(listening[1] || ""),
    writingLines,
    speakingLines
  };
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function renderPdfPages(pdf, section, generatedDir, examId) {
  const outputDir = path.join(generatedDir, "pdf-pages", section);
  if (await exists(outputDir)) {
    const existing = (await readdir(outputDir))
      .filter((name) => /^page-\d+\.png$/.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (existing.length) {
      return existing.map((fileName, index) => ({
        id: `${examId}-${section}-page-${index + 1}`,
        examId,
        type: "image",
        fileName,
        relativePath: path.relative(path.dirname(generatedDir), path.join(outputDir, fileName)).split(path.sep).join("/"),
        mimeType: "image/png",
        metadata: { section, page: index + 1, sourcePdf: pdf.relativePath, role: "source_page" }
      }));
    }
  }
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const prefix = path.join(outputDir, "page");
  const cacheDir = path.join(generatedDir, ".cache");
  await mkdir(cacheDir, { recursive: true });
  execFileSync(path.join(POPPLER, "pdftoppm"), ["-png", "-r", RENDER_DPI, pdf.fullPath, prefix], {
    env: { ...process.env, XDG_CACHE_HOME: cacheDir },
    maxBuffer: 200 * 1024 * 1024,
    stdio: ["ignore", "ignore", "ignore"]
  });
  const rendered = (await readdir(outputDir))
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return rendered.map((fileName, index) => ({
    id: `${examId}-${section}-page-${index + 1}`,
    examId,
    type: "image",
    fileName,
    relativePath: path.relative(path.dirname(generatedDir), path.join(outputDir, fileName)).split(path.sep).join("/"),
    mimeType: "image/png",
    metadata: { section, page: index + 1, sourcePdf: pdf.relativePath, role: "source_page" }
  }));
}

async function extractAudioZip(file, section, generatedDir, examId) {
  const tempDir = path.join(generatedDir, ".tmp-audio", slug(file.relativePath));
  const outDir = path.join(generatedDir, "source-audio", section);
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });
  execFileSync("unzip", ["-qq", "-o", file.fullPath, "-d", tempDir], { maxBuffer: 200 * 1024 * 1024 });
  const items = (await walk(tempDir, tempDir)).filter((item) => [".mp3", ".m4a", ".wav"].includes(item.ext));
  const assets = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    await mkdir(outDir, { recursive: true });
    const fileName = item.name.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    const target = path.join(outDir, fileName);
    await cp(item.fullPath, target);
    assets.push({
      id: `${examId}-${section}-audio-${index + 1}`,
      examId,
      type: "audio",
      fileName,
      relativePath: path.relative(path.dirname(generatedDir), target).split(path.sep).join("/"),
      mimeType: mimeFor(fileName),
      metadata: { section, sourceZip: file.relativePath, order: index + 1 }
    });
  }
  await rm(tempDir, { recursive: true, force: true });
  return assets;
}

async function collectAudioAssets(files, generatedDir, examId) {
  const assets = [];
  for (const section of ["listening", "speaking"]) {
    const direct = files.filter((file) => file.role === "audio" && sectionForName(file.relativePath) === section);
    for (let index = 0; index < direct.length; index += 1) {
      assets.push({
        id: `${examId}-${section}-audio-${assets.length + 1}`,
        examId,
        type: "audio",
        fileName: direct[index].name,
        relativePath: direct[index].relativePath,
        mimeType: mimeFor(direct[index].name),
        metadata: { section, order: index + 1, sourceFile: direct[index].relativePath }
      });
    }
    const archives = files.filter((file) => file.role === "audio_archive" && sectionForName(file.relativePath) === section);
    for (const archive of archives) assets.push(...await extractAudioZip(archive, section, generatedDir, examId));
  }
  return assets;
}

function optionId(questionId, label) {
  return `${questionId}-option-${label.toLowerCase()}`;
}

function pageFor(assets, index) {
  if (!assets.length) return undefined;
  return assets[Math.min(assets.length - 1, Math.max(0, index))];
}

function makeQuestion({ id, section, moduleId, number, type, renderer, scoring, prompt, pageAsset, answer, config = {}, confidence = 0.42, needsReview = true }) {
  const label = /^[A-D]$/i.test(String(answer || "")) ? String(answer).toUpperCase() : "";
  const explicitOptions = Array.isArray(config.options) ? config.options : [];
  const matchingOption = explicitOptions.find((option) => option.id === optionId(id, label) || option.id === label);
  return {
    id,
    examPackId: "toefl",
    sectionId: section,
    moduleId,
    number,
    questionType: type,
    rendererId: renderer,
    scoringStrategyId: scoring,
    stimulusId: pageAsset ? `${id}-stimulus` : undefined,
    assetIds: pageAsset ? [pageAsset.id] : [],
    prompt: { type: "plain_text", text: prompt },
    config: {
      selectionMode: "single",
      options: explicitOptions,
      correctOptionId: matchingOption?.id,
      correctValues: !label && answer ? { [`${id}-blank`]: answer } : undefined,
      importedAnswer: answer || undefined,
      imageAssetId: pageAsset?.id,
      sourceAssetId: pageAsset?.id,
      sourcePage: pageAsset?.metadata?.page,
      displayMode: "source_image_fallback",
      ...config,
      options: explicitOptions
    },
    source: { file: pageAsset?.metadata?.sourcePdf || "", page: pageAsset?.metadata?.page, confidence },
    status: needsReview ? "reviewed" : "published",
    confidence,
    needsReview
  };
}

function makeAudioSegments(section, audioAsset, questions) {
  if (!audioAsset) return [];
  return questions.map((question, index) => ({
    id: `${section}-segment-${index + 1}`,
    assetId: audioAsset.id,
    startSeconds: 0,
    endSeconds: undefined,
    sectionId: section,
    moduleId: question.moduleId,
    stimulusId: question.stimulusId,
    questionIds: [question.id],
    segmentType: section === "speaking" ? "prompt" : "source_page_audio",
    order: index + 1,
    confidence: 0.2,
    needsReview: true
  }));
}

function numberedAnswerEntries(answerMap, fallbackCount) {
  const count = Math.max(answerMap.size, fallbackCount);
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return [number, answerMap.get(number) || ""];
  });
}

function buildSectionQuestions(section, pageAssets, answers, extraAnswers, writingLines, speakingLines) {
  if (section === "reading") {
    const questions = [];
    const primaryReadingCount = pageAssets.length ? Math.max(answers.size, 35) : answers.size;
    for (const [number, answer] of numberedAnswerEntries(answers, primaryReadingCount)) {
      const pageAsset = number <= 10 ? pageFor(pageAssets, 0) : number <= 20 ? pageFor(pageAssets, 1) : pageFor(pageAssets, number - 19);
      const id = `reading-m1-q${number}`;
      questions.push(makeQuestion({
        id,
        section,
        moduleId: "reading-m1",
        number,
        type: number <= 20 ? "toefl.complete_words" : "toefl.academic_passage_choice",
        renderer: number <= 20 ? "toefl.renderer.complete_words" : "toefl.renderer.choice",
        scoring: number <= 20 ? "toefl.complete_words" : "toefl.exact_single_choice",
        prompt: number <= 20 ? "Fill in the missing letters in the paragraph." : "Read the material and answer the question.",
        pageAsset,
        answer,
        config: number <= 20 ? { blanks: [{ id: `${id}-blank`, prefix: "", missingLength: Math.max(1, String(answer).length), answer }] } : {}
      }));
    }
    for (const [number, answer] of numberedAnswerEntries(extraAnswers, extraAnswers.size)) {
      const id = `reading-m2-q${number}`;
      questions.push(makeQuestion({
        id,
        section,
        moduleId: "reading-m2",
        number,
        type: number <= 10 ? "toefl.complete_words" : "toefl.academic_passage_choice",
        renderer: number <= 10 ? "toefl.renderer.complete_words" : "toefl.renderer.choice",
        scoring: number <= 10 ? "toefl.complete_words" : "toefl.exact_single_choice",
        prompt: number <= 10 ? "Fill in the missing letters in the paragraph." : "Read the academic passage and answer the question.",
        pageAsset: pageFor(pageAssets, Math.floor(pageAssets.length * 0.7) + Math.max(0, number - 10)),
        answer,
        config: number <= 10 ? { blanks: [{ id: `${id}-blank`, prefix: "", missingLength: Math.max(1, String(answer).length), answer }] } : {}
      }));
    }
    return questions;
  }
  if (section === "listening") {
    const primaryListeningCount = pageAssets.length ? Math.max(answers.size, 28) : answers.size;
    const listeningEntries = [
      ...numberedAnswerEntries(answers, primaryListeningCount).map((entry) => ({ entry, moduleId: "listening-m1" })),
      ...numberedAnswerEntries(extraAnswers, extraAnswers.size).map((entry) => ({ entry, moduleId: "listening-m2" }))
    ];
    return listeningEntries.map(({ entry: [number, answer], moduleId }, index) => makeQuestion({
      id: moduleId === "listening-m1" ? `listening-q${number}` : `listening-m2-q${number}`,
      section,
      moduleId,
      number,
      type: "toefl.listen_choose_response",
      renderer: "toefl.listening_choice",
      scoring: "toefl.exact_single_choice",
      prompt: "Listen and answer the question.",
      pageAsset: pageFor(pageAssets, index),
      answer
    }));
  }
  if (section === "writing") {
    const count = Math.max(2, Math.min(12, writingLines.length || pageAssets.length || 2));
    return Array.from({ length: count }, (_, index) => makeQuestion({
      id: `writing-q${index + 1}`,
      section,
      moduleId: "writing-m1",
      number: index + 1,
      type: index < 10 ? "toefl.write_email" : index === 10 ? "toefl.write_email" : "toefl.academic_discussion",
      renderer: "toefl.renderer.text",
      scoring: "toefl.manual_or_ai",
      prompt: index < 10 ? "Write your response." : index === 10 ? "Write an email." : "Write for an academic discussion.",
      pageAsset: pageFor(pageAssets, index),
      answer: writingLines[index]?.replace(/^\d+[.)、\s]*/, "") || ""
    }));
  }
  const count = Math.max(speakingLines.length, pageAssets.length, 0);
  return Array.from({ length: count }, (_, index) => makeQuestion({
    id: `speaking-q${index + 1}`,
    section,
    moduleId: "speaking-m1",
    number: index + 1,
    type: index < 7 ? "toefl.listen_repeat" : "toefl.interview_response",
    renderer: "toefl.renderer.recording",
    scoring: "toefl.manual_or_ai",
    prompt: index < 7 ? "Listen and Repeat" : "Take an Interview",
    pageAsset: pageFor(pageAssets, index),
    answer: speakingLines[index]?.replace(/^\d+[.)、\s]*/, "") || "",
    config: { preparationSeconds: index < 7 ? 0 : 15, responseSeconds: index < 7 ? 8 : 45, recordingKey: `speaking-q${index + 1}` }
  }));
}

function sectionModules(section, questions) {
  const moduleIds = [...new Set(questions.map((question) => question.moduleId))];
  return moduleIds.map((moduleId, index) => ({
    id: moduleId,
    title: `Module ${index + 1}`,
    questionIds: questions.filter((question) => question.moduleId === moduleId).map((question) => question.id),
    navigationStrategyId: section === "listening" || section === "speaking" ? "toefl.forward_only" : "toefl.free_within_module"
  }));
}

async function buildPdfExam(source) {
  const sourceName = path.basename(source);
  if (/官方og|18套题|备考资料|官方og/i.test(sourceName)) return { skipped: true, sourceName, reason: "materials_collection" };
  const generatedDir = path.join(source, "generated");
  if (!FORCE && await exists(path.join(generatedDir, "exam.json"))) return { skipped: true, sourceName, reason: "already_generated" };
  const files = (await walk(source)).map((file) => ({ ...file, role: roleFor(file), section: sectionForName(file.name) }));
  const pdfs = files.filter((file) => file.ext === ".pdf" && file.role !== "answer");
  if (!pdfs.length) return { skipped: true, sourceName, reason: "no_question_pdf" };
  const answerPdf = files.find((file) => file.role === "answer" && file.ext === ".pdf");
  const answers = answerPdf ? parseAnswerSections(pdfText(answerPdf.fullPath)) : { reading: new Map(), readingExtra: new Map(), listening: new Map(), listeningExtra: new Map(), writingLines: [], speakingLines: [] };
  const examId = slug(sourceName);
  const renderedBySection = {};
  const assets = [];
  for (const section of SECTION_KEYS) {
    const pdf = pdfs.find((file) => file.section === section) || (section === "reading" ? pdfs[0] : null);
    if (!pdf) {
      renderedBySection[section] = [];
      continue;
    }
    renderedBySection[section] = await renderPdfPages(pdf, section, generatedDir, examId);
    assets.push(...renderedBySection[section]);
  }
  const audioAssets = await collectAudioAssets(files, generatedDir, examId);
  assets.push(...audioAssets);
  const questions = [
    ...buildSectionQuestions("reading", renderedBySection.reading, answers.reading, answers.readingExtra, answers.writingLines, answers.speakingLines),
    ...buildSectionQuestions("listening", renderedBySection.listening, answers.listening, answers.listeningExtra, answers.writingLines, answers.speakingLines),
    ...buildSectionQuestions("writing", renderedBySection.writing, new Map(), new Map(), answers.writingLines, answers.speakingLines),
    ...buildSectionQuestions("speaking", renderedBySection.speaking, new Map(), new Map(), answers.writingLines, answers.speakingLines)
  ];
  const listeningAudio = audioAssets.find((asset) => asset.metadata.section === "listening");
  const speakingAudio = audioAssets.find((asset) => asset.metadata.section === "speaking");
  const audioSegments = [
    ...makeAudioSegments("listening", listeningAudio, questions.filter((question) => question.sectionId === "listening")),
    ...makeAudioSegments("speaking", speakingAudio, questions.filter((question) => question.sectionId === "speaking"))
  ];
  const audioGroups = audioSegments.map((segment) => ({ id: segment.id, title: `${segment.sectionId} ${segment.order}`, audioAssetId: segment.assetId, allowReplay: true, playLimit: 1, startSeconds: segment.startSeconds, endSeconds: segment.endSeconds, confidence: segment.confidence, needsReview: true }));
  for (const question of questions) {
    const segment = audioSegments.find((item) => item.questionIds.includes(question.id));
    if (segment) question.config = { ...question.config, audioGroupId: segment.id, audioSegmentId: segment.id };
  }
  const stimuli = questions.filter((question) => question.config.imageAssetId).map((question) => ({ id: question.stimulusId, examPackId: "toefl", stimulusType: "source_image_fallback", title: `${question.id} source page`, assetIds: [question.config.imageAssetId], config: { questionId: question.id, questionNumber: question.number, sourcePage: question.config.sourcePage } }));
  const sections = SECTION_KEYS.map((section) => {
    const sectionQuestions = questions.filter((question) => question.sectionId === section);
    const issueCount = sectionQuestions.filter((question) => question.needsReview).length;
    return {
      id: section,
      examPackId: "toefl",
      sectionType: SECTION_TYPE[section],
      title: SECTION_TITLES[section],
      modules: sectionModules(section, sectionQuestions),
      timing: { scope: "section", durationSeconds: DURATION[section] },
      status: sectionQuestions.length ? "needs_review" : "not_detected",
      config: { importStatus: sectionQuestions.length ? "needs_review" : "not_detected", sourceFiles: pdfs.filter((file) => file.section === section).map((file) => file.relativePath), audioCount: audioAssets.filter((asset) => asset.metadata.section === section).length, importedAnswerCount: sectionQuestions.filter((question) => question.config.importedAnswer).length, issueCount }
    };
  });
  const legacyTest = {
    id: examId,
    title: sourceName,
    version: 1,
    status: "published",
    sections: sections.map((section) => {
      const sectionQuestions = questions.filter((question) => question.sectionId === section.id);
      return { id: section.id, key: section.id, title: section.title, durationSeconds: section.timing.durationSeconds, importStatus: section.status, sourceFiles: section.config.sourceFiles, audioCount: section.config.audioCount, importedAnswerCount: section.config.importedAnswerCount, issueCount: section.config.issueCount, modules: section.modules.map((module, index) => ({ id: module.id, moduleNumber: index + 1, title: module.title, navigationMode: section.id === "listening" || section.id === "speaking" ? "forward_only" : "free", questions: sectionQuestions.filter((question) => question.moduleId === module.id).map((question) => ({ id: question.id, section: question.sectionId, moduleId: question.moduleId, number: question.number, type: question.questionType.includes("complete_words") ? "complete_words" : question.questionType.includes("listen") ? "listen_choose_response" : question.questionType.includes("speaking") ? "speaking_placeholder" : "single_choice", prompt: question.prompt.text, imageAssetId: question.config.imageAssetId, assetIds: question.assetIds, displayMode: question.config.displayMode, options: [], correctAnswer: question.config.importedAnswer ? { type: "manual_or_ai", importedAnswer: question.config.importedAnswer } : { type: "manual_or_ai" }, confidence: question.confidence, needsReview: question.needsReview })) })) };
    })
  };
  const report = {
    examId,
    sourcePath: source,
    generatedAt: new Date().toISOString(),
    canonicalProfile: "toefl-2026-v1",
    detectedSourcePatterns: ["pdf_source", answerPdf ? "answer_image_based_with_extractable_text" : "answer_missing", audioAssets.length > 1 ? "mixed_audio_files" : audioAssets.length === 1 ? "one_audio_per_section" : "audio_missing"],
    selectedAdapters: { reading: "PdfPageReadingAdapter", listening: "PdfPageListeningAdapter", writing: "PdfPageWritingAdapter", speaking: "PdfPageSpeakingAdapter", answer: answerPdf ? "PdfTextAnswerAdapter" : "MissingAnswerAdapter" },
    recognized: { readingQuestions: questions.filter((q) => q.sectionId === "reading").length, listeningQuestions: questions.filter((q) => q.sectionId === "listening").length, writingTasks: questions.filter((q) => q.sectionId === "writing").length, speakingTasks: questions.filter((q) => q.sectionId === "speaking").length, totalQuestions: questions.length },
    normalizationWarnings: ["question_text_options_need_ocr_or_manual_review"],
    canonicalValidation: { canonicalProfile: "toefl-2026-v1", questionCount: questions.length, needsReviewCount: questions.length },
    needsReview: questions.map((question) => ({ questionId: question.id, section: question.sectionId, reason: "source_page_generated_options_need_extraction" }))
  };
  await writeJson(path.join(generatedDir, "exam.json"), { id: examId, examPackId: "toefl", title: sourceName, version: 1, status: "partially_published", sections });
  await writeJson(path.join(generatedDir, "sections.json"), sections);
  await writeJson(path.join(generatedDir, "modules.json"), sections.flatMap((section) => section.modules.map((module) => ({ ...module, sectionId: section.id }))));
  await writeJson(path.join(generatedDir, "stimuli.json"), stimuli);
  await writeJson(path.join(generatedDir, "questions.json"), questions);
  await writeJson(path.join(generatedDir, "answer-key.json"), Object.fromEntries(questions.map((question) => [question.id, question.config.correctValues || question.config.correctOptionId || question.config.importedAnswer || null])));
  await writeJson(path.join(generatedDir, "assets.json"), assets);
  await writeJson(path.join(generatedDir, "audio-assets.json"), audioAssets);
  await writeJson(path.join(generatedDir, "audio-groups.json"), audioGroups);
  await writeJson(path.join(generatedDir, "audio-segments.json"), audioSegments);
  await writeJson(path.join(generatedDir, "import-report.json"), report);
  await writeJson(path.join(generatedDir, "migration-report.json"), report);
  await writeJson(path.join(generatedDir, "test.json"), legacyTest);
  await writeJson(path.join(generatedDir, "passages.json"), []);
  return { sourceName, examId, questions: questions.length, renderedPages: Object.values(renderedBySection).flat().length };
}

const sources = SOURCE ? [SOURCE] : (await readdir(ROOT, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => path.join(ROOT, entry.name));
const results = [];
for (const source of sources) results.push(await buildPdfExam(source));
console.log(JSON.stringify(results, null, 2));
