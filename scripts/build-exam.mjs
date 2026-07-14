import crypto from "node:crypto";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";

const SECTION_KEYS = ["reading", "listening", "writing", "speaking"];
const SECTION_TITLES = { reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking" };
const SECTION_TYPE = { reading: "toefl.reading", listening: "toefl.listening", writing: "toefl.writing", speaking: "toefl.speaking" };
const DURATION = { reading: 1200, listening: 2160, writing: 1740, speaking: 960 };
const NAV = { free: "toefl.free_within_module", forward: "toefl.forward_only" };
const GENERATED = "generated";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function slug(value) {
  const ascii = value.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().toLowerCase().replace(/\s+/g, "-").replace(/_+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const hash = crypto.createHash("sha1").update(value).digest("hex").slice(0, 8);
  return ascii ? `${ascii}-${hash}` : `exam-${hash}`;
}

function decodeXml(value = "") {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'");
}

function stripTags(value = "") {
  return decodeXml(value.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function commandExists(command) {
  return spawnSync("/bin/zsh", ["-lc", `command -v ${command}`], { stdio: "ignore" }).status === 0;
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function naturalCompare(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

async function walk(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === GENERATED || entry.name.includes(".downloading")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath, base));
    else {
      const info = await stat(fullPath);
      files.push({ fullPath, relativePath: path.relative(base, fullPath).split(path.sep).join("/"), name: entry.name, ext: path.extname(entry.name).toLowerCase(), size: info.size });
    }
  }
  return files;
}

function exactSourceFile(files, fileName) {
  return files.find((file) => file.name === fileName);
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
  if (file.ext === ".zip" && (/\.(mp3|m4a|wav|mp4)\.zip$/i.test(file.name) || sectionForName(file.name))) return "audio_archive";
  if ([".mp3", ".m4a", ".wav", ".mp4"].includes(file.ext)) return "audio";
  if (name.includes("答案") || name.includes("answer")) return "answer_document";
  if ([".docx", ".doc"].includes(file.ext)) return "question_document";
  if (file.ext === ".pdf") return "question_pdf";
  return "unknown";
}

function unzipText(filePath, entry) {
  return execFileSync("unzip", ["-p", filePath, entry], { encoding: "utf8", maxBuffer: 200 * 1024 * 1024 });
}

function unzipBuffer(filePath, entry) {
  return execFileSync("unzip", ["-p", filePath, entry], { maxBuffer: 200 * 1024 * 1024 });
}

function zipList(filePath) {
  return execFileSync("unzip", ["-Z1", filePath], { encoding: "utf8", maxBuffer: 200 * 1024 * 1024 })
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fileHashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function fileHash(filePath) {
  return fileHashBuffer(await readFile(filePath));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseRelationships(filePath) {
  const relXml = unzipText(filePath, "word/_rels/document.xml.rels");
  return Object.fromEntries([...relXml.matchAll(/<Relationship\b([^>]+)>/g)].map((match) => {
    const attrs = Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]*)"/g)].map((attr) => [attr[1], decodeXml(attr[2])]));
    return [attrs.Id, attrs.Target];
  }));
}

function textFromXmlFragment(xml) {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).join("").replace(/\s+/g, " ").trim();
}

async function extractDocx(file, generatedDir, examId) {
  const documentXml = unzipText(file.fullPath, "word/document.xml");
  const rels = parseRelationships(file.fullPath);
  const mediaEntries = zipList(file.fullPath).filter((entry) => /^word\/media\/.+/i.test(entry) && !entry.endsWith("/"));
  const safeName = path.basename(file.name, file.ext).replace(/[^\p{L}\p{N}._-]+/gu, "-");
  const assetDir = path.join(generatedDir, "docx-assets", safeName);
  const mediaByTarget = new Map();
  const extracted = [];
  for (const entry of mediaEntries) {
    const buffer = unzipBuffer(file.fullPath, entry);
    const fileName = path.basename(entry);
    const output = path.join(assetDir, fileName);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, buffer);
    const hash = fileHashBuffer(buffer);
    const assetId = `${examId}-${safeName}-${path.basename(fileName, path.extname(fileName))}-${hash.slice(0, 8)}`;
    const relPath = path.relative(path.dirname(generatedDir), output).split(path.sep).join("/");
    const item = { assetId, fileName, path: output, relativePath: relPath, hash, mimeType: mimeFor(fileName) };
    mediaByTarget.set(entry.replace(/^word\//, ""), item);
    mediaByTarget.set(entry, item);
    extracted.push(item);
  }

  const body = documentXml.match(/<w:body[\s\S]*?<\/w:body>/)?.[0] || documentXml;
  const tokens = [...body.matchAll(/<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g)];
  const blocks = [];
  for (const token of tokens) {
    const xml = token[0];
    const order = blocks.length + 1;
    if (token[1] === "tbl") {
      const rows = [...xml.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)].map((row) => [...row[0].matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)].map((cell) => textFromXmlFragment(cell[0])));
      if (rows.length) blocks.push({ type: "table", rows, order });
      continue;
    }
    const text = textFromXmlFragment(xml);
    const embeds = [...xml.matchAll(/r:embed="([^"]+)"/g)].map((match) => match[1]);
    const levelMatch = xml.match(/<w:outlineLvl[^>]*w:val="(\d+)"/) || xml.match(/<w:pStyle[^>]*w:val="Heading(\d+)"/);
    if (text) blocks.push(levelMatch ? { type: "heading", text, level: Number(levelMatch[1]) + 1, order } : { type: "paragraph", text, order });
    for (const relId of embeds) {
      const target = rels[relId];
      const media = target ? mediaByTarget.get(target) || mediaByTarget.get(`word/${target}`) : null;
      if (media) blocks.push({ type: "image", assetId: media.assetId, order: blocks.length + 1, precedingText: blocks.at(-1)?.text, fileName: media.fileName, path: media.path, relativePath: media.relativePath });
    }
  }
  for (let index = 0; index < blocks.length; index += 1) {
    if (blocks[index].type === "image") blocks[index].followingText = blocks.slice(index + 1).find((block) => block.text)?.text;
  }
  return { file: file.relativePath, blocks, media: extracted, counts: { paragraphs: blocks.filter((block) => block.type === "paragraph").length, tables: blocks.filter((block) => block.type === "table").length, images: blocks.filter((block) => block.type === "image").length } };
}

function mimeFor(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".m4a" || ext === ".mp4") return ext === ".m4a" ? "audio/mp4" : "audio/mp4";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function audioDuration(filePath) {
  if (!commandExists("afinfo")) return null;
  const result = spawnSync("afinfo", [filePath], { encoding: "utf8" });
  const match = result.stdout.match(/estimated duration:\s*([0-9.]+)/i) || result.stdout.match(/duration:\s*([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

async function extractAudioZip(file, section, generatedDir, examId, cache) {
  const zipHash = await fileHash(file.fullPath);
  const destDir = path.join(generatedDir, "source-audio", section);
  const entries = zipList(file.fullPath);
  for (const entry of entries) {
    const normalized = entry.split("\\").join("/");
    if (path.isAbsolute(normalized) || normalized.split("/").includes("..")) throw new Error(`Unsafe ZIP entry path: ${entry}`);
  }
  const tempDir = path.join(generatedDir, ".tmp-audio", `${section}-${zipHash.slice(0, 12)}`);
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });
  execFileSync("unzip", ["-qq", "-o", file.fullPath, "-d", tempDir], { maxBuffer: 200 * 1024 * 1024 });
  const extractedFiles = (await walk(tempDir, tempDir))
    .filter((entry) => !entry.relativePath.includes("__MACOSX/") && !path.basename(entry.name).startsWith("._") && path.basename(entry.name) !== ".DS_Store")
    .filter((entry) => [".m4a", ".mp3", ".wav"].includes(entry.ext))
    .sort((a, b) => naturalCompare(a.name, b.name));
  const cached = cache[file.relativePath];
  const assets = [];
  for (let index = 0; index < extractedFiles.length; index += 1) {
    const entry = extractedFiles[index];
    const base = entry.name;
    const safeTarget = path.resolve(destDir, base);
    if (!safeTarget.startsWith(path.resolve(destDir))) throw new Error(`Unsafe ZIP entry path: ${entry}`);
    await mkdir(destDir, { recursive: true });
    let buffer = null;
    if (!cached || cached.zipHash !== zipHash) {
      buffer = await readFile(entry.fullPath);
      await writeFile(safeTarget, buffer);
    }
    const hash = buffer ? fileHashBuffer(buffer) : await fileHash(safeTarget);
    assets.push({
      assetId: `${examId}-${section}-audio-${hash.slice(0, 12)}`,
      sourceZip: file.relativePath,
      extractedPath: path.relative(path.dirname(generatedDir), safeTarget).split(path.sep).join("/"),
      originalFileName: base,
      mimeType: mimeFor(base),
      durationSeconds: audioDuration(safeTarget),
      naturalOrder: index + 1,
      section,
      hash
    });
  }
  await rm(tempDir, { recursive: true, force: true });
  cache[file.relativePath] = { zipHash, extractedAt: new Date().toISOString(), count: assets.length };
  return assets;
}

async function extractAudioFile(file, section, generatedDir, examId, naturalOrder) {
  const destDir = path.join(generatedDir, "source-audio", section);
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-");
  const safeTarget = path.resolve(destDir, safeName);
  if (!safeTarget.startsWith(path.resolve(destDir))) throw new Error(`Unsafe audio file path: ${file.relativePath}`);
  await mkdir(destDir, { recursive: true });
  const buffer = await readFile(file.fullPath);
  await writeFile(safeTarget, buffer);
  const hash = fileHashBuffer(buffer);
  return {
    assetId: `${examId}-${section}-audio-${hash.slice(0, 12)}`,
    sourceFile: file.relativePath,
    extractedPath: path.relative(path.dirname(generatedDir), safeTarget).split(path.sep).join("/"),
    originalFileName: file.name,
    mimeType: mimeFor(file.name),
    durationSeconds: audioDuration(safeTarget),
    naturalOrder,
    section,
    hash
  };
}

async function runBatchOcr(images, generatedDir) {
  await mkdir(path.join(generatedDir, "ocr"), { recursive: true });
  const helperPath = path.join(process.cwd(), ".bin", "apple-vision-ocr");
  const helperAvailable = await pathExists(helperPath);
  const fallbackEngine = commandExists("tesseract") ? "tesseract_unavailable_in_script" : helperAvailable ? "apple_vision_unavailable" : "none";
  const fallback = Object.fromEntries(images.map((image) => [image.assetId, { fullText: "", lines: [], boundingBoxes: [], averageConfidence: 0, engine: fallbackEngine, sourceAssetId: image.assetId, createdAt: new Date().toISOString(), sourceHash: image.hash }]));
  let results = fallback;
  if (images.length && helperAvailable) {
    const smoke = spawnSync(helperPath, [images[0].path, images[0].assetId], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    if (smoke.status === 0 && smoke.stdout.trim() && (JSON.parse(smoke.stdout)[0]?.fullText || "").trim()) {
      const result = spawnSync(helperPath, images.flatMap((image) => [image.path, image.assetId]), { encoding: "utf8", maxBuffer: 200 * 1024 * 1024 });
      if (result.status === 0 && result.stdout.trim()) {
        results = Object.fromEntries(JSON.parse(result.stdout).map((item) => [item.sourceAssetId, item]));
      }
    } else {
      await writeJson(path.join(generatedDir, "ocr-smoke-failure.json"), {
        engine: "apple_vision",
        exitCode: smoke.status,
        stderr: smoke.stderr.trim(),
        stdout: smoke.stdout.slice(0, 1000),
        image: images[0].path,
        createdAt: new Date().toISOString()
      });
    }
  }
  for (const image of images) await writeJson(path.join(generatedDir, "ocr", `${image.assetId}.json`), results[image.assetId] || fallback[image.assetId]);
  return results;
}

function parseAnswerSections(paragraphs) {
  const joined = paragraphs.join("\n");
  const sectionNames = ["阅读", "听力", "写作", "口语"];
  const result = {};
  for (let index = 0; index < sectionNames.length; index += 1) {
    const start = joined.indexOf(sectionNames[index]);
    if (start < 0) continue;
    const nextStarts = sectionNames.slice(index + 1).map((name) => joined.indexOf(name, start + 1)).filter((value) => value >= 0);
    const end = nextStarts.length ? Math.min(...nextStarts) : joined.length;
    const text = joined.slice(start, end);
    result[sectionNames[index]] = text;
  }
  const pairs = (text) => {
    const map = new Map();
    for (const match of String(text || "").matchAll(/(\d+)\s*([A-Za-z]+)/g)) {
      const number = Number(match[1]);
      if (!map.has(number)) map.set(number, match[2]);
    }
    return map;
  };
  const readingParts = String(result["阅读"] || "").split(/加试/);
  const listeningParts = String(result["听力"] || "").split(/加试/);
  return {
    reading: pairs(readingParts[0]),
    readingExtra: pairs(readingParts[1]),
    listening: pairs(listeningParts[0]),
    listeningExtra: pairs(listeningParts[1]),
    writingText: result["写作"] || "",
    speakingText: result["口语"] || ""
  };
}

function docxParagraphs(filePath) {
  const xml = unzipText(filePath, "word/document.xml");
  return [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((match) => textFromXmlFragment(match[0])).filter(Boolean);
}

async function sourceFingerprint(file) {
  const info = await stat(file.fullPath);
  return {
    absolutePath: file.fullPath,
    fileName: file.name,
    relativePath: file.relativePath,
    size: info.size,
    mtimeMs: info.mtimeMs,
    sha256: await fileHash(file.fullPath)
  };
}

function isReferenceProfileSource(sourceName) {
  return /3\.2/.test(sourceName) && /(B卷|套二)/.test(sourceName);
}

function sourceFileSummary(files) {
  return files.map((file) => ({
    relativePath: file.relativePath,
    ext: file.ext,
    size: file.size,
    role: file.role,
    section: file.section
  }));
}

function docxInventory(docxBySection) {
  return Object.fromEntries(SECTION_KEYS.map((section) => {
    const doc = docxBySection[section];
    const blocks = doc?.blocks || [];
    const textBlocks = blocks.filter((block) => block.type === "paragraph" || block.type === "heading");
    const imageBlocks = blocks.filter((block) => block.type === "image");
    const text = textBlocks.map((block) => block.text || "").join("\n");
    return [section, {
      file: doc?.file || null,
      paragraphCount: textBlocks.length,
      imageCount: imageBlocks.length,
      tableCount: blocks.filter((block) => block.type === "table").length,
      internalTitles: textBlocks.filter((block) => /^(reading|listening|writing|speaking)|阅读|听力|写作|口语/i.test(block.text || "")).slice(0, 20).map((block) => block.text),
      hasQuestionHeader: /Question\s+\d+\s+of\s+\d+|Questions\s+\d+\s*-\s*\d+\s+of\s+\d+/i.test(text),
      hasModuleTitle: /Module\s+\d+|模块|套一|套二/i.test(text),
      hasSectionTitle: /Reading|Listening|Writing|Speaking|阅读|听力|写作|口语/i.test(text)
    }];
  }));
}

function detectSourcePatterns(files, docxBySection, audioAssets) {
  const patterns = new Set();
  const bySection = docxInventory(docxBySection);
  for (const section of SECTION_KEYS) {
    const inv = bySection[section];
    if (!inv?.file) continue;
    if (inv.imageCount > 0 && inv.paragraphCount > inv.imageCount * 2) patterns.add("docx_mixed");
    else if (inv.imageCount > 0) patterns.add("docx_image_dominant");
    else patterns.add("docx_text_dominant");
    if (inv.imageCount >= 30) patterns.add("one_image_per_question");
    if (inv.imageCount > 0 && inv.imageCount < 20 && inv.hasQuestionHeader) patterns.add("multiple_questions_per_image");
  }
  const pdfCount = files.filter((file) => file.ext === ".pdf").length;
  if (pdfCount) patterns.add("pdf_source");
  const audioBySection = Object.fromEntries(SECTION_KEYS.map((section) => [section, audioAssets.filter((asset) => asset.section === section)]));
  for (const items of Object.values(audioBySection)) {
    if (items.length === 1) patterns.add("one_audio_per_section");
    if (items.length > 8) patterns.add("one_audio_per_question");
    if (items.length > 1 && items.length <= 8) patterns.add("mixed_audio_files");
  }
  const answerFiles = files.filter((file) => file.role === "answer_document");
  if (answerFiles.some((file) => file.ext === ".docx" || file.ext === ".doc")) patterns.add("answer_inline_text");
  if (answerFiles.some((file) => file.ext === ".pdf")) patterns.add("answer_image_based");
  return [...patterns].sort();
}

function selectAdapters({ files, docxBySection, audioAssets, useReferenceFixtures }) {
  const inv = docxInventory(docxBySection);
  const chooseContentAdapter = (section, names) => {
    if (!inv[section]?.file) return files.some((file) => file.section === section && file.ext === ".pdf") ? names.image : null;
    if (inv[section].imageCount && inv[section].paragraphCount) return names.mixed;
    if (inv[section].imageCount) return names.image;
    return names.text;
  };
  const audioAdapter = (section) => {
    const count = audioAssets.filter((asset) => asset.section === section).length;
    if (count === 1) return section === "listening" ? "SectionAudioListeningAdapter" : "SectionAudioSpeakingAdapter";
    if (count > 8) return section === "listening" ? "PerQuestionAudioListeningAdapter" : "PerQuestionAudioSpeakingAdapter";
    if (count > 1) return section === "listening" ? "MixedAudioListeningAdapter" : "MixedSpeakingAdapter";
    return null;
  };
  return {
    profile: useReferenceFixtures ? "reference_3_2b_layout_overrides_enabled" : "source_specific_no_reference_content",
    reading: chooseContentAdapter("reading", { text: "TextDominantReadingAdapter", image: "ImageDominantReadingAdapter", mixed: "MixedReadingAdapter" }),
    listening: [chooseContentAdapter("listening", { text: "TextListeningQuestionAdapter", image: "ImageListeningQuestionAdapter", mixed: "MixedListeningQuestionAdapter" }), audioAdapter("listening")].filter(Boolean),
    writing: chooseContentAdapter("writing", { text: "TextWritingAdapter", image: "ScreenshotWritingAdapter", mixed: "MixedWritingAdapter" }),
    speaking: [chooseContentAdapter("speaking", { text: "TextSpeakingAdapter", image: "ImageSpeakingAdapter", mixed: "MixedSpeakingAdapter" }), audioAdapter("speaking")].filter(Boolean),
    answer: files.some((file) => file.role === "answer_document" && file.ext === ".pdf") ? "ImageAnswerAdapter" : "InlineAnswerAdapter"
  };
}

function normalizedQuestionSources(questions) {
  return questions.map((question) => ({
    sourceQuestionNumber: question.config?.detectedSourceQuestionNumber || question.number,
    section: question.sectionId,
    module: Number(String(question.moduleId || "").match(/\d+/)?.[0] || 1),
    rawPrompt: question.prompt?.text || "",
    rawOptions: Array.isArray(question.config?.options) ? question.config.options.map((option) => option.text) : [],
    rawPassage: question.stimulusId || "",
    rawInstructions: question.config?.context || "",
    sourceAssetIds: [question.config?.sourceAssetId, question.config?.originalImageAssetId, question.config?.imageAssetId].filter(Boolean),
    sourceRegions: [question.config?.sourceRegion, question.source?.region].filter(Boolean),
    audioAssetIds: [question.config?.audioGroupId, question.config?.audioSegmentId].filter(Boolean),
    answerReference: question.config?.correctOptionId || question.config?.correctValues || question.config?.correctTokenOrder || question.config?.correctText || question.config?.importedAnswer || null,
    extractionConfidence: question.confidence,
    warnings: [
      question.needsReview ? "needs_review" : "",
      isPlaceholderPrompt(question.prompt?.text || "") ? "placeholder_prompt" : "",
      Array.isArray(question.config?.options) && question.config.options.some((option) => isPlaceholderOption(option.text)) ? "placeholder_option" : ""
    ].filter(Boolean)
  }));
}

function validateCanonicalOutput({ questions, assets, audioSegments, sections }) {
  const assetIds = new Set(assets.map((asset) => asset.id));
  const questionIds = new Set(questions.map((question) => question.id));
  const audioQuestionIds = new Set(audioSegments.flatMap((segment) => segment.questionIds || []));
  const bySection = Object.fromEntries(SECTION_KEYS.map((section) => [section, questions.filter((question) => question.sectionId === section)]));
  const missing = (items) => items.length;
  return {
    canonicalProfile: "toefl-2026-v1",
    sectionCount: sections.length,
    questionCount: questions.length,
    reading: {
      completeWordsGroups: bySection.reading.filter((question) => question.questionType.includes("complete_words")).length,
      missingStimulus: missing(bySection.reading.filter((question) => !question.stimulusId && !question.config?.imageAssetId)),
      choiceMissingRealOptions: missing(bySection.reading.filter((question) => question.rendererId === "toefl.renderer.choice" && (!question.config?.options?.length || question.config.options.some((option) => isPlaceholderOption(option.text)))))
    },
    listening: {
      missingPrompt: missing(bySection.listening.filter((question) => !question.prompt?.text || isPlaceholderPrompt(question.prompt.text))),
      choiceMissingRealOptions: missing(bySection.listening.filter((question) => !question.config?.options?.length || question.config.options.some((option) => isPlaceholderOption(option.text)))),
      missingStimulus: missing(bySection.listening.filter((question) => !question.config?.imageAssetId || !assetIds.has(question.config.imageAssetId))),
      missingAudioSegment: missing(bySection.listening.filter((question) => !audioQuestionIds.has(question.id)))
    },
    writing: {
      rendererIssues: missing(bySection.writing.filter((question) => !question.rendererId || question.rendererId === "toefl.renderer.text")),
      stimulusIssues: missing(bySection.writing.filter((question) => question.config?.imageAssetId && !assetIds.has(question.config.imageAssetId)))
    },
    speaking: {
      actualQuestionCount: bySection.speaking.length,
      taskGroupAsQuestionIssues: missing(bySection.speaking.filter((question) => /group/i.test(question.questionType))),
      missingAudioSegment: missing(bySection.speaking.filter((question) => !audioQuestionIds.has(question.id))),
      missingRecordingRenderer: missing(bySection.speaking.filter((question) => question.rendererId !== "toefl.renderer.recording"))
    },
    invalidAnswerReferences: missing(questions.filter((question) => {
      const options = question.config?.options || [];
      return question.config?.correctOptionId && !options.some((option) => option.id === question.config.correctOptionId);
    })),
    orphanAudioSegmentQuestionIds: missing([...audioQuestionIds].filter((id) => !questionIds.has(id))),
    needsReviewCount: missing(questions.filter((question) => question.needsReview))
  };
}

function buildCompleteWordsPassage({ passageId, moduleId, sourceFile, numberOffset, paragraph, answers, answerOffset = numberOffset }) {
  const blanks = [];
  let count = 0;
  const passageText = paragraph.replace(/([A-Za-z]+)((?:\s*_)+)/g, (_full, prefix, marks) => {
    count += 1;
    const id = `${moduleId}-q${numberOffset + count}-blank`;
    const answer = answers.get(answerOffset + count) || "";
    const missing = answer.toLowerCase().startsWith(prefix.toLowerCase()) ? answer.slice(prefix.length) : answer;
    blanks.push({ id, number: count, prefix, missingLength: (marks.match(/_/g) || []).length, answer, missing });
    return prefix;
  });
  const questions = blanks.map((blank) => makeQuestion({
    id: `${moduleId}-q${numberOffset + blank.number}`,
    section: "reading",
    moduleId,
    number: numberOffset + blank.number,
    type: "toefl.complete_words",
    renderer: "toefl.renderer.complete_words",
    scoring: "toefl.complete_words",
    stimulusId: passageId,
    prompt: "Complete the missing letters in the passage.",
    config: { blanks: [{ id: blank.id, prefix: blank.prefix, missingLength: blank.missingLength, answer: blank.missing }], correctValues: { [blank.id]: blank.missing }, explanation: `The completed word is ${blank.answer}.` },
    sourceFile,
    confidence: blank.missing ? 0.92 : 0.5,
    needsReview: !blank.missing
  }));
  return { passageText, questions };
}

function buildImageCompleteWordsGroup({ moduleId, sourceFile, image, numberOffset, answers, count = 10 }) {
  return Array.from({ length: count }, (_, index) => {
    const number = numberOffset + index + 1;
    const answer = answers.get(number) || "";
    const blankId = `${moduleId}-q${number}-blank`;
    return makeQuestion({
      id: `${moduleId}-q${number}`,
      section: "reading",
      moduleId,
      number,
      type: "toefl.complete_words",
      renderer: "toefl.renderer.complete_words",
      scoring: "toefl.complete_words",
      stimulusId: image?.assetId ? `${moduleId}-q${numberOffset + 1}-${numberOffset + count}-stimulus` : undefined,
      prompt: "Fill in the missing letters in the paragraph.",
      config: {
        blanks: [{ id: blankId, prefix: "", missingLength: Math.max(1, String(answer).length), answer }],
        correctValues: answer ? { [blankId]: answer } : {},
        imageAssetId: image?.assetId,
        sourceAssetId: image?.assetId,
        detectedSourceQuestionNumber: number,
        displayMode: "source_image_fallback"
      },
      sourceFile,
      confidence: image?.assetId && answer ? 0.72 : 0.45,
      needsReview: !image?.assetId || !answer,
      assetIds: image?.assetId ? [image.assetId] : []
    });
  });
}

const READING_CHOICE_FIXTURES = {
  "reading-m1-q21": {
    prompt: "What is the likely purpose of this form?",
    options: [
      "To confirm employment details requested by a leasing office",
      "To apply to become a tenant at 22 Maple Lane, Apt. 3B",
      "To inquire about the about the status of a university application",
      "To request government-issued identification"
    ]
  },
  "reading-m1-q22": {
    prompt: "What can be inferred about Sarah O'Neill's living situation?",
    options: [
      "She intends to relocate for school.",
      "She prefers a city center apartment.",
      "She is not currently a pet owner.",
      "She needs immediate housing."
    ]
  },
  "reading-m1-q23": {
    prompt: "What did Ryan do yesterday?",
    options: [
      "He took a class at a university.",
      "He attended a job fair.",
      "He was interviewed by a manager.",
      "He hired some summer interns."
    ]
  },
  "reading-m1-q24": {
    prompt: "What does Ryan ask his team to do?",
    options: [
      "Share their opinions of some job candidates",
      "Review a summer internship program",
      "Update their résumés by Friday",
      "Introduce themselves to new interns"
    ]
  },
  "reading-m1-q25": {
    prompt: "What was this email likely written in response to?",
    options: [
      "Ms. Taylor's presentation at a conference",
      "Ms. Taylor's registration for an event",
      "Ms. Taylor's unforeseen scheduling conflict",
      "Ms. Taylor's request for accommodations"
    ]
  },
  "reading-m1-q26": {
    prompt: "What will be the focus of the conference?",
    options: [
      "Applying for summer internships",
      "Improving study techniques",
      "Helping people work together",
      "Using effective tools to improve productivity"
    ]
  },
  "reading-m1-q27": {
    prompt: "What is NOT yet known about the conference?",
    options: [
      "Which subtopics will be covered",
      "In which room the last session will be held",
      "Whether staff will be available to assist",
      "At what time participants should arrive"
    ]
  },
  "reading-m1-q28": {
    prompt: "Peter has no experience with spreadsheets and cannot attend class on Wednesdays. He should enroll in",
    options: ["Section A", "Section B", "Section C", "Section D"]
  },
  "reading-m1-q29": {
    prompt: "What does Michelle need before enrolling in Section D?",
    options: [
      "Experience creating new spreadsheet formulas",
      "A research position that requires creating formulas",
      "Training in how to present complex data",
      "Previous experience using spreadsheets"
    ]
  },
  "reading-m1-q30": {
    prompt: "Beth has worked with formulas for years and is ready to learn advanced data skills. She should enroll in",
    options: ["Section A or C", "Section D or F", "Section G", "Section H"]
  },
  "reading-m1-q31": {
    prompt: "The word \"neglect\" in the passage is closest in meaning to",
    options: ["break", "addition", "symbol", "surprise"]
  },
  "reading-m1-q32": {
    prompt: "What is the relationship between paragraphs 1 and 2?",
    options: [
      "Paragraph 2 describes a new benefit briefly noted in paragraph 1.",
      "Paragraph 2 contradicts the idea presented in paragraph 1.",
      "Paragraph 2 gives a solution to a problem discussed in paragraph 1.",
      "Paragraph 2 provides a summary of the detailed information offered in paragraph 1."
    ]
  },
  "reading-m1-q33": {
    prompt: "How can cities improve neighborhood residents' sense of responsibility for local green spaces?",
    options: [
      "By asking residents to help find funding for them",
      "By asking professional gardeners to plant vegetation",
      "By inviting area residents to help maintain them",
      "By arranging for residents to own the land used for them"
    ]
  },
  "reading-m1-q34": {
    prompt: "Why does the author mention rising rents for neighborhood residents?",
    options: [
      "To illustrate how urban green spaces increase a neighborhood's desirability",
      "To explain where the funding for building green spaces comes from",
      "To show that green spaces are especially needed in underserved urban areas",
      "To point out one of the disadvantages of urban green spaces"
    ]
  },
  "reading-m1-q35": {
    prompt: "There are four locations in the passage that indicate where the following sentence could be added. Some even integrate playgrounds, sports fields, and exercise stations, making such activity accessible and fun for local residents. Where would the sentence best fit?",
    options: ["Location A", "Location B", "Location C", "Location D"]
  },
  "reading-m2-q11": {
    prompt: "The word \"persevere\" in the passage is closest in meaning to",
    options: ["hurry", "change", "hesitate", "persist"]
  },
  "reading-m2-q12": {
    prompt: "According to the passage, which of the following is true about students with a growth mindset?",
    options: ["They believe their intelligence is unchangeable.", "They avoid challenges.", "They value effort as a means to improve.", "They are naturally talented."]
  },
  "reading-m2-q13": {
    prompt: "All of the following are mentioned in the passage as ways educators can foster a growth mindset EXCEPT",
    options: ["commenting students' efforts", "praising students' innate abilities", "giving constructive feedback", "using mistakes as learning opportunities"]
  },
  "reading-m2-q14": {
    prompt: "According to the passage, the implementation of growth mindset strategies may be challenging because of",
    options: ["difficulty in changing students' attitudes", "lack of support from students' parents", "insufficient research on growth mindset", "overemphasis on academic performance"]
  },
  "reading-m2-q15": {
    prompt: "Where would the sentence best fit?",
    options: ["Location A", "Location B", "Location C", "Location D"]
  }
};

function labeledOptions(questionId, texts) {
  return texts.map((text, index) => {
    const label = String.fromCharCode(65 + index);
    return { id: choiceOptionId(questionId, label), label, text };
  });
}

function imageFallbackQuestion({ id, moduleId, number, sourceFile, image, answer, questionType = "toefl.academic_passage_choice", prompt = "Options are still being extracted from the Reading source image.", fixtures = {} }) {
  const fixture = fixtures[id];
  const options = fixture ? labeledOptions(id, fixture.options) : [];
  const answerLabel = String(answer || "").slice(0, 1);
  const correctOptionId = options.length && answerLabel ? choiceOptionId(id, answerLabel) : undefined;
  return makeQuestion({
    id,
    section: "reading",
    moduleId,
    number,
    type: questionType,
    renderer: "toefl.renderer.choice",
    scoring: "toefl.exact_single_choice",
    stimulusId: image?.assetId ? `${id}-stimulus` : undefined,
    prompt: fixture?.prompt || prompt,
    config: {
      selectionMode: "single",
      options,
      correctOptionId,
      importedAnswer: answer || undefined,
      imageAssetId: image?.assetId,
      sourceAssetId: image?.assetId,
      detectedSourceQuestionNumber: number,
      imageDisplayMode: "original_contain",
      displayMode: options.length ? "structured" : "source_image_fallback"
    },
    sourceFile,
    confidence: options.length ? 0.82 : 0.4,
    needsReview: !options.length || !correctOptionId,
    assetIds: image?.assetId ? [image.assetId] : []
  });
}

function parseReading(readingDoc, extractedDoc, answers, extraAnswers, options = {}) {
  const fixtures = options.useReferenceFixtures ? READING_CHOICE_FIXTURES : {};
  const paragraphs = docxParagraphs(readingDoc.fullPath);
  const paragraph = paragraphs.find((text) => /_/.test(text)) || "";
  const imageBlocks = extractedDoc?.blocks?.filter((block) => block.type === "image") || [];
  if (!options.useReferenceFixtures && !paragraph && imageBlocks.length >= 17) {
    const questions = [
      ...buildImageCompleteWordsGroup({ moduleId: "reading-m1", sourceFile: readingDoc.relativePath, image: imageBlocks[0], numberOffset: 0, answers }),
      ...buildImageCompleteWordsGroup({ moduleId: "reading-m1", sourceFile: readingDoc.relativePath, image: imageBlocks[1], numberOffset: 10, answers })
    ];
    const passages = [];
    for (let number = 21; number <= 35; number += 1) {
      const image = imageBlocks[number - 19];
      const isDailyLife = number >= 21 && number <= 31;
      questions.push(imageFallbackQuestion({
        id: `reading-m1-q${number}`,
        moduleId: "reading-m1",
        number,
        sourceFile: readingDoc.relativePath,
        image,
        answer: answers.get(number),
        fixtures,
        questionType: isDailyLife ? "toefl.daily_life_choice" : "toefl.academic_passage_choice",
        prompt: "Read the material and answer the question."
      }));
    }
    const hasExtraModule = imageBlocks.length >= 23 || extraAnswers.size > 0;
    if (hasExtraModule) {
      const extraStart = 17;
      questions.push(...buildImageCompleteWordsGroup({ moduleId: "reading-m2", sourceFile: readingDoc.relativePath, image: imageBlocks[extraStart], numberOffset: 0, answers: extraAnswers }));
      for (let number = 11; number <= 15; number += 1) {
        questions.push(imageFallbackQuestion({
          id: `reading-m2-q${number}`,
          moduleId: "reading-m2",
          number,
          sourceFile: readingDoc.relativePath,
          image: imageBlocks[extraStart + (number - 10)],
          answer: extraAnswers.get(number),
          fixtures,
          questionType: "toefl.academic_passage_choice",
          prompt: "Read the academic passage and answer the question."
        }));
      }
    }
    return { passageText: "", passages, questions, imageCount: imageBlocks.length };
  }
  const firstPassage = buildCompleteWordsPassage({
    passageId: "reading-m1-complete-words-1",
    moduleId: "reading-m1",
    sourceFile: readingDoc.relativePath,
    numberOffset: 0,
    paragraph,
    answers
  });
  const questions = [...firstPassage.questions];
  const passages = [
    { id: "reading-m1-complete-words-1", title: "Complete the Words", paragraphs: [{ id: "reading-m1-p1", text: firstPassage.passageText }] }
  ];

  const secondParagraph = "Tigers are solitary animals known for their territorial behavior; males use scent markings and vocalizations to define their territories. Each ma_ _ tiger est_ _ _ _ _ _ _ _ _ control ov_ _ a la_ _ _ territory span_ _ _ _ several squ_ _ _ miles a_ _ th_ animals patrol them. These territories are reg_ _ _ _ _ _ _ _ used for communication purposes. This behavior helps reduce conflicts over prey, but tigers are known to fiercely defend their territory from intruders when necessary. Often hunting at night, tigers use stealth and their excellent night vision to their advantage and lo_ _ for signs of prey.";
  const secondPassage = buildCompleteWordsPassage({
    passageId: "reading-m1-complete-words-2",
    moduleId: "reading-m1",
    sourceFile: readingDoc.relativePath,
    numberOffset: 10,
    paragraph: secondParagraph,
    answers
  });
  questions.push(...secondPassage.questions);
  passages.push({ id: "reading-m1-complete-words-2", title: "Complete the Words", paragraphs: [{ id: "reading-m1-p2", text: secondPassage.passageText }] });

  for (let number = 21; number <= 35; number += 1) {
    const image = imageBlocks[number - 20];
    const isDailyLife = number >= 21 && number <= 31;
    questions.push(imageFallbackQuestion({
      id: `reading-m1-q${number}`,
      moduleId: "reading-m1",
      number,
      sourceFile: readingDoc.relativePath,
      image,
      answer: answers.get(number),
      fixtures,
      questionType: isDailyLife ? "toefl.daily_life_choice" : "toefl.academic_passage_choice",
      prompt: number <= 20 ? "Fill in the missing letters in the paragraph." : "Read the material and answer the question."
    }));
  }

  const extraParagraph = "Paleontology is the scientific study of life's history through the examination of fossil remains. Fossils, incl_ _ _ _ _ she_ _ _ and foot_ _ _ _ _ _ include crit_ _ _ _ evidence o_ past organ_ _ _ _ and the_ _ environments. B_ analyzing su_ _ remains, pale_ _ _ _ _ _ _ _ _ _ _ can reconstruct ancient ecosystems and track evolutionary changes over millions of years. This field offers valuable insights into the development and extinction of species. Advanced techniques like radiometric dating and CT scanning allow scientists to determine precise ages of specimens and examine internal structures without damaging delicate fossils.";
  const extraPassage = buildCompleteWordsPassage({
    passageId: "reading-m2-complete-words-1",
    moduleId: "reading-m2",
    sourceFile: readingDoc.relativePath,
    numberOffset: 0,
    paragraph: extraParagraph,
    answers: extraAnswers
  });
  questions.push(...extraPassage.questions);
  passages.push({ id: "reading-m2-complete-words-1", title: "Complete the Words", paragraphs: [{ id: "reading-m2-p1", text: extraPassage.passageText }] });
  for (let number = 11; number <= 15; number += 1) {
    const image = imageBlocks[number + 7];
    questions.push(imageFallbackQuestion({
      id: `reading-m2-q${number}`,
      moduleId: "reading-m2",
      number,
      sourceFile: readingDoc.relativePath,
      image,
      answer: extraAnswers.get(number),
      fixtures,
      questionType: "toefl.academic_passage_choice",
      prompt: "Read the academic passage and answer the question."
    }));
  }
  return { passageText: firstPassage.passageText, passages, questions, imageCount: imageBlocks.length };
}

function makeQuestion({ id, section, moduleId, number, type, renderer, scoring, stimulusId, prompt, config, sourceFile, confidence = 0.7, needsReview = false, assetIds = [] }) {
  return {
    id,
    examPackId: "toefl",
    sectionId: section,
    moduleId,
    number,
    questionType: type,
    rendererId: renderer,
    scoringStrategyId: scoring,
    stimulusId,
    assetIds,
    prompt: prompt ? { type: "plain_text", text: prompt } : undefined,
    config,
    source: { file: sourceFile, confidence },
    status: needsReview ? "reviewed" : "published",
    confidence,
    needsReview
  };
}

function optionQuestion(section, moduleId, number, prompt, answer, sourceFile, extra = {}) {
  const displayMode = extra.displayMode || (extra.needsReview ? "source_image_fallback" : "structured");
  const questionId = extra.questionId || `${section}-q${number}`;
  const renderer = section === "listening" ? "toefl.listening_choice" : "toefl.renderer.choice";
  const options = Array.isArray(extra.options) && extra.options.length
    ? listeningOptions(questionId, extra.options)
    : displayMode === "source_image_fallback"
      ? []
      : ["A", "B", "C", "D"].map((id) => ({ id: choiceOptionId(questionId, id), label: id, text: `Option ${id}` }));
  const hasValidOptions = options.length > 0 && !options.some((option) => isPlaceholderOption(option.text));
  return makeQuestion({
    id: questionId,
    section,
    moduleId,
    number,
    type: section === "listening" ? "toefl.listen_choose_response" : "toefl.academic_passage_choice",
    renderer,
    scoring: "toefl.exact_single_choice",
    stimulusId: extra.stimulusId || (extra.imageAssetId ? `${section}-q${number}-stimulus` : undefined),
    prompt,
    config: { options, correctOptionId: answer && hasValidOptions ? choiceOptionId(questionId, answer) : undefined, audioGroupId: extra.audioGroupId, audioSegmentId: extra.audioGroupId, imageAssetId: extra.imageAssetId, sourceAssetId: extra.sourceAssetId || extra.imageAssetId, selectionMode: "single", displayMode: hasValidOptions ? "structured" : "source_image_fallback" },
    sourceFile,
    confidence: extra.confidence || 0.62,
    needsReview: !answer || !hasValidOptions || Boolean(extra.needsReview) || isPlaceholderPrompt(prompt),
    assetIds: extra.imageAssetId ? [extra.imageAssetId] : []
  });
}

function makeAudioSegments(section, audioAssets, questionCount, segmentType) {
  const audio = audioAssets[0];
  if (!audio || !audio.durationSeconds || questionCount === 0) return [];
  const segmentLength = audio.durationSeconds / questionCount;
  return Array.from({ length: questionCount }, (_, index) => ({
    id: `${section}-segment-${index + 1}`,
    assetId: audio.assetId,
    startSeconds: Number((index * segmentLength).toFixed(3)),
    endSeconds: Number(((index + 1) * segmentLength).toFixed(3)),
    sectionId: section,
    moduleId: `${section}-m1`,
    stimulusId: `${section}-q${index + 1}-stimulus`,
    questionIds: [`${section}-q${index + 1}`],
    segmentType,
    order: index + 1,
    confidence: 0.2,
    needsReview: true
  }));
}

function makeSpeakingAudioSegments(audioAssets, questionCount = 11) {
  const audio = audioAssets[0];
  if (!audio || !audio.durationSeconds || questionCount === 0) return [];
  const segmentLength = audio.durationSeconds / questionCount;
  return Array.from({ length: questionCount }, (_, index) => {
    const questionNumber = index + 1;
    return {
      id: `speaking-segment-q${questionNumber}`,
      assetId: audio.assetId,
      startSeconds: Number((index * segmentLength).toFixed(3)),
      endSeconds: Number(((index + 1) * segmentLength).toFixed(3)),
      sectionId: "speaking",
      moduleId: "speaking-m1",
      stimulusId: `speaking-q${questionNumber}-stimulus`,
      questionIds: [`speaking-q${questionNumber}`],
      segmentType: questionNumber <= 7 ? "repeat_prompt" : "interview_prompt",
      order: questionNumber,
      confidence: 0.35,
      needsReview: true
    };
  });
}

function textForImages(sectionDoc, ocrByAsset) {
  return sectionDoc.blocks.map((block) => block.type === "image" ? ocrByAsset[block.assetId]?.fullText || "" : block.text || "").join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function tokenId(questionId, text) {
  return `${questionId}-token-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "token"}`;
}

function sentenceTokens(questionId, texts) {
  return texts.map((text, index) => ({ id: tokenId(questionId, text), text, order: index + 1 }));
}

function correctOrder(tokens, orderedTexts) {
  const byText = new Map(tokens.map((token) => [token.text.toLowerCase(), token.id]));
  return orderedTexts.map((text) => byText.get(text.toLowerCase())).filter(Boolean);
}

function buildSentenceText({ fixedPrefix = "", fixedSuffix = "", tokens, correctTokenOrder }) {
  const byId = new Map(tokens.map((token) => [token.id, token.text]));
  return [fixedPrefix, ...correctTokenOrder.map((id) => byId.get(id)).filter(Boolean), fixedSuffix].filter(Boolean).join(" ").replace(/\s+([.,!?;:])/g, "$1").replace(/\s+/g, " ").trim();
}

function validateBuildSentenceQuestion(question) {
  const tokens = Array.isArray(question.config?.tokens) ? question.config.tokens : [];
  const order = Array.isArray(question.config?.correctTokenOrder) ? question.config.correctTokenOrder : [];
  const ids = tokens.map((token) => token.id);
  const idSet = new Set(ids);
  const orderSet = new Set(order);
  const issues = [];
  if (!tokens.length) issues.push("tokens_empty");
  if (tokens.length > 15) issues.push("token_count_too_high");
  if (tokens.some((token) => !String(token.text || "").trim())) issues.push("empty_token");
  if (idSet.size !== ids.length) issues.push("duplicate_token_id");
  if (order.some((id) => !idSet.has(id))) issues.push("correct_order_references_missing_token");
  if (orderSet.size !== order.length) issues.push("duplicate_correct_order_token");
  if (order.length && order.length !== tokens.length) issues.push("correct_order_token_count_mismatch");
  const fixedSuffix = String(question.config?.fixedSuffix || "").replace(/[.,!?;:]+$/, "").toLowerCase();
  if (fixedSuffix && tokens.some((token) => token.text.toLowerCase() === fixedSuffix)) issues.push("fixed_suffix_repeated_in_tokens");
  return issues;
}

function writingAnswerLines(answerText) {
  return answerText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "写作")
    .map((line) => line.replace(/\btha thas\b/i, "that has"));
}

async function cropImage({ sourcePath, outputPath, region }) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  try {
    const sharp = (await import("sharp")).default;
    await sharp(sourcePath)
      .extract({
        left: Math.max(0, Math.round(region.x)),
        top: Math.max(0, Math.round(region.y)),
        width: Math.max(1, Math.round(region.width)),
        height: Math.max(1, Math.round(region.height))
      })
      .toFile(outputPath);
    return;
  } catch {
    // Fall back to platform tools when sharp is unavailable.
  }
  if (commandExists("sips")) {
    const result = spawnSync("sips", [
      "-c",
      String(Math.round(region.height)),
      String(Math.round(region.width)),
      "--cropOffset",
      String(Math.round(region.y)),
      String(Math.round(region.x)),
      sourcePath,
      "--out",
      outputPath
    ], { encoding: "utf8" });
    if (result.status === 0) return;
  }
  await cp(sourcePath, outputPath);
}

async function imageSize(filePath) {
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(filePath).metadata();
    if (metadata.width && metadata.height) return { width: metadata.width, height: metadata.height };
  } catch {
    // Fall through to a conservative default; cropImage will copy if needed.
  }
  return { width: 1200, height: 900 };
}

async function compositeImage({ sourcePath, outputPath, width, height, parts }) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  try {
    const sharp = (await import("sharp")).default;
    const inputs = await Promise.all(parts.map(async (part) => ({
      input: await sharp(sourcePath)
        .extract({
          left: Math.max(0, Math.round(part.x)),
          top: Math.max(0, Math.round(part.y)),
          width: Math.max(1, Math.round(part.width)),
          height: Math.max(1, Math.round(part.height))
        })
        .toBuffer(),
      left: Math.max(0, Math.round(part.left || 0)),
      top: Math.max(0, Math.round(part.top || 0))
    })));
    await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
      .composite(inputs)
      .png()
      .toFile(outputPath);
    return;
  } catch {
    // Fall back to a rectangular crop if image compositing is unavailable.
  }
  await cropImage({ sourcePath, outputPath, region: { x: 0, y: 0, width, height } });
}

function svgEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapSvgText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function renderWritingDiscussionStimulus({ outputPath }) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const width = 760;
  const lines = [
    { text: "Writing  |  Question 2 of 2", size: 28, weight: 500, y: 46 },
    { text: "Your professor is teaching a class on art history.", size: 28, y: 115 },
    { text: "Write a post responding to the professor's question.", size: 28, y: 155 },
    { text: "In your response, you should do the following.", size: 30, weight: 700, y: 235 },
    { text: "• Express and support your opinion.", size: 27, y: 310 },
    { text: "• Make a contribution to the discussion in your own words.", size: 27, y: 365, maxChars: 42 },
    { text: "An effective response will contain at least 100 words.", size: 27, y: 465, maxChars: 38 },
    { text: "Dr. Gupta", size: 28, y: 690, center: true },
    {
      text: "We've been discussing how different art forms affect people and communities. Consider these specific examples: protest songs that motivate people to join movements, murals that bring communities together, or movies that change how people think about important issues. Some people argue that art creates change by making people aware of problems and motivating them to act. Others believe art simply shows what already exists in society without actually changing anything. Which view do you agree with. Why?",
      size: 27,
      y: 775,
      maxChars: 48
    }
  ];
  const textNodes = [];
  for (const item of lines) {
    const wrapped = item.maxChars ? wrapSvgText(item.text, item.maxChars) : [item.text];
    wrapped.forEach((line, index) => {
      const y = item.y + index * Math.round((item.size || 26) * 1.45);
      textNodes.push(`<text x="${item.center ? width / 2 : 24}" y="${y}" ${item.center ? "text-anchor=\"middle\"" : ""} font-size="${item.size || 26}" font-weight="${item.weight || 400}">${svgEscape(line)}</text>`);
    });
  }
  const svg = `
    <svg width="${width}" height="1260" viewBox="0 0 ${width} 1260" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <line x1="0" y1="68" x2="${width}" y2="68" stroke="#6b7280" stroke-width="2"/>
      <circle cx="${width / 2}" cy="555" r="82" fill="#d7e7dd"/>
      <circle cx="${width / 2}" cy="532" r="34" fill="#263238"/>
      <rect x="${width / 2 - 52}" y="572" width="104" height="80" rx="40" fill="#263238"/>
      <g font-family="Arial, Helvetica, sans-serif" fill="#111827">${textNodes.join("\n")}</g>
    </svg>`;
  const sharp = (await import("sharp")).default;
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

const LISTENING_CHOOSE_RESPONSE_FIXTURES = {
  1: [
    "That classroom is in the administration building.",
    "No, interest rates have gone up.",
    "Generally around four p.m.—why?",
    "Yes, I learned so much."
  ],
  2: [
    "The membership dues.",
    "The auditorium on the second floor.",
    "Last night it rained a lot.",
    "At least five said they would come."
  ],
  3: [
    "It's a requirement for the class.",
    "It starts in twenty minutes.",
    "The professor said there will be a quiz afterwards.",
    "A professor from another university."
  ],
  4: [
    "What size did you buy?",
    "It was a good-looking design.",
    "I'll give him the list of what we need.",
    "This year it starts earlier than usual."
  ],
  5: [
    "I've been there once.",
    "I've been too busy to organize it.",
    "The new furniture looks great.",
    "It should arrive tomorrow."
  ],
  6: [
    "It's a device that runs on solar power.",
    "Yes, they usually go out to eat.",
    "I thought it was a powerful speech.",
    "It looks like the streetlights outside the dorm are still on."
  ],
  7: [
    "He works at a call center.",
    "Here's a bus token.",
    "The one that leaves from Maple Street Station.",
    "The last stop before Springfield."
  ],
  8: [
    "It's within the hour.",
    "It connects through London.",
    "The train goes to the airport.",
    "We need to wait for our luggage."
  ],
  9: [
    "All student leaders.",
    "Everyone must register online.",
    "The conference will be recorded.",
    "Try registering next year."
  ],
  10: [
    "Yes, I think it is.",
    "A very noisy concert.",
    "Sure, sorry about that.",
    "No, I'm not going to return it."
  ],
  11: [
    "I need help.",
    "Please clean your desk.",
    "No, I have other plans.",
    "Yes, I got the invite."
  ],
  12: [
    "My order was placed yesterday.",
    "Let's check in the main office.",
    "There are a lot of new clubs this year.",
    "One box and four bags."
  ]
};

const LISTENING_MAIN_CHOICE_FIXTURES = {
  ...LISTENING_CHOOSE_RESPONSE_FIXTURES,
  13: {
    prompt: "How does the man respond when the woman mentions her trip to Europe?",
    options: ["By sharing his own experience", "By expressing surprise", "By requesting some information", "By giving her some advice"]
  },
  14: {
    prompt: "Why does the woman mention Los Angeles?",
    options: ["To express agreement with the man", "To identify a place she would like to visit next", "To emphasize the importance of booking accommodations in advance", "To point out a negative experience that she had"]
  },
  15: {
    prompt: "What is the man looking to buy?",
    options: ["A gift for his cousin", "A suit for a wedding", "A new pair of shoes", "A wedding ring"]
  },
  16: {
    prompt: "Why does the woman mention her brother?",
    options: ["He had a good experience at a boutique.", "He is getting married this weekend.", "He just got a new job.", "He can lend the man a suit."]
  },
  17: {
    prompt: "What are the man and the woman talking about?",
    options: ["The location of a new park", "Their favorite types of music", "Their plans to attend an event", "The best places to listen to music"]
  },
  18: {
    prompt: "What does the man imply when he says, \"I'll bring a blanket too\"?",
    options: ["He is worried that the night gets cold.", "He thinks the tickets are too expensive.", "He would like a seat close to the stage.", "He will sit in the grass with the woman's friends."]
  },
  19: {
    prompt: "What is the main purpose of the announcement?",
    options: ["To provide tips for writing a research paper", "To invite students to an event", "To highlight feedback from previous students", "To encourage students to meet new people"]
  },
  20: {
    prompt: "What does the speaker imply about the writing mentor program?",
    options: ["This is the first year it has been offered.", "Mentors are only available on Tuesdays.", "Students have generally found it helpful.", "Only students who love to write can benefit from it."]
  },
  21: {
    prompt: "What is the purpose of the announcement?",
    options: ["To ask for volunteers", "To give information about a museum's history", "To explain the plan for a tour", "To request donations"]
  },
  22: {
    prompt: "What will the speaker probably do next?",
    options: ["Take students to the next floor", "Discuss an artist", "Collect feedback from visitors", "Hand out some printed information"]
  },
  23: {
    prompt: "What can be inferred about the purpose of the student fair?",
    options: ["Its purpose is to promote awareness of diverse cultures.", "Its purpose is to give students a study break during exams.", "Its purpose is to provide exposure to local artists.", "Its purpose is to honor student excellence."]
  },
  24: {
    prompt: "Why should students present their student IDs?",
    options: ["To receive a commemorative T-shirt", "To receive free entry", "To receive international street food", "To receive a guest pass for a friend"]
  },
  25: {
    prompt: "What is the purpose of the talk?",
    options: ["To show how easy it is to conduct a physics experiment", "To describe the discovery of a law of physics", "To explain two physical forces acting on a moving bicycle", "To offer reasons why many physicists like bicycle riding"]
  },
  26: {
    prompt: "What does the speaker suggest about turning?",
    options: ["It is more complicated than it seems.", "It is the hardest skill to learn.", "It is easier to turn right than left.", "It is important to go slowly."]
  },
  27: {
    prompt: "What does leaning in help a cyclist to do?",
    options: ["Go faster", "Avoid falling down", "See more clearly around corners", "Prevent uneven wear on the wheels"]
  },
  28: {
    prompt: "What do professional cyclists try to do when turning?",
    options: ["Slide out significantly on some turns in the road", "Keep their bikes relatively upright at high speeds", "Shift their weight just enough to work against inertia", "Change the direction of only their front wheel"]
  },
  29: {
    prompt: "What is the main focus of the talk?",
    options: ["The historical origins of Cubism", "How Cubism changed the world of art", "Some similarities between architecture and Cubist art", "Some examples of Cubist paintings"]
  },
  30: {
    prompt: "Why does the speaker mention a coffee cup?",
    options: ["To provide a visual example of Cubist techniques", "To highlight the influence of coffee on European artists", "To identify a painting on which two Cubist artists worked together", "To identify a common subject in many Cubist paintings"]
  },
  31: {
    prompt: "What does the speaker say about the initial reception of Cubism?",
    options: ["It quickly became popular among the general public.", "It was not received well by some critics.", "It became a topic in music and literature.", "It was compared to another artistic style."]
  },
  32: {
    prompt: "Why does the speaker mention Modernism?",
    options: ["To contrast its conceptual ideas with those of Cubism", "To help students understand Cubist goals", "To emphasize how influential Cubism was", "To highlight the variety of ways in which Cubist paintings can be understood"]
  }
};

const LISTENING_EXTRA_CHOICE_FIXTURES = {
  1: { prompt: "Choose the best response.", options: ["We might need to rearrange the chairs.", "Yes, it was great to see everyone.", "Let's try it on Thursday.", "Class starts in an hour."] },
  2: { prompt: "Choose the best response.", options: ["I enjoyed our conversation.", "I had a meeting yesterday.", "What time is lunch?", "Yes, the forecast states clear skies."] },
  3: { prompt: "Choose the best response.", options: ["I have a degree in art history.", "You mean the one over at the East Campus?", "The artist's talk is free, isn't it?", "The brick building across the street from the gallery."] },
  4: { prompt: "What does the man say about the chocolate mousse cake?", options: ["It was sold out.", "It was created by a new chef.", "Its price went up recently.", "It was a popular item."] },
  5: { prompt: "Why does the woman mention her guests?", options: ["To suggest that one of them is bringing dessert", "To show why she is careful about choosing desserts", "To note that she received a cake recipe from one of them", "To explain where she heard about a bakery"] },
  6: { prompt: "What is the man's attitude toward his woodworking class?", options: ["He is surprised that he enjoys the lectures.", "He is hopeful that future classes will be in a studio.", "He is doubtful that the university will continue to offer the class.", "He is disappointed that the class has a large number of students."] },
  7: { prompt: "What does the man imply about next semester?", options: ["He will take classes with lots of studio time.", "He will take fewer classes than this semester.", "He will probably transfer to another university.", "He is unlikely to take another class with Professor Williams."] },
  8: { prompt: "What is the main topic of the talk?", options: ["Chemical reactions that occur within soap bubbles", "How light produces shifting colors on certain surfaces", "How research on the behavior of light in science has evolved", "The drawbacks and benefits of using soap bubbles in experiments"] },
  9: { prompt: "According to the talk, what must happen to light waves for constructive interference to occur?", options: ["They must cancel each other out.", "They must be absorbed by the bubble.", "They must align to amplify their effects.", "They must reflect only from the outer surface."] },
  10: { prompt: "According to the talk, why do the colors on a soap bubble keep shifting?", options: ["Because air currents scatter the light unevenly", "Because pigments inside the bubble move around", "Because the bubble absorbs different colors as it grows larger", "Because certain features of the light and the bubble keep changing"] },
  11: { prompt: "Why does the speaker mention the fragility of soap bubbles?", options: ["To highlight a challenge in mimicking soap bubble designs", "To provide an example of the inefficiency of designs in nature", "To explain why soap bubbles are used in scientific experiments", "To suggest that soap bubbles can actually be used to create durable materials"] },
  12: { prompt: "What is the main topic of the talk?", options: ["The ways that a sea creature changes its appearance", "The ways that predators react to surprising behaviors", "The ways that different animals capture prey", "The ways that different species use dynamic mimicry"] },
  13: { prompt: "Why does the speaker discuss the owl butterfly?", options: ["To point out a limitation of dynamic mimicry", "To highlight a hunting technique used by owls", "To distinguish between two kinds of mimicry", "To explain how mimicry can confuse experienced researchers"] },
  14: { prompt: "What does the speaker say is a limitation of changing shape?", options: ["It sometimes does not result in the intended shape.", "It is not enough by itself to protect an animal from a predator.", "It requires a significant amount of time.", "It can quickly make muscles become tired."] },
  15: { prompt: "Why does the speaker mention balloons?", options: ["To describe the pattern on a butterfly's wings", "To show how camera equipment was raised and lowered", "To explain how certain cells function in the mimic octopus", "To emphasize how flexible the flatfish's muscles are"] }
};

const LISTENING_MAIN_IMAGE_INDEX_BY_QUESTION = Object.fromEntries([
  ...Array.from({ length: 12 }, (_, index) => [index + 1, index + 1]),
  [13, 14], [14, 15], [15, 17], [16, 18], [17, 20], [18, 21], [19, 23], [20, 24], [21, 26], [22, 27], [23, 29], [24, 30], [25, 32], [26, 33], [27, 34], [28, 35], [29, 37], [30, 38], [31, 39], [32, 40]
]);

const LISTENING_EXTRA_IMAGE_INDEX_BY_QUESTION = {
  1: 42, 2: 43, 3: 44, 4: 46, 5: 47, 6: 49, 7: 50, 8: 52, 9: 53, 10: 54, 11: 55, 12: 57, 13: 58, 14: 59, 15: 60
};

function choiceOptionId(questionId, label) {
  return `${questionId}-option-${label.toLowerCase()}`;
}

function listeningOptions(questionId, texts) {
  return texts.map((text, index) => {
    const label = String.fromCharCode(65 + index);
    return { id: choiceOptionId(questionId, label), label, text };
  });
}

function isPlaceholderPrompt(value = "") {
  return /^Listening question \d+$/i.test(value) || /^Listening \| Question \d+ of \d+$/i.test(value) || /^Question \d+$/i.test(value);
}

function isPlaceholderOption(value = "") {
  return /^Option [A-D]$/i.test(value);
}

function buildListening(doc, audioAssets, answers, extraAnswers = new Map(), ocrByAsset, options = {}) {
  const mainFixtures = options.useReferenceFixtures ? LISTENING_MAIN_CHOICE_FIXTURES : {};
  const extraFixtures = options.useReferenceFixtures ? LISTENING_EXTRA_CHOICE_FIXTURES : {};
  const imageBlocks = doc.blocks.filter((block) => block.type === "image");
  const specs = [
    ...Array.from({ length: answers.size || 32 }, (_, index) => {
      const number = index + 1;
      return { number, moduleId: "listening-m1", id: `listening-q${number}`, answer: answers.get(number), fixture: mainFixtures[number], imageIndex: options.useReferenceFixtures ? LISTENING_MAIN_IMAGE_INDEX_BY_QUESTION[number] : number };
    }),
    ...Array.from({ length: extraAnswers.size || 0 }, (_, index) => {
      const number = index + 1;
      return { number, moduleId: "listening-m2", id: `listening-m2-q${number}`, answer: extraAnswers.get(number), fixture: extraFixtures[number], imageIndex: options.useReferenceFixtures ? LISTENING_EXTRA_IMAGE_INDEX_BY_QUESTION[number] : number };
    })
  ];
  const count = specs.length;
  const questions = [];
  const segments = makeAudioSegments("listening", audioAssets, count, "single_prompt");
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const image = imageBlocks[(spec.imageIndex || spec.number) - 1] || imageBlocks[imageBlocks.length - 1];
    const segment = segments[index];
    if (segment) {
      segment.moduleId = spec.moduleId;
      segment.stimulusId = `${spec.id}-stimulus`;
      segment.questionIds = [spec.id];
    }
    const audioGroupId = segment ? segment.id : undefined;
    const ocrText = image ? (ocrByAsset[image.assetId]?.fullText || "") : "";
    const fixtureOptions = Array.isArray(spec.fixture) ? spec.fixture : spec.fixture?.options;
    const prompt = Array.isArray(spec.fixture) ? "Choose the best response." : spec.fixture?.prompt || (ocrText.split(/\n/).find((line) => line.trim().length > 8) || "Options have not been extracted yet.");
    questions.push(optionQuestion("listening", spec.moduleId, spec.number, prompt, spec.answer, doc.file, { questionId: spec.id, audioGroupId, imageAssetId: image?.assetId, options: fixtureOptions, confidence: fixtureOptions ? 0.86 : ocrText ? 0.58 : 0.35, needsReview: !fixtureOptions }));
  }
  const audioGroups = segments.map((segment) => ({ id: segment.id, title: `Listening audio segment ${segment.order}`, audioAssetId: segment.assetId, allowReplay: false, playLimit: 1, startSeconds: segment.startSeconds, endSeconds: segment.endSeconds, confidence: segment.confidence, needsReview: segment.needsReview }));
  return { questions, audioGroups, audioSegments: segments };
}

function buildWriting(doc, answerText, ocrByAsset) {
  const text = textForImages(doc, ocrByAsset);
  const referenceAnswerLines = writingAnswerLines(answerText);
  const imageBlocks = doc.blocks.filter((block) => block.type === "image");
  const buildSentenceSpecs = [
    { prompt: "What are you looking for in a new laptop?", fixedSuffix: "choice.", bank: ["is", "my", "battery life", "top", "the model", "that has", "the longest"], order: ["the model", "that has", "the longest", "battery life", "is", "my", "top"] },
    { prompt: "Why were you so late for class?", bank: ["I was", "that lasted", "hour", "a traffic jam", "an", "stuck in", "for"], order: ["I was", "stuck in", "a traffic jam", "that lasted", "for", "an", "hour"] },
    { prompt: "Why did you miss marching band practice yesterday?", bank: ["I had", "reschedule", "another", "I couldn't", "that", "appointment"], order: ["I had", "another", "appointment", "that", "I couldn't", "reschedule"] },
    { prompt: "What do you think of the new library?", bank: ["to the library", "make it", "the recent", "look", "renovations", "very impressive"], order: ["the recent", "renovations", "to the library", "make it", "look", "very impressive"] },
    { prompt: "Why didn't you call me yesterday?", bank: ["the library", "test", "at", "my calculus", "studying for", "I was"], order: ["I was", "studying for", "my calculus", "test", "at", "the library"] },
    { prompt: "Did you enjoy the new book you bought?", bank: ["the one", "the literary", "yes, it's", "that won", "year", "award last"], order: ["yes, it's", "the one", "that won", "the literary", "award last", "year"] },
    { prompt: "Is there a study group for chemistry class that you can recommend?", bank: ["Thursday afternoon", "is very helpful", "that meets every", "the group"], order: ["the group", "that meets every", "Thursday afternoon", "is very helpful"] },
    { prompt: "Why did you take the bus to campus this morning?", bank: ["the moment", "that I usually", "drive", "is", "in the shop", "at", "the car"], order: ["the car", "that I usually", "drive", "is", "in the shop", "at", "the moment"] },
    { prompt: "Why didn't you answer your phone?", bank: ["I was", "late", "ran", "in", "a class", "that"], order: ["I was", "in", "a class", "that", "ran", "late"] },
    { prompt: "Are you going to the campus social this weekend?", bank: ["I have", "no", "plans to go"], order: ["I have", "no", "plans to go"] }
  ];
  const buildSentenceQuestions = buildSentenceSpecs.map((spec, index) => {
    const id = `writing-q${index + 1}`;
    const sourceImage = imageBlocks[index] || imageBlocks[0];
    const tokens = sentenceTokens(id, spec.bank);
    const correctTokenOrder = correctOrder(tokens, spec.order);
    const config = {
      context: text.slice(0, 4000),
      conversationPrompt: spec.prompt,
      fixedPrefix: "",
      fixedSuffix: spec.fixedSuffix || "",
      tokens,
      correctTokenOrder,
      correctText: buildSentenceText({ fixedSuffix: spec.fixedSuffix || "", tokens, correctTokenOrder }),
      referenceAnswerText: referenceAnswerLines[index] || "",
      punctuationPolicy: "normalized",
      imageAssetId: sourceImage?.assetId,
      sourceAssetId: sourceImage?.assetId,
      sourceRegion: sourceImage ? { sourceAssetId: sourceImage.assetId, questionNumber: index + 1, x: 0, y: 0, width: 1628, height: 1086 } : undefined,
      displayMode: "structured"
    };
    const question = makeQuestion({
      id,
      section: "writing",
      moduleId: "writing-m1",
      number: index + 1,
      type: "toefl.build_sentence",
      renderer: "toefl.renderer.build_sentence",
      scoring: "toefl.build_sentence",
      prompt: "Build a Sentence",
      stimulusId: sourceImage?.assetId ? `${id}-stimulus` : undefined,
      config,
      sourceFile: doc.file,
      confidence: 0.82,
      needsReview: false
    });
    question.source = {
      ...question.source,
      sourceAssetId: sourceImage?.assetId,
      region: config.sourceRegion
        ? { x: config.sourceRegion.x, y: config.sourceRegion.y, width: config.sourceRegion.width, height: config.sourceRegion.height }
        : undefined
    };
    const issues = validateBuildSentenceQuestion(question);
    if (issues.length) {
      question.needsReview = true;
      question.status = "reviewed";
      question.config.validationIssues = issues;
    }
    return question;
  });
  const writingTasks = [
    {
      type: "toefl.write_email",
      renderer: "toefl.renderer.text",
      scoring: "toefl.manual_or_ai",
      title: "Write an Email",
      image: imageBlocks[10] || imageBlocks[0],
      sourceRegion: { x: 0, y: 0, width: 650, height: 742 },
      responseFormat: "email"
    },
    {
      type: "toefl.academic_discussion",
      renderer: "toefl.renderer.text",
      scoring: "toefl.manual_or_ai",
      title: "Academic Discussion",
      image: imageBlocks[12] || imageBlocks[11] || imageBlocks[10] || imageBlocks[0],
      sourceRegion: { x: 0, y: 0, width: 660, height: 1356 },
      responseFormat: "academic_discussion"
    }
  ];
  const subjectiveQuestions = writingTasks.map((task, index) => {
    const id = `writing-q${buildSentenceQuestions.length + index + 1}`;
    const sourceRegion = task.image?.assetId
      ? { sourceAssetId: task.image.assetId, questionNumber: buildSentenceQuestions.length + index + 1, ...task.sourceRegion }
      : undefined;
    const question = makeQuestion({
      id,
      section: "writing",
      moduleId: "writing-m1",
      number: buildSentenceQuestions.length + index + 1,
      type: task.type,
      renderer: task.renderer,
      scoring: task.scoring,
      prompt: task.title,
      stimulusId: task.image?.assetId ? `${id}-stimulus` : undefined,
      config: {
        context: "",
        imageAssetId: task.image?.assetId,
        sourceAssetId: task.image?.assetId,
        sourceRegion,
        responseFormat: task.responseFormat,
        displayMode: task.image?.assetId ? "structured" : "source_image_fallback"
      },
      sourceFile: doc.file,
      confidence: task.image?.assetId ? 0.74 : 0.4,
      needsReview: !task.image?.assetId,
      assetIds: task.image?.assetId ? [task.image.assetId] : []
    });
    question.source = {
      ...question.source,
      sourceAssetId: task.image?.assetId,
      region: sourceRegion
        ? { x: sourceRegion.x, y: sourceRegion.y, width: sourceRegion.width, height: sourceRegion.height }
        : undefined
    };
    return question;
  });
  return [...buildSentenceQuestions, ...subjectiveQuestions];
}

function buildSpeaking(doc, audioAssets, referenceText, ocrByAsset) {
  const imageBlocks = doc.blocks.filter((block) => block.type === "image");
  const expectedQuestionCount = 11;
  const questions = [];
  const segments = makeSpeakingAudioSegments(audioAssets, expectedQuestionCount);
  const audioGroups = segments.map((segment) => ({ id: segment.id, title: `Speaking question ${segment.order} audio`, audioAssetId: segment.assetId, allowReplay: true, playLimit: 1, startSeconds: segment.startSeconds, endSeconds: segment.endSeconds, confidence: segment.confidence, needsReview: segment.needsReview }));
  const taskGroups = [
    {
      id: "speaking-listen-repeat",
      type: "toefl.listen_repeat_group",
      title: "Listen and Repeat",
      instructions: { type: "plain_text", text: "Listen and repeat only once." },
      stimulusId: imageBlocks[0]?.assetId ? "speaking-listen-repeat-stimulus" : undefined,
      questionIds: Array.from({ length: 7 }, (_, index) => `speaking-q${index + 1}`)
    },
    {
      id: "speaking-interview",
      type: "toefl.interview_group",
      title: "Take an Interview",
      instructions: { type: "plain_text", text: "Answer each interviewer question separately." },
      stimulusId: imageBlocks[8]?.assetId ? "speaking-interview-stimulus" : undefined,
      questionIds: Array.from({ length: 4 }, (_, index) => `speaking-q${index + 8}`)
    }
  ];
  for (let index = 1; index <= expectedQuestionCount; index += 1) {
    const isListenRepeat = index <= 7;
    const image = isListenRepeat
      ? imageBlocks[index] || imageBlocks[Math.min(index - 1, imageBlocks.length - 1)]
      : imageBlocks[8] || imageBlocks[imageBlocks.length - 1];
    const text = image ? ocrByAsset[image.assetId]?.fullText || "" : referenceText;
    const segment = segments[index - 1];
    const taskGroupId = isListenRepeat ? "speaking-listen-repeat" : "speaking-interview";
    questions.push(makeQuestion({
      id: `speaking-q${index}`,
      section: "speaking",
      moduleId: "speaking-m1",
      number: index,
      type: isListenRepeat ? "toefl.listen_repeat" : "toefl.interview_response",
      renderer: "toefl.renderer.recording",
      scoring: "toefl.manual_or_ai",
      prompt: isListenRepeat ? "Listen and Repeat" : "Take an Interview",
      stimulusId: image?.assetId ? `speaking-q${index}-stimulus` : undefined,
      config: {
        context: text.slice(0, 2000),
        taskGroupId,
        audioGroupId: segment?.id,
        audioSegmentId: segment?.id,
        imageAssetId: image?.assetId,
        sourceAssetId: image?.assetId,
        detectedSourceQuestionNumber: index,
        preparationSeconds: isListenRepeat ? 0 : 15,
        responseSeconds: isListenRepeat ? 8 : 45,
        playLimit: 1,
        allowReplayInPractice: true,
        recordingKey: `speaking-q${index}`,
        displayMode: image?.assetId ? "structured" : "source_image_fallback"
      },
      sourceFile: doc.file,
      confidence: image?.assetId && segment ? 0.72 : 0.42,
      needsReview: !image?.assetId || !segment,
      assetIds: image?.assetId ? [image.assetId] : []
    }));
  }
  return { questions, audioGroups, audioSegments: segments, taskGroups, expectedQuestionCount };
}

async function applyWritingStimulusCrops({ questions, assets, generatedDir, examId }) {
  const writingQuestions = questions.filter((question) => question.sectionId === "writing" && question.config?.sourceRegion && question.config?.sourceAssetId);
  const derivedAssets = [];
  for (const question of writingQuestions) {
    const sourceAsset = assets.find((asset) => asset.id === question.config.sourceAssetId);
    if (!sourceAsset) {
      question.needsReview = true;
      question.status = "reviewed";
      question.config.validationIssues = [...(question.config.validationIssues || []), "missing_source_asset_for_crop"];
      continue;
    }
    const region = question.config.sourceRegion;
    const sourcePath = path.join(path.dirname(generatedDir), sourceAsset.relativePath);
    const fileName = `${question.id}-stimulus.png`;
    const output = path.join(generatedDir, "derived-assets", "writing", fileName);
    if (question.id === "writing-q12") await renderWritingDiscussionStimulus({ outputPath: output });
    else await cropImage({ sourcePath, outputPath: output, region });
    const hash = await fileHash(output);
    const assetId = `${examId}-${question.id}-stimulus-${hash.slice(0, 8)}`;
    const relativePath = path.relative(path.dirname(generatedDir), output).split(path.sep).join("/");
    question.config.originalImageAssetId = question.config.imageAssetId;
    question.config.imageAssetId = assetId;
    question.assetIds = [assetId];
    question.stimulusId = `${question.id}-stimulus`;
    derivedAssets.push({
      id: assetId,
      examId,
      type: "image",
      fileName,
      relativePath,
      mimeType: "image/png",
      metadata: {
        section: "writing",
        role: "stimulus",
        derivedFrom: sourceAsset.id,
        questionId: question.id,
        questionNumber: question.number,
        cropRegion: region,
        hash
      }
    });
  }
  return derivedAssets;
}

async function applyReadingStimulusCrops({ questions, assets, generatedDir, examId }) {
  const cropRegionsByQuestion = {
    "reading-m1-q21": {
      x: 0,
      y: 0,
      width: 1050,
      height: 884,
      parts: [
        { x: 0, y: 0, width: 1050, height: 260, left: 0, top: 0 },
        { x: 0, y: 260, width: 800, height: 624, left: 0, top: 260 }
      ]
    },
    "reading-m1-q22": {
      x: 0,
      y: 0,
      width: 930,
      height: 772,
      parts: [
        { x: 0, y: 0, width: 930, height: 240, left: 0, top: 0 },
        { x: 0, y: 240, width: 760, height: 532, left: 0, top: 240 }
      ]
    },
    "reading-m1-q23": {
      x: 0,
      y: 0,
      width: 930,
      height: 770,
      parts: [
        { x: 0, y: 0, width: 930, height: 240, left: 0, top: 0 },
        { x: 0, y: 240, width: 760, height: 530, left: 0, top: 240 }
      ]
    },
    "reading-m1-q24": {
      x: 0,
      y: 0,
      width: 930,
      height: 772,
      parts: [
        { x: 0, y: 0, width: 930, height: 240, left: 0, top: 0 },
        { x: 0, y: 240, width: 760, height: 532, left: 0, top: 240 }
      ]
    },
    "reading-m1-q25": {
      x: 0,
      y: 0,
      width: 930,
      height: 992,
      parts: [
        { x: 0, y: 0, width: 930, height: 240, left: 0, top: 0 },
        { x: 0, y: 240, width: 760, height: 752, left: 0, top: 240 }
      ]
    },
    "reading-m1-q26": {
      x: 0,
      y: 0,
      width: 930,
      height: 1028,
      parts: [
        { x: 0, y: 0, width: 930, height: 240, left: 0, top: 0 },
        { x: 0, y: 240, width: 760, height: 788, left: 0, top: 240 }
      ]
    },
    "reading-m1-q27": {
      x: 0,
      y: 0,
      width: 930,
      height: 1014,
      parts: [
        { x: 0, y: 0, width: 930, height: 240, left: 0, top: 0 },
        { x: 0, y: 240, width: 760, height: 774, left: 0, top: 240 }
      ]
    },
    "reading-m1-q28": {
      x: 0,
      y: 0,
      width: 760,
      height: 886,
      parts: [
        { x: 0, y: 0, width: 760, height: 120, left: 0, top: 0 },
        { x: 0, y: 120, width: 560, height: 766, left: 0, top: 120 }
      ]
    },
    "reading-m1-q29": {
      x: 0,
      y: 0,
      width: 760,
      height: 876,
      parts: [
        { x: 0, y: 0, width: 760, height: 120, left: 0, top: 0 },
        { x: 0, y: 120, width: 560, height: 756, left: 0, top: 120 }
      ]
    },
    "reading-m1-q30": {
      x: 0,
      y: 0,
      width: 760,
      height: 890,
      parts: [
        { x: 0, y: 0, width: 760, height: 120, left: 0, top: 0 },
        { x: 0, y: 120, width: 560, height: 770, left: 0, top: 120 }
      ]
    },
    "reading-m1-q31": {
      x: 0,
      y: 0,
      width: 1050,
      height: 1234,
      parts: [
        { x: 0, y: 0, width: 1050, height: 230, left: 0, top: 0 },
        { x: 0, y: 230, width: 735, height: 1004, left: 0, top: 230 }
      ]
    },
    "reading-m1-q32": {
      x: 0,
      y: 0,
      width: 1050,
      height: 1240,
      parts: [
        { x: 0, y: 0, width: 1050, height: 230, left: 0, top: 0 },
        { x: 0, y: 230, width: 735, height: 1010, left: 0, top: 230 }
      ]
    },
    "reading-m1-q33": {
      x: 0,
      y: 0,
      width: 1050,
      height: 1224,
      parts: [
        { x: 0, y: 0, width: 1050, height: 230, left: 0, top: 0 },
        { x: 0, y: 230, width: 735, height: 994, left: 0, top: 230 }
      ]
    },
    "reading-m1-q34": {
      x: 0,
      y: 0,
      width: 1050,
      height: 1246,
      parts: [
        { x: 0, y: 0, width: 1050, height: 230, left: 0, top: 0 },
        { x: 0, y: 230, width: 735, height: 1016, left: 0, top: 230 }
      ]
    },
    "reading-m1-q35": {
      x: 0,
      y: 0,
      width: 1050,
      height: 1244,
      parts: [
        { x: 0, y: 0, width: 1050, height: 220, left: 0, top: 0 },
        { x: 0, y: 220, width: 735, height: 1024, left: 0, top: 220 }
      ]
    }
  };
  const derivedAssets = [];
  for (const question of questions) {
    const regionTemplate = cropRegionsByQuestion[question.id];
    const sourceAssetId = question.config?.sourceAssetId || question.config?.imageAssetId;
    if (!regionTemplate || !sourceAssetId) continue;
    const sourceAsset = assets.find((asset) => asset.id === sourceAssetId);
    if (!sourceAsset) {
      question.needsReview = true;
      question.status = "reviewed";
      question.config.validationIssues = [...(question.config.validationIssues || []), "missing_source_asset_for_reading_crop"];
      continue;
    }
    const region = { sourceAssetId, questionNumber: question.number, ...regionTemplate };
    const sourcePath = path.join(path.dirname(generatedDir), sourceAsset.relativePath);
    const fileName = `${question.id}-stimulus.png`;
    const output = path.join(generatedDir, "derived-assets", "reading", fileName);
    if (Array.isArray(regionTemplate.parts)) await compositeImage({ sourcePath, outputPath: output, width: regionTemplate.width, height: regionTemplate.height, parts: regionTemplate.parts });
    else await cropImage({ sourcePath, outputPath: output, region });
    const hash = await fileHash(output);
    const assetId = `${examId}-${question.id}-stimulus-${hash.slice(0, 8)}`;
    const relativePath = path.relative(path.dirname(generatedDir), output).split(path.sep).join("/");
    question.config.originalImageAssetId = question.config.imageAssetId;
    question.config.imageAssetId = assetId;
    question.config.sourceRegion = region;
    question.assetIds = [assetId];
    question.stimulusId = `${question.id}-stimulus`;
    derivedAssets.push({
      id: assetId,
      examId,
      type: "image",
      fileName,
      relativePath,
      mimeType: "image/png",
      metadata: {
        section: "reading",
        role: "passage_stimulus",
        derivedFrom: sourceAsset.id,
        questionId: question.id,
        questionNumber: question.number,
        cropRegion: region,
        hash
      }
    });
  }
  return derivedAssets;
}

async function applyGenericReadingImageCrops({ questions, assets, generatedDir, examId }) {
  const derivedAssets = [];
  const readingChoiceQuestions = questions.filter((question) => question.sectionId === "reading" && question.rendererId === "toefl.renderer.choice" && question.config?.sourceAssetId);
  for (const question of readingChoiceQuestions) {
    const sourceAsset = assets.find((asset) => asset.id === question.config.sourceAssetId);
    if (!sourceAsset) continue;
    const sourcePath = path.join(path.dirname(generatedDir), sourceAsset.relativePath);
    const size = await imageSize(sourcePath);
    const titleHeight = Math.round(size.height * 0.20);
    const materialWidth = Math.round(size.width * 0.50);
    const region = { x: 0, y: 0, width: size.width, height: size.height, sourceAssetId: sourceAsset.id, questionNumber: question.number };
    const fileName = `${question.id}-material.png`;
    const output = path.join(generatedDir, "derived-assets", "reading", fileName);
    await compositeImage({
      sourcePath,
      outputPath: output,
      width: size.width,
      height: size.height,
      parts: [
        { x: 0, y: 0, width: size.width, height: titleHeight, left: 0, top: 0 },
        { x: 0, y: titleHeight, width: materialWidth, height: size.height - titleHeight, left: 0, top: titleHeight }
      ]
    });
    const hash = await fileHash(output);
    const assetId = `${examId}-${question.id}-material-${hash.slice(0, 8)}`;
    const relativePath = path.relative(path.dirname(generatedDir), output).split(path.sep).join("/");
    question.config.originalImageAssetId = question.config.imageAssetId;
    question.config.imageAssetId = assetId;
    question.config.sourceRegion = region;
    question.assetIds = [assetId];
    question.stimulusId = `${question.id}-stimulus`;
    derivedAssets.push({
      id: assetId,
      examId,
      type: "image",
      fileName,
      relativePath,
      mimeType: "image/png",
      metadata: { section: "reading", role: "material_image", derivedFrom: sourceAsset.id, questionId: question.id, questionNumber: question.number, cropRegion: region, hash }
    });
  }
  return derivedAssets;
}

async function applyManualListeningCorrections({ questions, assets, generatedDir, examId }) {
  const derivedAssets = [];
  const speakerRegion = { x: 95, y: 190, width: 620, height: 720 };
  const structuredListeningQuestions = questions.filter((item) => item.sectionId === "listening" && Array.isArray(item.config?.options) && item.config.options.length > 0);
  for (const question of structuredListeningQuestions) {
    const number = question.number;
    const sourceAssetId = question?.config?.originalImageAssetId || question?.config?.sourceAssetId || question?.config?.imageAssetId;
    const sourceAsset = assets.find((asset) => asset.id === sourceAssetId);
    if (!question || !sourceAsset) continue;
    const sourcePath = path.join(path.dirname(generatedDir), sourceAsset.relativePath);
    const fileName = `${question.id}-speaker.png`;
    const output = path.join(generatedDir, "derived-assets", "listening", fileName);
    await cropImage({ sourcePath, outputPath: output, region: speakerRegion });
    const hash = await fileHash(output);
    const assetId = `${examId}-${question.id}-speaker-${hash.slice(0, 8)}`;
    const relativePath = path.relative(path.dirname(generatedDir), output).split(path.sep).join("/");
    const answerLabel = String(question.config.correctOptionId || "").match(/option-([a-d])$/i)?.[1] || "";
    question.prompt = question.prompt || { type: "plain_text", text: "Choose the best response." };
    question.questionType = "toefl.listen_choose_response";
    question.rendererId = "toefl.listening_choice";
    question.scoringStrategyId = "toefl.exact_single_choice";
    question.assetIds = [assetId];
    question.stimulusId = `${question.id}-stimulus`;
    question.config = {
      ...question.config,
      correctOptionId: answerLabel ? choiceOptionId(question.id, answerLabel) : undefined,
      audioSegmentId: question.config.audioGroupId,
      selectionMode: "single",
      originalImageAssetId: sourceAsset.id,
      imageAssetId: assetId,
      sourceAssetId: sourceAsset.id,
      sourceRegions: {
        speakerRegion,
        fullQuestionRegion: { x: 0, y: 0, width: 1628, height: 899 }
      },
      displayMode: "structured"
    };
    question.source = {
      ...question.source,
      sourceAssetId: sourceAsset.id,
      region: speakerRegion
    };
    question.confidence = Math.max(question.confidence || 0, 0.86);
    question.needsReview = !question.config.correctOptionId;
    question.status = question.needsReview ? "reviewed" : "published";
    derivedAssets.push({
      id: assetId,
      examId,
      type: "image",
      fileName,
      relativePath,
      mimeType: "image/png",
      metadata: { section: "listening", role: "speaker_image", derivedFrom: sourceAsset.id, questionId: question.id, questionNumber: number, cropRegion: speakerRegion, hash }
    });
  }
  return derivedAssets;
}

async function applyGenericListeningStimulusCrops({ questions, assets, generatedDir, examId }) {
  const derivedAssets = [];
  const listeningQuestions = questions.filter((item) => item.sectionId === "listening" && item.config?.sourceAssetId);
  for (const question of listeningQuestions) {
    const sourceAssetId = question.config.originalImageAssetId || question.config.sourceAssetId || question.config.imageAssetId;
    const sourceAsset = assets.find((asset) => asset.id === sourceAssetId);
    if (!sourceAsset) continue;
    const sourcePath = path.join(path.dirname(generatedDir), sourceAsset.relativePath);
    const size = await imageSize(sourcePath);
    const region = {
      x: Math.round(size.width * 0.07),
      y: Math.round(size.height * 0.14),
      width: Math.round(size.width * 0.42),
      height: Math.round(size.height * 0.70)
    };
    const fileName = `${question.id}-stimulus.png`;
    const output = path.join(generatedDir, "derived-assets", "listening", fileName);
    await cropImage({ sourcePath, outputPath: output, region });
    const hash = await fileHash(output);
    const assetId = `${examId}-${question.id}-stimulus-${hash.slice(0, 8)}`;
    const relativePath = path.relative(path.dirname(generatedDir), output).split(path.sep).join("/");
    question.assetIds = [assetId];
    question.stimulusId = `${question.id}-stimulus`;
    question.config = {
      ...question.config,
      originalImageAssetId: question.config.imageAssetId,
      imageAssetId: assetId,
      sourceAssetId,
      sourceRegions: { stimulusRegion: region, fullQuestionImage: true },
      displayMode: question.config.options?.length ? "structured" : "source_image_fallback"
    };
    question.source = { ...question.source, sourceAssetId, region };
    derivedAssets.push({
      id: assetId,
      examId,
      type: "image",
      fileName,
      relativePath,
      mimeType: "image/png",
      metadata: { section: "listening", role: "stimulus_image", derivedFrom: sourceAsset.id, questionId: question.id, questionNumber: question.number, cropRegion: region, hash }
    });
  }
  return derivedAssets;
}

function legacyQuestion(question) {
  const config = question.config || {};
  if (question.sectionId === "reading" && question.questionType.includes("complete_words")) {
    const blank = config.blanks[0];
    return { id: question.id, section: "reading", moduleId: question.moduleId, number: question.number, type: "complete_words", instructions: question.prompt?.text, passageId: question.stimulusId, blanks: [{ id: blank.id, prefix: blank.prefix, missingLength: blank.missingLength, suffix: "" }], correctAnswer: { type: "complete_words", values: config.correctValues }, explanation: config.explanation, confidence: question.confidence, needsReview: question.needsReview };
  }
  if (question.rendererId === "toefl.renderer.choice" || question.rendererId === "toefl.listening_choice") return { id: question.id, section: question.sectionId, moduleId: question.moduleId, number: question.number, type: question.questionType.includes("listen_choose_response") ? "listen_choose_response" : "single_choice", prompt: question.prompt?.text, audioGroupId: config.audioGroupId, imageAssetId: config.imageAssetId, assetIds: question.assetIds, displayMode: config.displayMode, options: config.options, correctAnswer: config.correctOptionId ? { type: question.questionType.includes("listen_choose_response") ? "listen_choose_response" : "single_choice", optionId: config.correctOptionId } : { type: "manual_or_ai" }, confidence: question.confidence, needsReview: question.needsReview };
  if (question.questionType.includes("build_sentence")) return { id: question.id, section: question.sectionId, moduleId: question.moduleId, number: question.number, type: "build_sentence", prompt: question.prompt?.text, instructions: config.context, conversationPrompt: config.conversationPrompt, fixedPrefix: config.fixedPrefix, fixedSuffix: config.fixedSuffix, wordBank: config.tokens, correctAnswer: Array.isArray(config.correctTokenOrder) ? { type: "build_sentence", tokens: config.correctTokenOrder } : { type: "manual_or_ai" }, imageAssetId: config.imageAssetId, assetIds: question.assetIds, displayMode: config.displayMode, confidence: question.confidence, needsReview: question.needsReview };
  return { id: question.id, section: question.sectionId, moduleId: question.moduleId, number: question.number, type: question.questionType.includes("academic_discussion") ? "academic_discussion" : question.questionType.includes("listen") ? "listen_repeat" : question.questionType.includes("interview") ? "interview_response" : "write_email", prompt: question.prompt?.text, instructions: config.context, audioGroupId: config.audioGroupId, imageAssetId: config.imageAssetId, assetIds: question.assetIds, displayMode: config.displayMode, preparationSeconds: config.preparationSeconds, responseSeconds: config.responseSeconds, correctAnswer: { type: "manual_or_ai" }, confidence: question.confidence, needsReview: question.needsReview };
}

function buildListeningQuestionAudit(questions, assets) {
  const assetIds = new Set(assets.map((asset) => asset.id));
  return questions
    .filter((question) => question.sectionId === "listening")
    .map((question) => {
      const options = Array.isArray(question.config.options) ? question.config.options : [];
      const prompt = question.prompt?.text || "";
      const warnings = [];
      const containsPlaceholder = isPlaceholderPrompt(prompt) || options.some((option) => isPlaceholderOption(option.text));
      const hasStimulusImage = Boolean(question.config.imageAssetId && assetIds.has(question.config.imageAssetId));
      const answerMatched = typeof question.config.correctOptionId === "string" && options.some((option) => option.id === question.config.correctOptionId);
      if (isPlaceholderPrompt(prompt)) warnings.push("placeholder_prompt");
      if (options.some((option) => isPlaceholderOption(option.text))) warnings.push("placeholder_option");
      if (!hasStimulusImage) warnings.push("missing_stimulus_image");
      if (options.length > 0 && options.length !== 4) warnings.push("unexpected_option_count");
      if (options.length > 0 && !answerMatched) warnings.push("answer_not_matched");
      if (!question.config.audioSegmentId && !question.config.audioGroupId) warnings.push("missing_audio_segment");
      return {
        questionId: question.id,
        sourceAssetId: question.config.sourceAssetId || question.config.originalImageAssetId || question.config.imageAssetId || "",
        sourceQuestionNumber: question.number,
        questionRegion: question.config.sourceRegions?.fullQuestionRegion,
        speakerRegion: question.config.sourceRegions?.speakerRegion || question.source?.region,
        prompt,
        optionCount: options.length,
        options: options.map((option) => option.text),
        stimulusId: question.stimulusId,
        hasStimulusImage,
        stimulusCreated: hasStimulusImage,
        answerMatched,
        audioSegmentId: question.config.audioSegmentId || question.config.audioGroupId || "",
        rendererId: question.rendererId,
        containsPlaceholder,
        needsReview: question.needsReview,
        warnings
      };
    });
}

function buildSpeakingQuestionAudit(questions, assets, audioSegments) {
  const assetIds = new Set(assets.map((asset) => asset.id));
  const segmentById = new Map(audioSegments.filter((segment) => segment.sectionId === "speaking").map((segment) => [segment.id, segment]));
  return questions
    .filter((question) => question.sectionId === "speaking")
    .map((question) => {
      const segmentId = question.config.audioSegmentId || question.config.audioGroupId || "";
      const segment = segmentById.get(segmentId);
      const hasStimulusImage = Boolean(question.config.imageAssetId && assetIds.has(question.config.imageAssetId));
      const warnings = [];
      if (!hasStimulusImage) warnings.push("missing_stimulus_image");
      if (!segment) warnings.push("missing_audio_segment");
      if (segment?.needsReview) warnings.push("audio_segment_boundary_needs_review");
      if (!question.rendererId.includes("recording")) warnings.push("missing_recording_renderer");
      return {
        questionId: question.id,
        questionNumber: question.number,
        questionType: question.questionType,
        taskGroupId: question.config.taskGroupId || "",
        stimulusId: question.stimulusId || "",
        sourceAssetId: question.config.sourceAssetId || question.config.imageAssetId || "",
        detectedSourceQuestionNumber: question.config.detectedSourceQuestionNumber || question.number,
        audioSegmentId: segmentId,
        segmentStart: segment?.startSeconds,
        segmentEnd: segment?.endSeconds,
        hasRecordingRenderer: question.rendererId === "toefl.renderer.recording",
        needsReview: question.needsReview || Boolean(segment?.needsReview),
        warnings
      };
    });
}

function buildReadingQuestionAudit(questions, assets, sourceFileName) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  return questions
    .filter((question) => question.sectionId === "reading")
    .map((question) => {
      const options = Array.isArray(question.config.options) ? question.config.options : [];
      const warnings = [];
      const sourceFile = question.source?.file || "";
      const sourceAssetId = question.config.sourceAssetId || question.config.imageAssetId || "";
      const sourceAsset = sourceAssetId ? assetById.get(sourceAssetId) : undefined;
      const isChoice = question.questionType.includes("choice");
      const isCompleteWords = question.questionType.includes("complete_words");
      const answerMatched = isCompleteWords
        ? Boolean(question.config.correctValues && Object.keys(question.config.correctValues).length)
        : Boolean(question.config.correctOptionId && options.some((option) => option.id === question.config.correctOptionId));
      if (sourceFile !== sourceFileName) warnings.push("source_file_not_reading_docx");
      if (sourceAsset && sourceAsset.metadata?.section !== "reading") warnings.push("source_asset_not_reading");
      if (/^Reading question \d+$/i.test(question.prompt?.text || "")) warnings.push("placeholder_prompt");
      if (isChoice && options.length === 0 && question.config.displayMode !== "source_image_fallback") warnings.push("choice_missing_options_without_fallback");
      if (isChoice && options.some((option) => isPlaceholderOption(option.text))) warnings.push("placeholder_option");
      if (isChoice && question.config.correctOptionId && !answerMatched) warnings.push("answer_option_not_found");
      if (isCompleteWords && (!Array.isArray(question.config.blanks) || question.config.blanks.some((blank) => !blank.missingLength))) warnings.push("complete_words_missing_length");
      if (!question.stimulusId && !question.config.imageAssetId) warnings.push("missing_stimulus");
      return {
        questionId: question.id,
        moduleId: question.moduleId,
        questionNumber: question.number,
        questionType: question.questionType,
        sourceFile,
        sourceAssetId,
        sourceRegion: question.config.sourceRegion,
        stimulusId: question.stimulusId,
        prompt: question.prompt?.text || "",
        optionCount: options.length,
        answerMatched,
        rendererId: question.rendererId,
        needsReview: question.needsReview,
        warnings
      };
    });
}

