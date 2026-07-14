import "server-only";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { getContentDirs, testIdForFolder } from "@/lib/content-source";

async function readGeneratedId(folder: string) {
  try {
    const parsed = JSON.parse(await readFile(path.join(folder, "generated", "test.json"), "utf8")) as { id?: string };
    return parsed.id;
  } catch {
    return null;
  }
}

export async function findSourceFolderByExamId(examId: string) {
  for (const contentDir of await getContentDirs()) {
    const entries = await readdir(contentDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const folder = path.join(contentDir, entry.name);
      if (entry.name === examId || testIdForFolder(entry.name) === examId) return folder;
      if ((await readGeneratedId(folder)) === examId) return folder;
    }
  }
  return null;
}
