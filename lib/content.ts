import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { SECTION_KEYS } from "@/lib/constants";
import { getContentDirs, safeRelativePath, SUPPORTED_AUDIO_EXTENSIONS, SUPPORTED_CONTENT_EXTENSIONS, testIdForFolder } from "@/lib/content-source";
import type { AudioItem, MaterialItem, TestOverallStatus } from "@/types/test";
import type { SectionKey, TestListItem, TestManifest, TestSection } from "@/types/test";
import type { TestDefinition } from "@/types/structured-test";

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateSection(value: unknown, key: SectionKey): TestSection {
  if (!isRecord(value)) throw new Error(`${key} section must be an object`);
  if (typeof value.enabled !== "boolean") throw new Error(`${key}.enabled must be boolean`);
  if (typeof value.title !== "string") throw new Error(`${key}.title must be string`);
  if (typeof value.durationMinutes !== "number") throw new Error(`${key}.durationMinutes must be number`);
  if (!Array.isArray(value.questions)) throw new Error(`${key}.questions must be an array`);
  return value as unknown as TestSection;
}

export function validateManifest(input: unknown): TestManifest {
  if (!isRecord(input)) throw new Error("manifest must be an object");
  if (typeof input.id !== "string" || !SAFE_ID.test(input.id)) throw new Error("id must use letters, numbers, hyphen, or underscore");
  if (typeof input.title !== "string") throw new Error("title is required");
  if (typeof input.version !== "number") throw new Error("version must be a number");
  if (!isRecord(input.sections)) throw new Error("sections is required");

  for (const key of SECTION_KEYS) validateSection(input.sections[key], key);
  return input as unknown as TestManifest;
}

async function pathExists(filePath: string) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

function emptySection(title: string, durationMinutes: number): TestSection {
  return { enabled: false, title, durationMinutes, pdf: null, audio: [], questions: [], importStatus: "not_detected", sourceFiles: [], audioCount: 0, importedAnswerCount: 0, issueCount: 0 };
}

function classifyPdf(fileName: string): SectionKey | "answers" | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("答案") || lower.includes("answer") || lower.includes("参考")) return "answers";
  if (lower.includes("阅读") || lower.includes("reading")) return "reading";
  if (lower.includes("听力") || lower.includes("listening")) return "listening";
  if (lower.includes("口语") || lower.includes("speaking")) return "speaking";
  if (lower.includes("写作") || lower.includes("writing")) return "writing";
  return null;
}

function classifyAudio(fileName: string): SectionKey {
  const lower = fileName.toLowerCase();
  if (lower.includes("口语") || lower.includes("speaking")) return "speaking";
  if (lower.includes("写作") || lower.includes("writing")) return "writing";
  return "listening";
}

function materialType(file: string): MaterialItem["type"] {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (SUPPORTED_AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (ext === ".mp4") return "video";
  return "other";
}

function materialCategory(file: string): MaterialItem["category"] {
  const lower = file.toLowerCase();
  if (lower.includes("答案") || lower.includes("answer") || lower.includes("解析")) return "answer";
  if (lower.includes("原文") || lower.includes("transcript")) return "transcript";
  if (lower.includes("综述") || lower.includes("策略") || lower.includes("rubric") || lower.includes("lesson") || lower.includes("overview")) return "review";
  if (SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase())) return "audio";
  return "source";
}

function toMaterial(file: string, index: number): MaterialItem {
  return {
    id: `material-${index + 1}`,
    title: path.basename(file, path.extname(file)),
    file,
    type: materialType(file),
    category: materialCategory(file)
  };
}

function hasExamSource(files: string[]) {
  return files.some((file) => {
    const name = path.basename(file).toLowerCase();
    return path.extname(file).toLowerCase() === ".pdf" && !name.includes("答案") && !name.includes("answer") && !name.includes("解析") && !name.includes("原文");
  });
}

function isOfficialOgFolder(folderName: string) {
  return /官方og/i.test(folderName);
}

function isTpoCollectionFolder(folderName: string) {
  return /18套题|备考资料/.test(folderName);
}

async function walkFiles(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.includes(".downloading")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(fullPath, base)));
    else if (SUPPORTED_CONTENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(safeRelativePath(path.relative(base, fullPath)));
  }
  return files;
}

