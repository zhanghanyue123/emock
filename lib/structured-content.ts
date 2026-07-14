import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { getContentDirs } from "@/lib/content-source";
import type { ImportReport, StructuredTestBundle, TestDefinition, Passage, AudioGroup, TestAssetRecord } from "@/types/structured-test";
import type { ExamAsset, ExamDefinition, ExamQuestion, ExamStimulus } from "@/core/exam/types";

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function findTestFolder(testId: string) {
  for (const contentDir of await getContentDirs()) {
    try {
      const direct = path.join(contentDir, testId);
      await readdir(direct);
      return direct;
    } catch {
      const entries = await readdir(contentDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const folder = path.join(contentDir, entry.name);
        const generated = await readJson<TestDefinition>(path.join(folder, "generated", "test.json"));
        if (generated?.id === testId) return folder;
      }
    }
  }
  return null;
}

export async function getStructuredTestBundle(testId: string, options: { includeDrafts?: boolean } = {}): Promise<StructuredTestBundle | null> {
  const folder = await findTestFolder(testId);
  if (!folder) return null;
  const generatedDir = path.join(folder, "generated");
  const exam = await readJson<ExamDefinition>(path.join(generatedDir, "exam.json"));
  if (exam && (options.includeDrafts || exam.status === "published" || exam.status === "partially_published")) {
    const questions = (await readJson<ExamQuestion[]>(path.join(generatedDir, "questions.json"))) || [];
    const stimuli = (await readJson<ExamStimulus[]>(path.join(generatedDir, "stimuli.json"))) || [];
    const examAssets = (await readJson<ExamAsset[]>(path.join(generatedDir, "assets.json"))) || [];
    const audioGroups = (await readJson<AudioGroup[]>(path.join(generatedDir, "audio-groups.json"))) || [];
    const importReport = (await readJson<ImportReport>(path.join(generatedDir, "import-report.json"))) || undefined;
    const test: TestDefinition = {
      id: exam.id,
      title: exam.title,
      version: exam.version,
      status: exam.status === "draft" ? "draft" : "published",
      sections: exam.sections.map((section) => ({
        id: section.id,
        key: section.id as TestDefinition["sections"][number]["key"],
        title: section.title,
        instructions: section.instructions?.type === "plain_text" ? section.instructions.text : undefined,
        durationSeconds: section.timing?.durationSeconds,
        importStatus: section.status === "published" ? "ready" : section.status === "failed" ? "failed" : section.status === "needs_review" ? "needs_review" : section.status === "importing" ? "importing" : section.status === "detected" || section.status === "pending_import" ? "detected" : "not_detected",
        sourceFiles: Array.isArray(section.config?.sourceFiles) ? section.config.sourceFiles as string[] : [],
        audioCount: typeof section.config?.audioCount === "number" ? section.config.audioCount : 0,
        importedAnswerCount: typeof section.config?.importedAnswerCount === "number" ? section.config.importedAnswerCount : 0,
        issueCount: typeof section.config?.issueCount === "number" ? section.config.issueCount : 0,
        modules: section.modules.map((module, index) => ({
          id: module.id,
          moduleNumber: index + 1,
          title: module.title,
          navigationMode: "free",
          questions: module.questionIds
            .map((questionId) => questions.find((question) => question.id === questionId))
            .filter((question): question is ExamQuestion => Boolean(question))
            .map((question) => ({
              id: question.id,
              section: section.id as TestDefinition["sections"][number]["key"],
              moduleId: module.id,
              number: question.number,
              type: question.questionType.endsWith("complete_words")
                ? "complete_words"
                : question.questionType.includes("build_sentence")
                  ? "build_sentence"
                  : question.questionType.includes("write_email")
                    ? "write_email"
                    : question.questionType.includes("academic_discussion")
                      ? "academic_discussion"
                      : question.questionType.includes("listen_choose_response")
                        ? "listen_choose_response"
                        : question.questionType.includes("listening_group_choice")
                          ? "listening_group_question"
                      : question.questionType.includes("listen_repeat")
                        ? "listen_repeat"
                        : question.questionType.includes("interview_response")
                          ? "interview_response"
                          : question.questionType.includes("choice")
                            ? "single_choice"
                            : "write_email",
              prompt: question.prompt?.type === "plain_text" ? question.prompt.text : undefined,
              instructions: question.prompt?.type === "plain_text" ? question.prompt.text : undefined,
              passageId: question.stimulusId,
              options: Array.isArray(question.config.options) ? question.config.options as never : undefined,
              blanks: Array.isArray(question.config.blanks) ? question.config.blanks as never : undefined,
              wordBank: Array.isArray(question.config.tokens) ? question.config.tokens as never : undefined,
              buildSentenceSlots: Array.isArray(question.config.slots) ? question.config.slots as never : undefined,
              conversationPrompt: typeof question.config.conversationPrompt === "string" ? question.config.conversationPrompt : undefined,
              fixedPrefix: typeof question.config.fixedPrefix === "string" ? question.config.fixedPrefix : undefined,
              fixedSuffix: typeof question.config.fixedSuffix === "string" ? question.config.fixedSuffix : undefined,
              correctAnswer: question.questionType.endsWith("complete_words")
                ? { type: "complete_words", values: (question.config.correctValues || {}) as Record<string, string> }
                : question.questionType.includes("build_sentence") && Array.isArray(question.config.correctTokenOrder)
                  ? { type: "build_sentence", tokens: question.config.correctTokenOrder.map(String) }
                : typeof question.config.correctOptionId === "string" && question.questionType.includes("listen_choose_response")
                  ? { type: "listen_choose_response", optionId: question.config.correctOptionId }
                : typeof question.config.correctOptionId === "string" && question.questionType.includes("listening_group_choice")
                  ? { type: "listening_group_question", optionId: question.config.correctOptionId }
                : typeof question.config.correctOptionId === "string"
                  ? { type: "single_choice", optionId: question.config.correctOptionId }
                  : { type: "manual_or_ai" },
              explanation: typeof question.config.explanation === "string" ? question.config.explanation : undefined,
              audioGroupId: typeof question.config.audioGroupId === "string" ? question.config.audioGroupId : undefined,
              imageAssetId: typeof question.config.imageAssetId === "string" ? question.config.imageAssetId : undefined,
              assetIds: Array.isArray(question.assetIds) ? question.assetIds : undefined,
              speakingImageDisplay: question.config.speakingImageDisplay && typeof question.config.speakingImageDisplay === "object"
                ? question.config.speakingImageDisplay as never
                : undefined,
              displayMode: question.config.displayMode === "source_question_ready"
                ? "source_question_ready"
                : question.config.displayMode === "source_image_fallback"
                  ? "source_image_fallback"
                  : "structured",
              readiness: question.config.readiness === "source_question_ready" || question.config.readiness === "missing_question_data" || question.config.readiness === "structured_ready"
                ? question.config.readiness
                : undefined,
              questionImageAssetId: typeof question.config.questionImageAssetId === "string" ? question.config.questionImageAssetId : undefined,
              readingQuestionSource: question.config.readingQuestionSource && typeof question.config.readingQuestionSource === "object"
                ? question.config.readingQuestionSource as never
                : undefined,
              preparationSeconds: typeof question.config.preparationSeconds === "number" ? question.config.preparationSeconds : undefined,
              responseSeconds: typeof question.config.responseSeconds === "number" ? question.config.responseSeconds : undefined,
              videoStartSeconds: typeof question.config.videoStartSeconds === "number" ? question.config.videoStartSeconds : undefined,
              videoEndSeconds: typeof question.config.videoEndSeconds === "number" ? question.config.videoEndSeconds : undefined,
              sourcePage: question.source?.page,
              confidence: question.confidence,
              needsReview: question.needsReview
            }))
        }))
      }))
    };
    const passages: Passage[] = stimuli.map((stimulus) => {
      const config = stimulus.config || {};
      return {
        id: stimulus.id,
        title: stimulus.title,
        paragraphs: stimulus.content?.type === "blocks"
          ? stimulus.content.blocks.filter((block) => block.type === "paragraph").map((block, index) => {
            const paragraphBlock = block as typeof block & { config?: unknown };
            return {
              id: `${stimulus.id}-p${index + 1}`,
              text: paragraphBlock.text,
              config: paragraphBlock.config && typeof paragraphBlock.config === "object" ? paragraphBlock.config as never : undefined
            };
          })
          : stimulus.content?.type === "plain_text"
            ? [{ id: `${stimulus.id}-p1`, text: stimulus.content.text }]
            : [],
        materialType: typeof config.materialType === "string" ? config.materialType as Passage["materialType"] : undefined,
        extractionStatus: typeof config.extractionStatus === "string" ? config.extractionStatus as Passage["extractionStatus"] : undefined,
        extractionConfidence: typeof config.extractionConfidence === "number" ? config.extractionConfidence : undefined,
        defaultDisplayMode: config.defaultDisplayMode === "structured_text" || config.defaultDisplayMode === "source_image" ? config.defaultDisplayMode : undefined,
        originalAssetIds: Array.isArray(config.originalAssetIds) ? config.originalAssetIds.map(String) : undefined
      };
    });
    const assets: TestAssetRecord[] = examAssets.map((asset) => ({
      id: asset.id,
      type: asset.type === "audio" ? "audio" : asset.type === "image" ? "image" : asset.type === "pdf" ? "question_pdf" : "other",
      file: asset.relativePath,
      title: asset.fileName,
      mimeType: asset.mimeType
    }));
    return { test, passages, audioGroups, assets, importReport };
  }
  const test = await readJson<TestDefinition>(path.join(generatedDir, "test.json"));
  if (!test || (!options.includeDrafts && test.status !== "published")) return null;
  const passages = (await readJson<Passage[]>(path.join(generatedDir, "passages.json"))) || [];
  const audioGroups = (await readJson<AudioGroup[]>(path.join(generatedDir, "audio-groups.json"))) || [];
  const assets = (await readJson<TestAssetRecord[]>(path.join(generatedDir, "assets.json"))) || [];
  const importReport = (await readJson<ImportReport>(path.join(generatedDir, "import-report.json"))) || undefined;
  return { test, passages, audioGroups, assets, importReport };
}

export function getStructuredSection(bundle: StructuredTestBundle, sectionKey: string) {
  return bundle.test.sections.find((section) => section.key === sectionKey);
}
