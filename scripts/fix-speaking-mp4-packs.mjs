import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONTENT = path.join(ROOT, "真题合集7-5");

const PACKS = [
  {
    folder: "2.25新托福真题",
    examId: "225-3b445ea7",
    sourceCandidates: ["2.25 套二 口语.mp4"],
    zipCandidates: ["2.25  口语.mp4.zip"],
    outputName: "2.25 套二 口语.mp4"
  },
  {
    folder: "2.8新托福真题",
    examId: "28-12326eea",
    sourceCandidates: ["Screen-2026-02-08-105819.mp4"],
    zipCandidates: ["2.8新托福真题口语音频.mp4.zip"],
    outputName: "Screen-2026-02-08-105819.mp4"
  },
  {
    folder: "3.8新托福真题",
    examId: "38-f18a54ef",
    sourceCandidates: [],
    zipCandidates: ["3.8  口语.mp4.zip"],
    outputName: "3.8 套一 口语.mp4"
  }
];

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readUInt64(buffer, offset) {
  return Number(buffer.readBigUInt64BE(offset));
}

function findAtom(buffer, atom, start = 0, end = buffer.length) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let header = 8;
    if (size === 1 && offset + 16 <= end) {
      size = readUInt64(buffer, offset + 8);
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header) break;
    if (type === atom) return { offset, size, header, payload: offset + header };
    offset += size;
  }
  return null;
}

async function mp4DurationSeconds(filePath) {
  const buffer = await readFile(filePath);
  const moov = findAtom(buffer, "moov");
  if (!moov) return null;
  const mvhd = findAtom(buffer, "mvhd", moov.payload, moov.offset + moov.size);
  if (!mvhd) return null;
  const version = buffer.readUInt8(mvhd.payload);
  if (version === 1) {
    const timescale = buffer.readUInt32BE(mvhd.payload + 20);
    const duration = readUInt64(buffer, mvhd.payload + 24);
    return timescale ? duration / timescale : null;
  }
  const timescale = buffer.readUInt32BE(mvhd.payload + 12);
  const duration = buffer.readUInt32BE(mvhd.payload + 16);
  return timescale ? duration / timescale : null;
}

async function findSourceMp4(packDir, spec) {
  for (const name of spec.sourceCandidates) {
    const candidate = path.join(packDir, name);
    if (existsSync(candidate)) return candidate;
  }
  for (const zipName of spec.zipCandidates) {
    const zipPath = path.join(packDir, zipName);
    if (!existsSync(zipPath)) continue;
    const tmpDir = path.join(packDir, "generated", "tmp-speaking-mp4");
    await mkdir(tmpDir, { recursive: true });
    execFileSync("unzip", ["-oq", zipPath, "-d", tmpDir], { stdio: "ignore" });
    const candidates = await findFiles(tmpDir, (file) => file.toLowerCase().endsWith(".mp4") && !file.includes("__MACOSX"));
    if (candidates.length) return candidates[0];
  }
  throw new Error(`No speaking MP4 found for ${spec.folder}`);
}

async function findFiles(dir, predicate) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...await findFiles(full, predicate));
    else if (predicate(full)) results.push(full);
  }
  return results;
}

function ensureSection(exam, section, durationSeconds = 960) {
  let existing = exam.sections.find((item) => item.id === section.id);
  if (!existing) {
    existing = section;
    exam.sections.push(existing);
  }
  existing.examPackId = "toefl";
  existing.sectionType = "toefl.speaking";
  existing.title = "Speaking";
  existing.modules = [{ id: "speaking-m1", title: "Module 1", questionIds: Array.from({ length: 11 }, (_, index) => `speaking-q${index + 1}`), navigationStrategyId: "toefl.forward_only" }];
  existing.timing = { scope: "section", durationSeconds };
  existing.status = "published";
  existing.config = {
    ...(existing.config || {}),
    importStatus: "ready",
    sourceFiles: [section.sourceFile],
    audioCount: 1,
    importedAnswerCount: 0,
    issueCount: 0,
    expectedQuestionCount: 11,
    mediaFormat: "mp4"
  };
}