async function immediateSubfolders(dir: string) {
  return (await readdir(dir, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "generated")
    .map((entry) => entry.name);
}

async function generateManifest(contentDir: string, folderName: string): Promise<TestManifest | null> {
  const folderPath = path.join(contentDir, folderName);
  const files = await walkFiles(folderPath);
  if (files.length === 0) return null;

  const sections = {
    reading: emptySection("Reading", 35),
    listening: emptySection("Listening", 36),
    speaking: emptySection("Speaking", 16),
    writing: emptySection("Writing", 29)
  };

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const name = path.basename(file);
    if (ext === ".pdf") {
      const section = classifyPdf(name);
      if (section && section !== "answers" && !sections[section].pdf) {
        sections[section] = { ...sections[section], enabled: true, pdf: file };
      }
    } else if (SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
      const section = classifyAudio(name);
      const audio: AudioItem = {
        id: `${section}-audio-${(sections[section].audio?.length || 0) + 1}`,
        title: path.basename(file, ext),
        file,
        allowReplay: true
      };
      sections[section] = { ...sections[section], enabled: true, audio: [...(sections[section].audio || []), audio] };
    }
  }

  return {
    id: testIdForFolder(folderName),
    title: folderName,
    description: "Auto-generated from the external content folder. Add manifest.json for structured questions and answers.",
    version: 1,
    sections,
    kind: "exam",
    overallStatus: SECTION_KEYS.some((key) => sections[key].questions.length > 0) ? "ready" : "in_progress",
    materials: files.map(toMaterial),
    reviewMaterials: files.map(toMaterial).filter((item) => item.category === "answer" || item.category === "transcript" || item.category === "review")
  };
}

async function structuredSummary(contentDir: string, folderName: string): Promise<TestManifest | null> {
  const generated = await readFile(path.join(contentDir, folderName, "generated", "test.json"), "utf8")
    .then((raw) => JSON.parse(raw) as TestDefinition)
    .catch(() => null);
  if (!generated) return null;
  const integrity = await readFile(path.join(contentDir, folderName, "generated", "content-integrity-report.json"), "utf8")
    .then((raw) => JSON.parse(raw) as { publishable?: boolean; reading?: { needsReview?: number }; listening?: { needsReview?: number }; writing?: { needsReview?: number } })
    .catch(() => null);
  const isPublishable = integrity?.publishable === true;
  const sections = {
    reading: emptySection("Reading", 35),
    listening: emptySection("Listening", 36),
    speaking: emptySection("Speaking", 16),
    writing: emptySection("Writing", 29)
  };
  for (const section of generated.sections) {
    sections[section.key] = {
      enabled: true,
      title: section.title,
      durationMinutes: Math.ceil((section.durationSeconds || 0) / 60) || sections[section.key].durationMinutes,
      pdf: null,
      audio: [],
      importStatus: section.importStatus || (section.modules.some((module) => module.questions.length > 0) ? "ready" : "detected"),
      sourceFiles: section.sourceFiles || [],
      audioCount: section.audioCount || 0,
      importedAnswerCount: section.importedAnswerCount || 0,
      issueCount: section.key === "reading"
        ? integrity?.reading?.needsReview ?? section.issueCount ?? 0
        : section.key === "listening"
          ? integrity?.listening?.needsReview ?? section.issueCount ?? 0
          : section.key === "writing"
            ? integrity?.writing?.needsReview ?? section.issueCount ?? 0
            : section.issueCount || 0,
      questions: section.modules.flatMap((module) =>
        module.questions.map((question) => ({
          id: question.id,
          number: question.number,
          type: question.type === "complete_words" ? "text" : question.type === "multiple_choice" ? "multiple_choice" : question.type === "single_choice" ? "single_choice" : "text"
        }))
      )
    };
  }
  return {
    id: generated.id,
    title: generated.title,
    description: isPublishable
      ? "Published structured interactive test."
      : "题库已导入，但 Reading/Listening/Writing 仍有内容需要校对，暂不作为正式考试发布。",
    version: generated.version,
    sections,
    kind: "exam",
    overallStatus: isPublishable ? "ready" : "in_progress"
  };
}

