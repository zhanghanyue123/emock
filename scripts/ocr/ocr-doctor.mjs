import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const helper = path.join(root, ".bin", "apple-vision-ocr");
const source = "/Users/hanyue/Downloads/真题合集7-5/3.2新托福真题B卷/generated/docx-assets";

function run(command, args) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function firstImage(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await firstImage(full);
      if (nested) return nested;
    } else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) return full;
  }
  return null;
}

const checks = [];
checks.push({ name: "macOS", ok: process.platform === "darwin", detail: process.platform });
for (const tool of ["xcrun", "swiftc"]) {
  const result = run("/bin/zsh", ["-lc", `command -v ${tool}`]);
  checks.push({ name: tool, ok: result.status === 0, detail: result.stdout.trim() || result.stderr.trim() });
}
const sdk = run("xcrun", ["--show-sdk-path"]);
checks.push({ name: "macOS SDK", ok: sdk.status === 0, detail: sdk.stdout.trim() || sdk.stderr.trim() });
const helperExists = await exists(helper);
checks.push({ name: "compiled helper", ok: helperExists, detail: helper });
if (helperExists) {
  const mode = await stat(helper);
  checks.push({ name: "helper executable", ok: Boolean(mode.mode & 0o111), detail: String(mode.mode) });
}

const smokeImages = [
  ["listening", await firstImage(path.join(source, "3.2-套二-听力"))],
  ["writing", await firstImage(path.join(source, "3.2-套二-写作"))],
  ["speaking", await firstImage(path.join(source, "3.2-套二-口语"))]
];
checks.push(...smokeImages.map(([section, image]) => ({ name: `${section} smoke image`, ok: Boolean(image), detail: image || source })));
if (helperExists) {
  for (const [section, image] of smokeImages) {
    if (!image) continue;
    const result = run(helper, [image, `ocr-doctor-${section}`]);
    let textLength = 0;
    let confidence = 0;
    if (result.status === 0 && result.stdout.trim()) {
      const parsed = JSON.parse(result.stdout);
      const item = Array.isArray(parsed) ? parsed[0] : parsed;
      textLength = item.fullText?.length || 0;
      confidence = item.averageConfidence ?? item.confidence ?? 0;
    }
    checks.push({ name: `${section} smoke OCR`, ok: result.status === 0 && textLength > 0, detail: `exit=${result.status}; textLength=${textLength}; averageConfidence=${confidence}; stderr=${result.stderr.trim()}` });
  }
}

console.log(JSON.stringify({ checks }, null, 2));
if (checks.some((check) => !check.ok)) process.exit(1);
