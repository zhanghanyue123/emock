import path from "node:path";
import { classifySection, ensureGeneratedDir, readJson, walkFiles, writeJson } from "./utils.mjs";

const audioExtensions = new Set([".mp3", ".m4a", ".wav", ".mp4"]);

export async function matchAudioStage(testId) {
  const { folder, generatedDir } = await ensureGeneratedDir(testId);
  const files = await walkFiles(folder);
  const audioFiles = files.filter((file) => audioExtensions.has(path.extname(file).toLowerCase()));
  const assets = (await readJson(path.join(generatedDir, "assets.json"), [])).filter((asset) => asset.type !== "audio");
  const audioAssets = audioFiles.map((file, index) => ({
    id: `audio-${index + 1}`,
    type: "audio",
    file,
    title: path.basename(file, path.extname(file)),
    order: index + 1
  }));
  const audioGroups = audioAssets.map((asset) => ({
    id: `audio-group-${asset.order}`,
    title: asset.title,
    audioAssetId: asset.id,
    allowReplay: classifySection(asset.file) !== "listening",
    playLimit: classifySection(asset.file) === "listening" ? 1 : undefined
  }));
  await writeJson(path.join(generatedDir, "assets.json"), [...assets, ...audioAssets]);
  await writeJson(path.join(generatedDir, "audio-groups.json"), audioGroups);
  return { audioFiles: audioFiles.length, matchedAudio: audioGroups.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const testId = process.argv[2];
  if (!testId) throw new Error("Usage: node match-audio.mjs <testId>");
  console.log(await matchAudioStage(testId));
}
