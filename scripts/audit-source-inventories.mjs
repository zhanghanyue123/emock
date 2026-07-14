import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";

const ROOT = path.resolve(process.argv[2] || "真题合集7-5");
const GENERATED = "generated";
const SECTION_KEYS = ["reading", "listening", "writing", "speaking"];

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

function commandExists(command) {
  return spawnSync("/bin/zsh", ["-lc", `command -v ${command}`], { stdio: "ignore" }).status === 0;
}

function audioDuration(filePath) {
  if (!commandExists("afinfo")) return null;
  const result = spawnSync("afinfo", [filePath], { encoding: "utf8" });
  const match = result.stdout.match(/estimated duration:\s*([0-9.]+)/i) || result.stdout.match(/duration:\s*([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

function unzipText(filePath, entry) {
  return execFileSync("unzip", ["-p", filePath, entry], { encoding: "utf8", maxBuffer: 200 * 1024 * 1024 });
}

function decodeXml(value = "") {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'");
}

function textFromXmlFragment(xml) {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).join("").replace(/\s+/g, " ").trim();
}

function docxStats(file) {
  try {
    const xml = unzipText(file.fullPath, "word/document.xml");
    const paragraphs = [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((match) => textFromXmlFragment(match[0])).filter(Boolean);
    const imageCount = [...xml.matchAll(/r:embed="([^"]+)"/g)].length;
    const text = paragraphs.join("\n");
    return {
      paragraphCount: paragraphs.length,
      imageCount,
      tableCount: [...xml.matchAll(/<w:tbl\b/g)].length,
      internalTitles: paragraphs.filter((item) => /^(reading|listening|writing|speaking)|阅读|听力|写作|口语/i.test(item)).slice(0, 20),
      hasQuestionHeader: /Question\s+\d+\s+of\s+\d+|Questions\s+\d+\s*-\s*\d+\s+of\s+\d+/i.test(text),
      hasModuleTitle: /Module\s+\d+|模块|套一|套二/i.test(text),
      hasSectionTitle: /Reading|Listening|Writing|Speaking|阅读|听力|写作|口语/i.test(text)
    };
  } catch {
    return { paragraphCount: 0, imageCount: 0, tableCount: 0, internalTitles: [], hasQuestionHeader: false, hasModuleTitle: false, hasSectionTitle: false, unreadable: true };
  }
}

function detectPatterns(files, docx) {
  const patterns = new Set();
  for (const stats of Object.values(docx)) {
    if (!stats.file) continue;
    if (stats.imageCount && stats.paragraphCount > stats.imageCount * 2) patterns.add("docx_mixed");
    else if (stats.imageCount) patterns.add("docx_image_dominant");
    else patterns.add("docx_text_dominant");
    if (stats.imageCount >= 30) patterns.add("one_image_per_question");
    if (stats.imageCount > 0 && stats.imageCount < 20 && stats.hasQuestionHeader) patterns.add("multiple_questions_per_image");
  }
  if (files.some((file) => file.ext === ".pdf")) patterns.add("pdf_source");
  const audioBySection = Object.fromEntries(SECTION_KEYS.map((section) => [section, files.filter((file) => ["audio", "audio_archive"].includes(file.role) && file.section === section)]));
  for (const items of Object.values(audioBySection)) {
    if (items.length === 1) patterns.add("one_audio_per_section");
    if (items.length > 8) patterns.add("one_audio_per_question");
    if (items.length > 1 && items.length <= 8) patterns.add("mixed_audio_files");
  }
  if (files.some((file) => file.role === "answer_document" && [".docx", ".doc"].includes(file.ext))) patterns.add("answer_inline_text");
  if (files.some((file) => file.role === "answer_document" && file.ext === ".pdf")) patterns.add("answer_image_based");
  return [...patterns].sort();
}

function selectedAdapters(files, docx) {
  const choose = (section, names) => {
    const stats = docx[section];
    if (stats?.file) {
      if (stats.imageCount && stats.paragraphCount) return names.mixed;
      if (stats.imageCount) return names.image;
      return names.text;
    }
    if (files.some((file) => file.section === section && file.ext === ".pdf")) return names.image;
    return null;
  };
  const audio = (section) => {
    const count = files.filter((file) => ["audio", "audio_archive"].includes(file.role) && file.section === section).length;
    if (count === 1) return section === "listening" ? "SectionAudioListeningAdapter" : "SectionAudioSpeakingAdapter";
    if (count > 8) return section === "listening" ? "PerQuestionAudioListeningAdapter" : "PerQuestionAudioSpeakingAdapter";
    if (count > 1) return section === "listening" ? "MixedAudioListeningAdapter" : "MixedSpeakingAdapter";
    return null;
  };
  return {
    reading: choose("reading", { text: "TextDominantReadingAdapter", image: "ImageDominantReadingAdapter", mixed: "MixedReadingAdapter" }),
    listening: [choose("listening", { text: "TextListeningQuestionAdapter", image: "ImageListeningQuestionAdapter", mixed: "MixedListeningQuestionAdapter" }), audio("listening")].filter(Boolean),
    writing: choose("writing", { text: "TextWritingAdapter", image: "ScreenshotWritingAdapter", mixed: "MixedWritingAdapter" }),
    speaking: [choose("speaking", { text: "TextSpeakingAdapter", image: "ImageSpeakingAdapter", mixed: "MixedSpeakingAdapter" }), audio("speaking")].filter(Boolean),
    answer: files.some((file) => file.role === "answer_document" && file.ext === ".pdf") ? "ImageAnswerAdapter" : files.some((file) => file.role === "answer_document") ? "InlineAnswerAdapter" : null
  };
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const entries = await readdir(ROOT, { withFileTypes: true });
const results = [];
for (const entry of entries.filter((item) => item.isDirectory() && !item.name.startsWith("."))) {
  const sourcePath = path.join(ROOT, entry.name);
  const files = (await walk(sourcePath)).map((file) => ({ ...file, role: roleFor(file), section: sectionForName(file.name) }));
  if (!files.some((file) => [".docx", ".doc", ".pdf"].includes(file.ext))) continue;
  const docx = Object.fromEntries(SECTION_KEYS.map((section) => {
    const file = files.find((item) => item.role === "question_document" && item.section === section);
    return [section, file ? { file: file.relativePath, ...docxStats(file) } : { file: null, paragraphCount: 0, imageCount: 0, tableCount: 0, internalTitles: [], hasQuestionHeader: false, hasModuleTitle: false, hasSectionTitle: false }];
  }));
  const audio = files.filter((file) => ["audio", "audio_archive"].includes(file.role)).map((file, index) => ({
    relativePath: file.relativePath,
    section: file.section,
    role: file.role,
    durationSeconds: file.role === "audio" ? audioDuration(file.fullPath) : null,
    naturalOrder: index + 1
  }));
  const detectedSourcePatterns = detectPatterns(files, docx);
  const inventory = {
    sourceName: entry.name,
    sourcePath,
    generatedAt: new Date().toISOString(),
    files: files.map(({ relativePath, ext, size, role, section }) => ({ relativePath, ext, size, role, section })),
    docx,
    audio,
    detectedSourcePatterns,
    selectedAdapters: selectedAdapters(files, docx)
  };
  const hasExistingCanonical = await stat(path.join(sourcePath, GENERATED, "exam.json")).then(() => true).catch(() => false);
  const migrationReport = {
    sourcePath,
    canonicalProfile: "toefl-2026-v1",
    detectedSourcePatterns,
    selectedAdapters: inventory.selectedAdapters,
    sourceDiffersFromReference: entry.name !== "3.2新托福真题B卷",
    referenceFixtureContentUsed: entry.name === "3.2新托福真题B卷" && hasExistingCanonical,
    normalizationWarnings: hasExistingCanonical ? [] : ["canonical_output_not_generated_yet"],
    canonicalValidation: hasExistingCanonical ? { generated: true } : { generated: false, needsAdapterImplementation: detectedSourcePatterns.includes("pdf_source") ? "pdf_ocr_pipeline" : "source_specific_adapter" },
    needsReview: hasExistingCanonical ? [] : [{ section: "all", reason: "not_yet_normalized_to_canonical_schema" }]
  };
  await writeJson(path.join(sourcePath, GENERATED, "source-inventory.json"), inventory);
  if (!hasExistingCanonical) await writeJson(path.join(sourcePath, GENERATED, "migration-report.json"), migrationReport);
  results.push({ sourceName: entry.name, patterns: detectedSourcePatterns, generated: hasExistingCanonical });
}

console.log(JSON.stringify({ root: ROOT, count: results.length, results }, null, 2));
