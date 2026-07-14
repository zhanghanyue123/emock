import crypto from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const defaultSource = path.join(root, "content");
const configFile = path.join(root, "content-source.local.json");
const target = path.join(root, "public", "content");
const allowed = new Set([".pdf", ".mp3", ".m4a", ".wav", ".mp4", ".png", ".jpg", ".jpeg", ".webp"]);

async function getSourceDir() {
  if (process.env.TOEFL_CONTENT_DIR) return process.env.TOEFL_CONTENT_DIR;
  try {
    const parsed = JSON.parse(await readFile(configFile, "utf8"));
    return parsed.contentDir || defaultSource;
  } catch {
    return defaultSource;
  }
}

async function getSourceDirs() {
  const configured = await getSourceDir();
  return configured === defaultSource ? [defaultSource] : [defaultSource, configured];
}

function testIdForFolder(folderName) {
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

async function manifestId(folderPath, fallbackName) {
  try {
    const parsed = JSON.parse(await readFile(path.join(folderPath, "manifest.json"), "utf8"));
    if (/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(parsed.id)) return parsed.id;
  } catch {
    // Generated content without a manifest is expected.
  }
  return testIdForFolder(fallbackName);
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
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath, base)));
      continue;
    }
    if (allowed.has(path.extname(entry.name).toLowerCase())) {
      files.push({ from: fullPath, relative: path.relative(base, fullPath) });
    }
  }
  return files;
}

async function immediateSubfolders(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name);
}

function isTpoCollectionFolder(folderName) {
  return /18套题|备考资料/.test(folderName);
}

function hasExamSource(files) {
  return files.some((file) => {
    const name = path.basename(file.relative).toLowerCase();
    return path.extname(file.relative).toLowerCase() === ".pdf" && !name.includes("答案") && !name.includes("answer") && !name.includes("解析") && !name.includes("原文");
  });
}

async function tpoVirtualGroups(folderPath) {
  const rootFiles = await walk(folderPath);
  const groups = [];
  const addFolderChildren = async (groupPrefix) => {
    const group = (await immediateSubfolders(folderPath)).find((name) => name.startsWith(groupPrefix));
    if (!group) return;
    for (const child of (await immediateSubfolders(path.join(folderPath, group))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))) {
      const rel = path.join(group, child);
      groups.push({ name: rel.split(path.sep).join("/"), files: (await walk(path.join(folderPath, rel))).map((file) => ({ ...file, relative: path.join(rel, file.relative).split(path.sep).join("/") })) });
    }
  };
  const addPdfTests = async (groupPrefix, matcher) => {
    const group = (await immediateSubfolders(folderPath)).find((name) => name.startsWith(groupPrefix));
    if (!group) return;
    const files = (await walk(path.join(folderPath, group))).map((file) => ({ ...file, relative: path.join(group, file.relative).split(path.sep).join("/") }));
    const byName = new Map();
    for (const file of files) {
      const matched = matcher(file.relative, rootFiles);
      if (!matched) continue;
      const [name, extraFiles = []] = Array.isArray(matched) ? matched : [matched, []];
      byName.set(name, [...(byName.get(name) || []), file, ...extraFiles]);
    }
    for (const [name, selected] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" }))) groups.push({ name, files: selected });
  };
  await addFolderChildren("00.");
  await addPdfTests("01.", (relative, allFiles) => {
    const base = path.basename(relative);
    const match = base.match(/第(\d+)套/);
    if (!match || !/题目|practice/i.test(base)) return null;
    const audio = allFiles.filter((item) => item.relative.includes(`托福样题0${match[1]}音频/`));
    return [`官方学生版样题 ${match[1]}`, audio];
  });
  await addPdfTests("02.", (relative) => /practice-test-(\d+)/i.test(relative) ? `官方教师版样题 ${relative.match(/test-(\d+)/i)?.[1]}` : null);
  await addPdfTests("03.", (relative) => /(?:Practice|Pracitce) Test\s*(\d+)/i.test(relative) ? `官方体验日练习 ${relative.match(/Test\s*(\d+)/i)?.[1]}` : null);
  await addPdfTests("04.", (relative) => /付费-Test\s*1/i.test(relative) ? "付费新题 Test 1" : /付费-Test\s*2/i.test(relative) ? "付费新题 Test 2" : null);
  await addFolderChildren("05.");
  return groups.filter((group) => hasExamSource(group.files)).slice(0, 18);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await writeFile(path.join(target, ".gitkeep"), "");

let count = 0;
const sources = await getSourceDirs();
for (const source of sources) {
  if (!(await exists(source))) continue;
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const folderPath = path.join(source, entry.name);
    if (isTpoCollectionFolder(entry.name)) {
      const shared = (await walk(folderPath)).filter((file) => !file.relative.includes(path.sep) && /综述|策略|overview/i.test(file.relative));
      for (const group of await tpoVirtualGroups(folderPath)) {
        const virtualId = testIdForFolder(`${entry.name}/${group.name}`);
        const files = [...group.files, ...shared];
        for (const file of files) {
          const destination = path.join(target, virtualId, file.relative);
          await mkdir(path.dirname(destination), { recursive: true });
          await cp(file.from, destination);
          count += 1;
        }
      }
      continue;
    }
    const testId = await manifestId(folderPath, entry.name);
    const files = await walk(folderPath);
    for (const file of files) {
      const destination = path.join(target, testId, file.relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(file.from, destination);
      count += 1;
    }
  }
}

console.log(`Synced ${count} PDF/audio file${count === 1 ? "" : "s"} from ${sources.join(", ")} to public/content.`);
