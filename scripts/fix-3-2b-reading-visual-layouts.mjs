import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "真题合集7-5", "3.2新托福真题B卷", "generated");
const questionsPath = path.join(generatedDir, "questions.json");
const stimuliPath = path.join(generatedDir, "stimuli.json");
const reportPath = path.join(generatedDir, "reading-visual-layouts.json");

const questions = JSON.parse(await readFile(questionsPath, "utf8"));
const stimuli = JSON.parse(await readFile(stimuliPath, "utf8"));

const readingStimulusIds = new Set(questions.filter((question) => question.sectionId === "reading").map((question) => question.stimulusId).filter(Boolean));
const revertedQuestions = [];
const revertedStimuli = [];

for (const question of questions) {
  if (question.sectionId !== "reading") continue;
  const previousDisplayMode = question.config?.displayMode;
  const hadVisualLayout = Boolean(question.config?.readingVisualLayout);
  question.config = {
    ...question.config,
    displayMode: "structured",
    readiness: "structured_ready"
  };
  delete question.config.readingVisualLayout;
  if (previousDisplayMode === "source_image" || previousDisplayMode === "source_image_overlay" || hadVisualLayout) {
    revertedQuestions.push({
      questionId: question.id,
      number: question.number,
      moduleId: question.moduleId,
      previousDisplayMode,
      removedReadingVisualLayout: hadVisualLayout
    });
  }
}

function templateFor(stimulus) {
  const type = stimulus.config?.materialType;
  if (stimulus.id.includes("complete-words")) return "complete_words";
  if (type === "form") return "table";
  if (type === "email") return "email";
  if (type === "notice") return "notice";
  if (type === "schedule") return "schedule";
  if (type === "advertisement") return "advertisement";
  if (type === "academic_passage") return "academic_passage";
  return "plain_passage";
}

function contentBlocks(stimulus) {
  return stimulus.content?.type === "blocks" && Array.isArray(stimulus.content.blocks) ? stimulus.content.blocks : [];
}

const templates = [];
for (const stimulus of stimuli) {
  if (!readingStimulusIds.has(stimulus.id)) continue;
  const blocks = contentBlocks(stimulus);
  const previousDefaultDisplayMode = stimulus.config?.defaultDisplayMode;
  stimulus.config = {
    ...stimulus.config,
    defaultDisplayMode: "structured_text",
    visualRestoration: "structured_dom",
    structuredTemplate: templateFor(stimulus)
  };
  if (!stimulus.config.extractionStatus && blocks.length) stimulus.config.extractionStatus = "human_verified";
  if (previousDefaultDisplayMode === "source_image") {
    revertedStimuli.push({
      stimulusId: stimulus.id,
      title: stimulus.title,
      template: stimulus.config.structuredTemplate,
      previousDefaultDisplayMode,
      sourceReference: stimulus.config.originalAssetIds?.[0] || null
    });
  }
  templates.push({
    stimulusId: stimulus.id,
    title: stimulus.title,
    template: stimulus.config.structuredTemplate,
    blockCount: blocks.length,
    sourceReference: stimulus.config.originalAssetIds?.[0] ? { sourceAssetId: stimulus.config.originalAssetIds[0] } : undefined,
    renderingPolicy: "structured_dom_first",
    visualStyle: {
      accentColor: stimulus.config.structuredTemplate === "notice" ? "#0f766e" : stimulus.config.structuredTemplate === "academic_passage" ? "#111827" : "#64748b",
      backgroundColor: "#ffffff",
      borderColor: stimulus.config.structuredTemplate === "notice" ? "#0f766e" : "#cbd5e1"
    }
  });
}

const sentenceInsertionQuestions = questions
  .filter((question) => question.sectionId === "reading" && question.config?.options?.some((option) => /^Location [A-D]$/.test(option.text)))
  .map((question) => ({
    questionId: question.id,
    stimulusId: question.stimulusId,
    markers: question.config.options.map((option) => ({
      label: option.label,
      optionId: option.id,
      markerText: `[${option.label}]`,
      insertionPositionId: `${question.id}-position-${option.label}`
    }))
  }));

await writeFile(questionsPath, `${JSON.stringify(questions, null, 2)}\n`);
await writeFile(stimuliPath, `${JSON.stringify(stimuli, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: "3.2 套二 阅读.docx",
  renderingPolicy: "structured_dom_first",
  note: "Formal Reading pages render verified structured text and CSS templates first. Source images remain only as View original / audit references.",
  revertedQuestions,
  revertedStimuli,
  templates,
  sentenceInsertionQuestions,
  fallbacks: []
}, null, 2)}\n`);

console.log(`Reverted ${revertedQuestions.length} Reading questions from source-image priority.`);
console.log(`Updated ${templates.length} Reading stimuli to structured DOM templates.`);