function sectionModules(section, sectionQuestions) {
  const moduleIds = [...new Set(sectionQuestions.map((question) => question.moduleId))];
  return moduleIds.map((moduleId, index) => ({
    id: moduleId,
    title: `Module ${index + 1}`,
    questionIds: sectionQuestions.filter((question) => question.moduleId === moduleId).map((question) => question.id),
    navigationStrategyId: section === "listening" || section === "speaking" ? NAV.forward : NAV.free
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source ? path.resolve(String(args.source)) : "";
  const onlySection = args.section ? String(args.section) : "";
  if (!source) throw new Error("Usage: npm run build-exam -- --source <real test folder> [--section listening]");
  if (onlySection && !SECTION_KEYS.includes(onlySection)) throw new Error(`Unknown section: ${onlySection}`);
  const sourceName = path.basename(source);
  const examId = slug(sourceName);
  const useReferenceFixtures = isReferenceProfileSource(sourceName);
  const generatedDir = path.join(source, GENERATED);
  const files = (await walk(source)).map((file) => ({ ...file, role: roleFor(file), section: sectionForName(file.name) }));
  const answerDoc = exactSourceFile(files, "3.2 套二 答案.docx") || files.find((file) => file.role === "answer_document" && file.ext === ".docx");
  if (!answerDoc) throw new Error("No answer Word document found.");
  const answers = parseAnswerSections(docxParagraphs(answerDoc.fullPath));
  const cachePath = path.join(generatedDir, "audio-cache.json");
  const audioCache = JSON.parse(await readFile(cachePath, "utf8").catch(() => "{}"));

  const docxBySection = {};
  const audioAssets = [];
  const docAssets = [];
  let ocrByAsset = {};
  const ocrStats = { processed: 0, succeeded: 0 };
  const ocrImages = [];
  for (const section of SECTION_KEYS) {
    const doc = files.find((file) => file.role === "question_document" && file.section === section);
    if (doc) {
      const extracted = await extractDocx(doc, generatedDir, examId);
      docxBySection[section] = extracted;
      docAssets.push(...extracted.media.map((media) => ({ id: media.assetId, examId, type: "image", fileName: media.fileName, relativePath: media.relativePath, mimeType: media.mimeType, metadata: { section, hash: media.hash } })));
      for (const block of extracted.blocks.filter((item) => item.type === "image")) {
        ocrStats.processed += 1;
        const media = extracted.media.find((item) => item.assetId === block.assetId);
        if (!media) continue;
        ocrImages.push(media);
      }
      await writeJson(path.join(generatedDir, "documents", `${section}.json`), extracted);
    }
    const archives = files.filter((file) => file.role === "audio_archive" && file.section === section);
    for (const archive of archives) audioAssets.push(...await extractAudioZip(archive, section, generatedDir, examId, audioCache));
    const directAudio = files.filter((file) => file.role === "audio" && file.section === section).sort((a, b) => naturalCompare(a.name, b.name));
    for (let index = 0; index < directAudio.length; index += 1) audioAssets.push(await extractAudioFile(directAudio[index], section, generatedDir, examId, index + 1));
  }
  ocrByAsset = await runBatchOcr(ocrImages, generatedDir);
  ocrStats.succeeded = Object.values(ocrByAsset).filter((ocr) => ocr.fullText).length;
  await writeJson(cachePath, audioCache);
  const sourceInventory = {
    sourceName,
    sourcePath: source,
    generatedAt: new Date().toISOString(),
    files: sourceFileSummary(files),
    docx: docxInventory(docxBySection),
    audio: audioAssets.map((asset) => ({
      assetId: asset.assetId,
      section: asset.section,
      originalFileName: asset.originalFileName,
      sourceZip: asset.sourceZip,
      sourceFile: asset.sourceFile,
      durationSeconds: asset.durationSeconds,
      naturalOrder: asset.naturalOrder
    })),
    detectedSourcePatterns: detectSourcePatterns(files, docxBySection, audioAssets),
    selectedAdapters: selectAdapters({ files, docxBySection, audioAssets, useReferenceFixtures })
  };
  await writeJson(path.join(generatedDir, "source-inventory.json"), sourceInventory);

  const readingDoc = exactSourceFile(files, "3.2 套二 阅读.docx") || files.find((file) => file.role === "question_document" && file.section === "reading");
  if (!readingDoc) throw new Error("No readable Reading Word document found.");
  const readingFingerprint = await sourceFingerprint(readingDoc);
  const readingAnswerFingerprint = await sourceFingerprint(answerDoc);
  const reading = parseReading(readingDoc, docxBySection.reading, answers.reading, answers.readingExtra || new Map(), { useReferenceFixtures });
  const listeningAudio = audioAssets.filter((asset) => asset.section === "listening");
  const speakingAudio = audioAssets.filter((asset) => asset.section === "speaking");
  const listening = docxBySection.listening ? buildListening(docxBySection.listening, listeningAudio, answers.listening, answers.listeningExtra || new Map(), ocrByAsset, { useReferenceFixtures }) : { questions: [], audioGroups: [], audioSegments: [] };
  const writingQuestions = docxBySection.writing ? buildWriting(docxBySection.writing, answers.writingText, ocrByAsset) : [];
  const speaking = docxBySection.speaking ? buildSpeaking(docxBySection.speaking, speakingAudio, answers.speakingText, ocrByAsset) : { questions: [], audioGroups: [], audioSegments: [], taskGroups: [], expectedQuestionCount: 11 };
  const questionSets = { reading: reading.questions, listening: listening.questions, writing: writingQuestions, speaking: speaking.questions };
  const activeSections = onlySection ? new Set([onlySection, "reading"]) : new Set(SECTION_KEYS);
  const previousQuestions = JSON.parse(await readFile(path.join(generatedDir, "questions.json"), "utf8").catch(() => "[]"));
  const questions = SECTION_KEYS.flatMap((section) => activeSections.has(section) ? questionSets[section] : previousQuestions.filter((question) => question.sectionId === section));
  const audioGroups = [...listening.audioGroups, ...speaking.audioGroups];
  const audioSegments = [...listening.audioSegments, ...speaking.audioSegments];
  const audioExamAssets = audioAssets.map((asset) => ({ id: asset.assetId, examId, type: "audio", fileName: asset.originalFileName, relativePath: asset.extractedPath, mimeType: asset.mimeType, metadata: { section: asset.section, durationSeconds: asset.durationSeconds, hash: asset.hash, sourceZip: asset.sourceZip } }));
  const assets = [...docAssets, ...audioExamAssets];
  const readingStimulusAssets = useReferenceFixtures ? await applyReadingStimulusCrops({ questions, assets, generatedDir, examId }) : await applyGenericReadingImageCrops({ questions, assets, generatedDir, examId });
  assets.push(...readingStimulusAssets);
  const writingStimulusAssets = await applyWritingStimulusCrops({ questions, assets, generatedDir, examId });
  assets.push(...writingStimulusAssets);
  const manualAssets = useReferenceFixtures ? await applyManualListeningCorrections({ questions, assets, generatedDir, examId }) : await applyGenericListeningStimulusCrops({ questions, assets, generatedDir, examId });
  assets.push(...manualAssets);
  const stimuli = [
    ...reading.passages.map((passage) => ({ id: passage.id, examPackId: "toefl", stimulusType: "toefl.reading_passage", title: passage.title || "Reading Passage", content: { type: "blocks", blocks: passage.paragraphs.map((paragraph) => ({ type: "paragraph", text: paragraph.text })) }, assetIds: [] })),
    ...questions
      .filter((question) => question.config.imageAssetId && question.stimulusId)
      .map((question) => ({ id: question.stimulusId, examPackId: "toefl", stimulusType: "source_image_fallback", title: `${question.id} source image`, assetIds: [question.config.imageAssetId], config: { sourceAssetId: question.config.sourceAssetId, cropRegion: question.config.sourceRegion, questionId: question.id, questionNumber: question.number } }))
  ];

  const sectionMeta = {};
  for (const section of SECTION_KEYS) {
    const sectionQuestions = questions.filter((question) => question.sectionId === section);
    const detected = Boolean(docxBySection[section]) || (section === "listening" && listeningAudio.length > 0) || (section === "speaking" && speakingAudio.length > 0);
    const expectedQuestionCount = section === "speaking" ? speaking.expectedQuestionCount : undefined;
    const countMismatch = expectedQuestionCount !== undefined && sectionQuestions.length !== expectedQuestionCount;
    const speakingSegmentIssues = section === "speaking" ? speaking.audioSegments.filter((segment) => segment.needsReview).length : 0;
    const issues = sectionQuestions.filter((question) => question.needsReview).length + speakingSegmentIssues + (countMismatch ? 1 : 0);
    sectionMeta[section] = {
      importStatus: sectionQuestions.length && issues === 0 ? "ready" : sectionQuestions.length ? "needs_review" : detected ? "detected" : "not_detected",
      sourceFiles: files.filter((file) => file.section === section && file.role === "question_document").map((file) => file.relativePath),
      audioCount: audioAssets.filter((asset) => asset.section === section).length,
      importedAnswerCount: section === "reading" ? Math.min(reading.questions.length, answers.reading.size + (answers.readingExtra?.size || 0)) : section === "listening" ? Math.min(sectionQuestions.length, answers.listening.size + (answers.listeningExtra?.size || 0)) : 0,
      issueCount: issues,
      expectedQuestionCount
    };
  }
  const sections = SECTION_KEYS.map((section) => {
    const sectionQuestions = questions.filter((question) => question.sectionId === section);
    const modules = sectionModules(section, sectionQuestions);
    return {
      id: section,
      examPackId: "toefl",
      sectionType: SECTION_TYPE[section],
      title: SECTION_TITLES[section],
      modules,
      timing: { scope: "section", durationSeconds: DURATION[section] },
      instructions: undefined,
      status: sectionMeta[section].importStatus === "ready" ? "published" : sectionMeta[section].importStatus,
      config: sectionMeta[section]
    };
  });
  const examStatus = sections.every((section) => section.status === "published") ? "published" : "partially_published";
  const readingQuestionAudit = buildReadingQuestionAudit(questions, assets, readingDoc.relativePath);
  const listeningQuestionAudit = buildListeningQuestionAudit(questions, assets);
  const speakingQuestionAudit = buildSpeakingQuestionAudit(questions, assets, audioSegments);
  const normalizedSources = normalizedQuestionSources(questions);
  const canonicalValidation = validateCanonicalOutput({ questions, assets, audioSegments, sections });
  const migrationReport = {
    examId,
    sourcePath: source,
    canonicalProfile: "toefl-2026-v1",
    detectedSourcePatterns: sourceInventory.detectedSourcePatterns,
    selectedAdapters: sourceInventory.selectedAdapters,
    sourceDiffersFromReference: !useReferenceFixtures,
    referenceFixtureContentUsed: useReferenceFixtures,
    normalizationWarnings: normalizedSources.flatMap((item) => item.warnings.map((warning) => ({ section: item.section, sourceQuestionNumber: item.sourceQuestionNumber, warning }))),
    canonicalValidation,
    needsReview: questions.filter((question) => question.needsReview).map((question) => ({ questionId: question.id, section: question.sectionId, reason: question.confidence < 0.6 ? "low_confidence_or_missing_extraction" : "manual_confirmation_required" }))
  };
  const report = {
    examId,
    sourcePath: source,
    generatedAt: new Date().toISOString(),
    sourceSummary: { wordFiles: files.filter((file) => file.ext === ".docx").length, audioArchives: files.filter((file) => file.role === "audio_archive").length },
    docx: Object.fromEntries(SECTION_KEYS.map((section) => [section, docxBySection[section]?.counts || { paragraphs: 0, tables: 0, images: 0 }])),
    audio: { listeningM4A: listeningAudio.length, speakingM4A: speakingAudio.length, ffmpegAvailable: commandExists("ffmpeg") },
    ocr: ocrStats,
    detectedSourcePatterns: sourceInventory.detectedSourcePatterns,
    selectedAdapters: sourceInventory.selectedAdapters,
    canonicalProfile: "toefl-2026-v1",
    canonicalValidation,
    recognized: {
      readingQuestions: reading.questions.length,
      readingModules: new Set(reading.questions.map((question) => question.moduleId)).size,
      readingCompleteWords: reading.questions.filter((question) => question.questionType.includes("complete_words")).length,
      readingDailyLifeQuestions: reading.questions.filter((question) => question.questionType.includes("daily_life_choice")).length,
      readingAcademicQuestions: reading.questions.filter((question) => question.questionType.includes("academic_passage_choice")).length,
      readingMatchedAnswers: reading.questions.filter((question) => {
        if (question.questionType.includes("complete_words")) return Boolean(question.config.correctValues && Object.keys(question.config.correctValues).length);
        return Boolean(question.config.correctOptionId || question.config.importedAnswer);
      }).length,
      listeningQuestions: listening.questions.length,
      listeningMatchedAnswers: sectionMeta.listening.importedAnswerCount,
      listeningMatchedAudio: listening.questions.filter((question) => question.config.audioGroupId).length,
      listeningAudioSegments: listening.audioSegments.length,
      writingTasks: writingQuestions.length,
      speakingTasks: speaking.questions.length,
      speakingExpectedQuestions: speaking.expectedQuestionCount,
      speakingListenRepeatQuestions: speaking.questions.filter((question) => question.questionType.includes("listen_repeat")).length,
      speakingInterviewQuestions: speaking.questions.filter((question) => question.questionType.includes("interview_response")).length,
      speakingAudioSegments: speaking.audioSegments.length,
      totalQuestions: questions.length
    },
    sectionStatus: sectionMeta,
    reviewQueue: questions.filter((question) => question.needsReview).map((question) => ({ questionId: question.id, section: question.sectionId, reason: question.confidence < 0.6 ? "low_confidence_or_missing_ocr_text" : "needs_manual_review" })),
    readingQuestionSource: readingDoc.relativePath,
    readingAnswerSource: answerDoc.relativePath,
    sourceFingerprints: {
      readingQuestionSource: readingFingerprint,
      readingAnswerSource: readingAnswerFingerprint
    },
    readingQuestionAudit,
    listeningChoiceAudit: listeningQuestionAudit,
    speakingQuestionAudit,
    speakingTaskGroups: speaking.taskGroups,
    writingBuildSentenceAudit: writingQuestions
      .filter((question) => question.questionType.includes("build_sentence"))
      .map((question) => ({
        questionId: question.id,
        sourceAssetId: question.config.sourceAssetId,
        questionNumber: question.number,
        tokenCount: Array.isArray(question.config.tokens) ? question.config.tokens.length : 0,
        tokens: Array.isArray(question.config.tokens) ? question.config.tokens.map((token) => token.text) : [],
        fixedPrefix: question.config.fixedPrefix || "",
        fixedSuffix: question.config.fixedSuffix || "",
        hasCorrectOrder: Array.isArray(question.config.correctTokenOrder) && question.config.correctTokenOrder.length > 0,
        needsReview: question.needsReview,
        validationIssues: question.config.validationIssues || []
      })),
    examStatus: examStatus === "published" ? "published" : "partial",
    files: files.map(({ relativePath, ext, size, role, section }) => ({ relativePath, ext, size, role, section }))
  };
  const legacyTest = {
    id: examId,
    title: sourceName,
    version: 1,
    status: "published",
    sections: SECTION_KEYS.map((section) => {
      const sectionQuestions = questions.filter((question) => question.sectionId === section);
      return { id: section, key: section, title: SECTION_TITLES[section], durationSeconds: DURATION[section], importStatus: sectionMeta[section].importStatus, sourceFiles: sectionMeta[section].sourceFiles, audioCount: sectionMeta[section].audioCount, importedAnswerCount: sectionMeta[section].importedAnswerCount, issueCount: sectionMeta[section].issueCount, modules: sectionModules(section, sectionQuestions).map((module, index) => ({ id: module.id, moduleNumber: index + 1, title: module.title, navigationMode: section === "listening" || section === "speaking" ? "forward_only" : "free", questions: sectionQuestions.filter((question) => question.moduleId === module.id).map(legacyQuestion) })) };
    })
  };
  await writeJson(path.join(generatedDir, "exam.json"), { id: examId, examPackId: "toefl", title: sourceName, version: 1, status: examStatus, sections });
  await writeJson(path.join(generatedDir, "sections.json"), sections);
  await writeJson(path.join(generatedDir, "modules.json"), sections.flatMap((section) => section.modules.map((module) => ({ ...module, sectionId: section.id }))));
  await writeJson(path.join(generatedDir, "stimuli.json"), stimuli);
  await writeJson(path.join(generatedDir, "questions.json"), questions);
  await writeJson(path.join(generatedDir, "answer-key.json"), Object.fromEntries(questions.map((question) => [question.id, question.config.correctValues || question.config.correctOptionId || question.config.correctTokenOrder || question.config.correctText || null])));
  await writeJson(path.join(generatedDir, "assets.json"), assets);
  await writeJson(path.join(generatedDir, "audio-assets.json"), audioAssets);
  await writeJson(path.join(generatedDir, "audio-groups.json"), audioGroups);
  await writeJson(path.join(generatedDir, "audio-segments.json"), audioSegments);
  await writeJson(path.join(generatedDir, "speaking-audio-segments.json"), speaking.audioSegments);
  await writeJson(path.join(generatedDir, "speaking-task-groups.json"), speaking.taskGroups);
  await writeJson(path.join(generatedDir, "audio-segmentation-report.json"), { generatedAt: new Date().toISOString(), method: "duration_even_split_candidate_without_silence_detection", ffmpegAvailable: commandExists("ffmpeg"), needsReview: true, segments: audioSegments });
  await writeJson(path.join(generatedDir, "normalized-sources.json"), normalizedSources);
  await writeJson(path.join(generatedDir, "migration-report.json"), migrationReport);
  await writeJson(path.join(generatedDir, "reading-question-audit.json"), readingQuestionAudit);
  await writeJson(path.join(generatedDir, "listening-question-audit.json"), listeningQuestionAudit);
  await writeJson(path.join(generatedDir, "speaking-question-audit.json"), speakingQuestionAudit);
  await writeJson(path.join(generatedDir, "import-report.json"), report);
  await writeJson(path.join(generatedDir, "test.json"), legacyTest);
  await writeJson(path.join(generatedDir, "passages.json"), reading.passages);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