async function generateMaterialsManifest(contentDir: string, folderName: string): Promise<TestManifest | null> {
  const folderPath = path.join(contentDir, folderName);
  const files = await walkFiles(folderPath);
  if (files.length === 0) return null;
  const sections = {
    reading: emptySection("Reading", 35),
    listening: emptySection("Listening", 36),
    speaking: emptySection("Speaking", 16),
    writing: emptySection("Writing", 29)
  };
  const materials = files.map(toMaterial).sort((a, b) => {
    if (a.type !== b.type) return a.type === "pdf" ? -1 : b.type === "pdf" ? 1 : 0;
    return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
  });
  return {
    id: testIdForFolder(folderName),
    title: "官方 OG",
    description: "官方指南资料库：直接查看 PDF，并播放配套音频。",
    version: 1,
    sections,
    kind: "materials",
    overallStatus: "materials",
    materials
  };
}

function makeTpoTitle(relativeName: string) {
  const base = path.basename(relativeName);
  if (/官方模拟题目/.test(base)) return base.replace(/^官方模拟题目/, "TOEFL Essentials Practice ");
  if (/托福改革样题第(\d+)套/.test(base)) return base.match(/托福改革样题第(\d+)套/) ? `官方学生版样题 ${base.match(/托福改革样题第(\d+)套/)?.[1]}` : base;
  if (/teachers-resources-practice-test-(\d+)/i.test(base)) return `官方教师版样题 ${base.match(/test-(\d+)/i)?.[1]}`;
  if (/Experience Day.*(?:Practice|Pracitce) Test\s*(\d+)/i.test(base)) return `官方体验日练习 ${base.match(/Test\s*(\d+)/i)?.[1]}`;
  if (/付费-Test\s*1/i.test(base)) return "付费新题 Test 1";
  if (/付费-Test\s*2/i.test(base)) return "付费新题 Test 2";
  return base.replace(/\.pdf$/i, "");
}

async function generateTpoPackManifest(contentDir: string, collectionName: string, relativeName: string, relativeFiles: string[], reviewMaterials: MaterialItem[]): Promise<TestManifest | null> {
  if (!hasExamSource(relativeFiles)) return null;
  const title = makeTpoTitle(relativeName);
  const virtualName = `${collectionName}/${relativeName}`;
  const sections = {
    reading: emptySection("Reading", 35),
    listening: emptySection("Listening", 36),
    speaking: emptySection("Speaking", 16),
    writing: emptySection("Writing", 29)
  };
  for (const file of relativeFiles) {
    const ext = path.extname(file).toLowerCase();
    const name = path.basename(file);
    if (ext === ".pdf") {
      const section = classifyPdf(name);
      if (section && section !== "answers" && !sections[section].pdf) sections[section] = { ...sections[section], enabled: true, pdf: file, importStatus: "detected" };
      else if (!section && !sections.reading.pdf) {
        for (const key of SECTION_KEYS) sections[key] = { ...sections[key], enabled: true, pdf: file, importStatus: "detected" };
      }
    } else if (SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
      const section = classifyAudio(name);
      const audio: AudioItem = { id: `${section}-audio-${(sections[section].audio?.length || 0) + 1}`, title: path.basename(file, ext), file, allowReplay: true };
      sections[section] = { ...sections[section], enabled: true, audio: [...(sections[section].audio || []), audio], importStatus: "detected" };
    }
  }
  const materials = relativeFiles.map(toMaterial);
  return {
    id: testIdForFolder(virtualName),
    title,
    description: "TPO/官方练习套题资料已识别，正在等待结构化导入为完整模考。",
    version: 1,
    sections,
    kind: "exam",
    overallStatus: "in_progress",
    materials,
    reviewMaterials: [...materials.filter((item) => item.category === "answer" || item.category === "transcript" || item.category === "review"), ...reviewMaterials]
  };
}

