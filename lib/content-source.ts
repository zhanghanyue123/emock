import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";

export const DEFAULT_CONTENT_DIR = path.join(process.cwd(), "content");
const CONFIG_FILE = path.join(process.cwd(), "content-source.local.json");

export const SUPPORTED_CONTENT_EXTENSIONS = new Set([".pdf", ".mp3", ".m4a", ".wav", ".mp4", ".png", ".jpg", ".jpeg", ".webp"]);
export const SUPPORTED_AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".wav", ".mp4"]);

export async function getContentDir() {
  if (process.env.TOEFL_CONTENT_DIR) return process.env.TOEFL_CONTENT_DIR;
  try {
    const parsed = JSON.parse(await readFile(CONFIG_FILE, "utf8")) as { contentDir?: string };
    return parsed.contentDir || DEFAULT_CONTENT_DIR;
  } catch {
    return DEFAULT_CONTENT_DIR;
  }
}

export async function getContentDirs() {
  const configured = await getContentDir();
  return configured === DEFAULT_CONTENT_DIR ? [DEFAULT_CONTENT_DIR] : [DEFAULT_CONTENT_DIR, configured];
}

export function testIdForFolder(folderName: string) {
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

export function safeRelativePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}
