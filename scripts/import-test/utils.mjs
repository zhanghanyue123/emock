import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

export const generatedFiles = {
  test: "test.json",
  passages: "passages.json",
  audioGroups: "audio-groups.json",
  assets: "assets.json",
  answerKey: "answer-key.json",
  report: "import-report.json"
};

export const sectionKeys = new Set(["reading", "listening", "speaking", "writing"]);

export function parseArgs(argv) {
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

export function testIdForFolder(folderName) {
  const ascii = folderName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const hash = crypto.createHash("sha1").update(folderName).digest("hex").slice(0, 8);
  return ascii ? `${ascii}-${hash}` : `test-${hash}`;
}

export async function getContentDirs() {
  const local = path.join(process.cwd(), "content");
  if (process.env.TOEFL_CONTENT_DIR) return [local, process.env.TOEFL_CONTENT_DIR].filter((value, index, arr) => arr.indexOf(value) === index);
  try {
    const config = JSON.parse(await readFile(path.join(process.cwd(), "content-source.local.json"), "utf8"));
    return [local, config.contentDir].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index);
  } catch {
    return [local];
  }
}

export async function findTestFolder(testId) {
  for (const contentDir of await getContentDirs()) {
    const entries = await readdir(contentDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const folder = path.join(contentDir, entry.name);
      if (entry.name === testId || testIdForFolder(entry.name) === testId) return folder;
      const generated = await readJson(path.join(folder, "generated", generatedFiles.test));
      if (generated?.id === testId) return folder;
    }
  }
  return null;
}

export async function ensureGeneratedDir(testId) {
  const folder = await findTestFolder(testId);
  if (!folder) throw new Error(`Cannot find content folder for test: ${testId}`);
  const generatedDir = path.join(folder, "generated");
  await mkdir(generatedDir, { recursive: true });
  return { folder, generatedDir };
}

export async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function walkFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.includes(".downloading") || entry.name === "generated") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(fullPath, base)));
    else files.push(path.relative(base, fullPath).split(path.sep).join("/"));
  }
  return files;
}

export function classifySection(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("reading") || lower.includes("阅读")) return "reading";
  if (lower.includes("listening") || lower.includes("听力")) return "listening";
  if (lower.includes("speaking") || lower.includes("口语")) return "speaking";
  if (lower.includes("writing") || lower.includes("写作")) return "writing";
  return null;
}