async function generateTpoCollection(contentDir: string, folderName: string): Promise<TestListItem[]> {
  const root = path.join(contentDir, folderName);
  const rootFiles = await walkFiles(root);
  const sharedReviewMaterials = rootFiles
    .filter((file) => !file.includes("/") && materialCategory(file) === "review")
    .map(toMaterial);
  const groups: { name: string; files: string[] }[] = [];
  const addFolderChildren = async (groupPrefix: string) => {
    const group = (await immediateSubfolders(root)).find((name) => name.startsWith(groupPrefix));
    if (!group) return;
    for (const child of (await immediateSubfolders(path.join(root, group))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))) {
      const rel = safeRelativePath(path.join(group, child));
      groups.push({ name: rel, files: (await walkFiles(path.join(root, rel))).map((file) => safeRelativePath(path.join(rel, file))) });
    }
  };
  const addPdfTests = async (groupPrefix: string, matcher: (file: string) => string | null) => {
    const group = (await immediateSubfolders(root)).find((name) => name.startsWith(groupPrefix));
    if (!group) return;
    const files = (await walkFiles(path.join(root, group))).map((file) => safeRelativePath(path.join(group, file)));
    const byName = new Map<string, string[]>();
    for (const file of files) {
      const key = matcher(file);
      if (!key) continue;
      byName.set(key, [...(byName.get(key) || []), file]);
    }
    for (const [name, selected] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" }))) groups.push({ name, files: selected });
  };
  await addFolderChildren("00.");
  await addPdfTests("01.", (file) => {
    const base = path.basename(file);
    const match = base.match(/第(\d+)套/);
    if (!match || !/题目|practice/i.test(base)) return null;
    const audio = rootFiles.filter((item) => item.includes(`托福样题0${match[1]}音频/`)).map((item) => safeRelativePath(item));
    return `官方学生版样题 ${match[1]}|${[file, ...audio].join("|")}`;
  });
  await addPdfTests("02.", (file) => /practice-test-(\d+)/i.test(file) ? `官方教师版样题 ${file.match(/test-(\d+)/i)?.[1]}` : null);
  await addPdfTests("03.", (file) => /(?:Practice|Pracitce) Test\s*(\d+)/i.test(file) ? `官方体验日练习 ${file.match(/Test\s*(\d+)/i)?.[1]}` : null);
  await addPdfTests("04.", (file) => /付费-Test\s*1/i.test(file) ? "付费新题 Test 1" : /付费-Test\s*2/i.test(file) ? "付费新题 Test 2" : null);
  await addFolderChildren("05.");
  const normalizedGroups = groups.map((group) => {
    if (!group.name.includes("|")) return group;
    const [name, ...files] = group.name.split("|");
    return { name, files };
  });
  const manifests = await Promise.all(normalizedGroups.slice(0, 18).map((group) => generateTpoPackManifest(contentDir, folderName, group.name, group.files, sharedReviewMaterials)));
  return manifests.filter(Boolean).slice(0, 18).map((manifest) => ({ ...manifest, valid: true }) as TestListItem);
}

async function readManifest(contentDir: string, folderName: string): Promise<TestListItem> {
  const generatedId = testIdForFolder(folderName);
  try {
    if (isOfficialOgFolder(folderName)) {
      const materials = await generateMaterialsManifest(contentDir, folderName);
      if (materials) return { ...materials, valid: true };
    }
    const filePath = path.join(contentDir, folderName, "manifest.json");
    if (!(await pathExists(filePath))) {
      const structured = await structuredSummary(contentDir, folderName);
      if (structured) return { ...structured, valid: true };
      const generated = await generateManifest(contentDir, folderName);
      if (!generated) return { id: generatedId, title: folderName, sections: {}, valid: false, error: "No supported PDF/audio files found." };
      return { ...generated, valid: true };
    }
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    const manifest = validateManifest(parsed);
    return { ...manifest, valid: true };
  } catch (error) {
    return {
      id: generatedId,
      title: folderName,
      sections: {},
      valid: false,
      error: error instanceof Error ? error.message : "Unknown manifest error"
    };
  }
}

export async function getAllTests(): Promise<TestListItem[]> {
  try {
    const all: TestListItem[] = [];
    for (const contentDir of await getContentDirs()) {
      const entries = await readdir(contentDir, { withFileTypes: true }).catch(() => []);
      const folders = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name);
      for (const folder of folders) {
        if (isTpoCollectionFolder(folder)) {
          all.push(...await generateTpoCollection(contentDir, folder));
          continue;
        }
        all.push(await readManifest(contentDir, folder));
      }
    }
    const deduped = new Map<string, TestListItem>();
    for (const item of all) deduped.set(item.id, item);
    return [...deduped.values()].sort((a, b) => {
      if (a.kind === "materials" && b.kind !== "materials") return -1;
      if (b.kind === "materials" && a.kind !== "materials") return 1;
      if (a.overallStatus === "ready" && b.overallStatus !== "ready") return -1;
      if (b.overallStatus === "ready" && a.overallStatus !== "ready") return 1;
      return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
    });
  } catch {
    return [];
  }
}

export async function getTestById(testId: string): Promise<TestManifest | null> {
  if (!SAFE_ID.test(testId)) return null;
  const tests = await getAllTests();
  const item = tests.find((test) => test.id === testId);
  return item?.valid ? (item as TestManifest) : null;
}