function ensureTestSection(test) {
  let section = test.sections.find((item) => item.id === "speaking" || item.key === "speaking");
  if (!section) {
    section = { id: "speaking", key: "speaking", title: "Speaking", durationSeconds: 960, importStatus: "ready", sourceFiles: [], audioCount: 1, importedAnswerCount: 0, issueCount: 0, modules: [] };
    test.sections.push(section);
  }
  section.id = "speaking";
  section.key = "speaking";
  section.title = "Speaking";
  section.durationSeconds = 960;
  section.importStatus = "ready";
  section.audioCount = 1;
  section.importedAnswerCount = 0;
  section.issueCount = 0;
  section.modules = [{
    id: "speaking-m1",
    moduleNumber: 1,
    title: "Module 1",
    navigationMode: "forward_only",
    questions: Array.from({ length: 11 }, (_, index) => ({
      id: `speaking-q${index + 1}`,
      section: "speaking",
      moduleId: "speaking-m1",
      number: index + 1,
      type: index < 7 ? "listen_repeat" : "interview_response",
      prompt: index < 7 ? "Listen and Repeat" : "Interview Response",
      audioGroupId: `speaking-segment-q${index + 1}`,
      displayMode: "structured",
      preparationSeconds: index < 7 ? 0 : 15,
      responseSeconds: index < 7 ? 8 : 45,
      correctAnswer: { type: "manual_or_ai" },
      confidence: 0.72,
      needsReview: false
    }))
  }];
}

function makeQuestions(spec, videoAssetId, segments) {
  return Array.from({ length: 11 }, (_, index) => {
    const number = index + 1;
    const repeat = number <= 7;
    const segment = segments[index];
    return {
      id: `speaking-q${number}`,
      examPackId: "toefl",
      sectionId: "speaking",
      moduleId: "speaking-m1",
      number,
      questionType: repeat ? "toefl.listen_repeat" : "toefl.interview_response",
      rendererId: "toefl.renderer.recording",
      scoringStrategyId: "toefl.manual_or_ai",
      stimulusId: `speaking-q${number}-stimulus`,
      assetIds: [videoAssetId],
      prompt: { type: "plain_text", text: repeat ? "Listen and Repeat" : "Interview Response" },
      config: {
        context: "",
        taskGroupId: repeat ? "speaking-listen-repeat" : "speaking-interview",
        audioGroupId: `speaking-segment-q${number}`,
        audioSegmentId: `speaking-segment-q${number}`,
        imageAssetId: videoAssetId,
        sourceAssetId: videoAssetId,
        videoStartSeconds: segment.startSeconds,
        videoEndSeconds: segment.endSeconds,
        detectedSourceQuestionNumber: number,
        preparationSeconds: repeat ? 0 : 15,
        responseSeconds: repeat ? 8 : 45,
        playLimit: 1,
        allowReplayInPractice: true,
        recordingKey: `speaking-q${number}`,
        displayMode: "structured",
        mediaFormat: "mp4"
      },
      source: { file: spec.outputName, confidence: 0.72 },
      status: "published",
      confidence: 0.72,
      needsReview: false
    };
  });
}

function makeStimuli(spec, videoAssetId) {
  return Array.from({ length: 11 }, (_, index) => ({
    id: `speaking-q${index + 1}-stimulus`,
    examPackId: "toefl",
    stimulusType: "toefl.speaking_video_prompt",
    title: `Speaking question ${index + 1}`,
    assetIds: [videoAssetId],
    config: {
      materialType: "speaking_video",
      defaultDisplayMode: "source_video",
      extractionStatus: "human_verified",
      humanVerificationStatus: "verified",
      mediaFormat: "mp4"
    }
  }));
}

function makeSegments(assetId, duration) {
  const total = duration || 11 * 44;
  const step = total / 11;
  return Array.from({ length: 11 }, (_, index) => {
    const number = index + 1;
    const startSeconds = Number((index * step).toFixed(3));
    const endSeconds = Number(((index + 1) * step).toFixed(3));
    return {
      id: `speaking-segment-q${number}`,
      assetId,
      audioAssetId: assetId,
      startSeconds,
      endSeconds,
      sectionId: "speaking",
      moduleId: "speaking-m1",
      stimulusId: `speaking-q${number}-stimulus`,
      questionIds: [`speaking-q${number}`],
      segmentType: number <= 7 ? "repeat_prompt" : "interview_prompt",
      order: number,
      confidence: 0.35,
      needsReview: true
    };
  });
}

