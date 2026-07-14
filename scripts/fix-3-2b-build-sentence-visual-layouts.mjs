import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "真题合集7-5", "3.2新托福真题B卷", "generated");
const questionsPath = path.join(generatedDir, "questions.json");
const reportPath = path.join(generatedDir, "writing-build-sentence-layouts.json");

const questions = JSON.parse(await readFile(questionsPath, "utf8"));
const updated = [];

for (const question of questions) {
  if (question.sectionId !== "writing" || !question.questionType?.includes("build_sentence")) continue;
  const hadVisualLayout = Boolean(question.config?.visualLayout);
  if (hadVisualLayout) delete question.config.visualLayout;
  question.rendererId = "toefl.writing.build_sentence_inline";
  question.config = {
    ...question.config,
    displayMode: "structured",
    inlineInteraction: true,
    visualRestoration: "structured_dom",
    formalRendererReadsSourceImage: false
  };
  updated.push({
    questionId: question.id,
    number: question.number,
    removedVisualLayout: hadVisualLayout,
    tokenCount: Array.isArray(question.config.tokens) ? question.config.tokens.length : 0,
    slotCount: Array.isArray(question.config.slots) ? question.config.slots.length : 0,
    hasCorrectOrder: Array.isArray(question.config.correctTokenOrder)
  });
}

await writeFile(questionsPath, `${JSON.stringify(questions, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: "3.2 套二 写作.docx",
  renderingPolicy: "structured_dom_first",
  note: "Build a Sentence formal rendering uses a stable dialogue/card DOM template. Source screenshots and coordinate overlays are not used by the formal renderer.",
  questions: updated
}, null, 2)}\n`);

console.log(`Updated ${updated.length} 3.2B Build a Sentence questions for structured DOM rendering.`);
