import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const generatedDir = path.join(process.cwd(), "真题合集7-5", "3.2新托福真题B卷", "generated");
const questionsPath = path.join(generatedDir, "questions.json");

function slotColor(index) {
  const colors = ["#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3", "#ede9fe", "#e0f2fe", "#fee2e2", "#ecfccb"];
  return colors[index % colors.length];
}

const questions = JSON.parse(await readFile(questionsPath, "utf8"));
let updated = 0;

for (const question of questions) {
  if (question.questionType !== "toefl.build_sentence") continue;
  const tokens = Array.isArray(question.config?.tokens) ? question.config.tokens : [];
  question.rendererId = "toefl.writing.build_sentence_inline";
  question.config = {
    ...question.config,
    inlineInteraction: true,
    tokenColor: "#dbeafe",
    slotColor: "#f8fafc",
    highlightColor: "#2563eb",
    annotationColor: "#64748b",
    tokens: tokens.map((token, index) => ({
      ...token,
      color: token.color || slotColor(index),
      groupId: token.groupId || "sentence"
    })),
    slots: tokens.map((token, index) => ({
      id: `${question.id}-slot-${index + 1}`,
      index,
      expectedTokenIds: [String(token.id)],
      color: slotColor(index)
    }))
  };
  updated += 1;
}

await writeFile(questionsPath, `${JSON.stringify(questions, null, 2)}\n`);
console.log(`Updated ${updated} 3.2B Build a Sentence questions to inline interaction.`);