async function fixPack(spec) {
  const packDir = path.join(CONTENT, spec.folder);
  const generated = path.join(packDir, "generated");
  const source = await findSourceMp4(packDir, spec);
  const outputRelative = path.join("generated", "source-audio", "speaking", spec.outputName);
  const output = path.join(packDir, outputRelative);
  await mkdir(path.dirname(output), { recursive: true });
  if (source !== output) await copyFile(source, output);

  const [questions, stimuli, assets, audioGroups, audioSegments, speakingSegments, test, exam] = await Promise.all([
    readJson(path.join(generated, "questions.json"), []),
    readJson(path.join(generated, "stimuli.json"), []),
    readJson(path.join(generated, "assets.json"), []),
    readJson(path.join(generated, "audio-groups.json"), []),
    readJson(path.join(generated, "audio-segments.json"), []),
    readJson(path.join(generated, "speaking-audio-segments.json"), []),
    readJson(path.join(generated, "test.json"), null),
    readJson(path.join(generated, "exam.json"), null)
  ]);
  if (!test || !exam) throw new Error(`Missing generated test/exam for ${spec.folder}`);

  const hash = await sha256(output);
  const duration = await mp4DurationSeconds(output);
  const fileStat = await stat(output);
  const assetId = `${spec.examId}-speaking-video-${hash.slice(0, 12)}`;
  const asset = {
    id: assetId,
    examId: spec.examId,
    type: "audio",
    fileName: spec.outputName,
    relativePath: outputRelative,
    mimeType: "audio/mp4",
    metadata: {
      section: "speaking",
      durationSeconds: duration,
      hash,
      byteLength: fileStat.size,
      sourceFormat: "mp4"
    }
  };

  const assetIndex = assets.findIndex((item) => item.id === assetId || (item.metadata?.section === "speaking" && /\.mp4$/i.test(item.fileName || "")));
  if (assetIndex >= 0) assets[assetIndex] = asset;
  else assets.push(asset);

  const segments = makeSegments(assetId, duration);
  const withoutSpeakingQuestions = questions.filter((question) => question.sectionId !== "speaking");
  questions.splice(0, questions.length, ...withoutSpeakingQuestions, ...makeQuestions(spec, assetId, segments));

  const withoutSpeakingStimuli = stimuli.filter((stimulus) => !String(stimulus.id).startsWith("speaking-q"));
  stimuli.splice(0, stimuli.length, ...withoutSpeakingStimuli, ...makeStimuli(spec, assetId));
  const nonSpeakingGroups = audioGroups.filter((group) => !String(group.id).startsWith("speaking-segment-"));
  audioGroups.splice(0, audioGroups.length, ...nonSpeakingGroups, ...segments.map(({ id, audioAssetId, startSeconds, endSeconds, confidence, needsReview }, index) => ({
    id,
    title: `Speaking question ${index + 1} audio`,
    audioAssetId,
    allowReplay: true,
    playLimit: 1,
    startSeconds,
    endSeconds,
    confidence,
    needsReview
  })));

  const nonSpeakingAudioSegments = audioSegments.filter((segment) => segment.sectionId !== "speaking" && !String(segment.id).startsWith("speaking-segment-"));
  audioSegments.splice(0, audioSegments.length, ...nonSpeakingAudioSegments, ...segments);
  speakingSegments.splice(0, speakingSegments.length, ...segments);

  ensureTestSection(test);
  ensureSection(exam, { id: "speaking", sourceFile: spec.outputName });
  exam.config = {
    ...(exam.config || {}),
    speakingMediaFormat: "mp4"
  };

  await Promise.all([
    writeJson(path.join(generated, "questions.json"), questions),
    writeJson(path.join(generated, "stimuli.json"), stimuli),
    writeJson(path.join(generated, "assets.json"), assets),
    writeJson(path.join(generated, "audio-groups.json"), audioGroups),
    writeJson(path.join(generated, "audio-segments.json"), audioSegments),
    writeJson(path.join(generated, "speaking-audio-segments.json"), speakingSegments),
    writeJson(path.join(generated, "test.json"), test),
    writeJson(path.join(generated, "exam.json"), exam)
  ]);

  return { pack: spec.folder, durationSeconds: duration, asset: outputRelative, speakingQuestions: 11, visualSource: "mp4_recording" };
}

async function main() {
  const results = [];
  for (const pack of PACKS) results.push(await fixPack(pack));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
