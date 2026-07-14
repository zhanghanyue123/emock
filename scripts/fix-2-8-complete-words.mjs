import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const EXAM_FOLDER = path.resolve("真题合集7-5/2.8新托福真题");
const GENERATED_DIR = path.join(EXAM_FOLDER, "generated");

const tasks = [
  {
    moduleId: "reading-m1",
    displayUnitId: "reading-m1-complete-words-1",
    startQuestionNumber: 1,
    endQuestionNumber: 10,
    sourceAssetId: "28-12326eea-2.8新托福真题阅读-image1-93f2fa95",
    title: "Questions 1-10",
    instructions: "Fill in the missing letters in the paragraph.",
    paragraph:
      "Tigers are solitary animals known for their territorial behavior; males use scent markings and vocalizations to define their territories. Each ma tiger estab control ov a la territory span several squ miles a patrols t area regu to lo for prey and maintain dominance. This behavior helps reduce conflicts over prey, but tigers are known to fiercely defend their territory from intruders when necessary. Often hunting at night, tigers use stealth and their excellent night vision to their advantage.",
    blanks: [
      { questionNumber: 1, prefix: "ma", answer: "le", fullAnswer: "male" },
      { questionNumber: 2, prefix: "estab", answer: "lishes", fullAnswer: "establishes" },
      { questionNumber: 3, prefix: "ov", answer: "er", fullAnswer: "over" },
      { questionNumber: 4, prefix: "la", answer: "rge", fullAnswer: "large" },
      { questionNumber: 5, prefix: "span", answer: "ning", fullAnswer: "spanning" },
      { questionNumber: 6, prefix: "squ", answer: "are", fullAnswer: "square" },
      { questionNumber: 7, prefix: "a", suffix: " patrols ", answer: "nd", fullAnswer: "and" },
      { questionNumber: 8, prefix: "t", answer: "he", fullAnswer: "the" },
      { questionNumber: 9, prefix: "regu", answer: "larly", fullAnswer: "regularly" },
      { questionNumber: 10, prefix: "lo", answer: "ok", fullAnswer: "look" }
    ]
  },
  {
    moduleId: "reading-m1",
    displayUnitId: "reading-m1-complete-words-2",
    startQuestionNumber: 11,
    endQuestionNumber: 20,
    sourceAssetId: "28-12326eea-2.8新托福真题阅读-image2-04a89145",
    title: "Questions 11-20",
    instructions: "Fill in the missing letters in the paragraph.",
    paragraph:
      "Museums often serve as cultural hubs, preserving and exhibiting artifacts that reflect human history and creativity. They pro educational reso that he visitors under diverse cult, historical er, and arti movements. Exhi are desi to te compelling stories and engage the audience. Museums also play a crucial role in conservation, employing techniques to preserve delicate or ancient items. They foster a deeper appreciation for heritage and inspire curious minds to explore the past and present through tangible connections.",
    blanks: [
      { questionNumber: 11, prefix: "pro", answer: "vide", fullAnswer: "provide" },
      { questionNumber: 12, prefix: "reso", answer: "urces", fullAnswer: "resources" },
      { questionNumber: 13, prefix: "he", answer: "lp", fullAnswer: "help" },
      { questionNumber: 14, prefix: "under", answer: "stand", fullAnswer: "understand" },
      { questionNumber: 15, prefix: "cult", answer: "ural", fullAnswer: "cultural" },
      { questionNumber: 16, prefix: "er", answer: "as", fullAnswer: "eras" },
      { questionNumber: 17, prefix: "arti", answer: "stic", fullAnswer: "artistic" },
      { questionNumber: 18, prefix: "Exhi", answer: "bits", fullAnswer: "Exhibits" },
      { questionNumber: 19, prefix: "desi", answer: "gned", fullAnswer: "designed" },
      { questionNumber: 20, prefix: "te", answer: "ll", fullAnswer: "tell" }
    ]
  }
];

async function readJson(fileName) {
  return JSON.parse(await readFile(path.join(GENERATED_DIR, fileName), "utf8"));
}

async function writeJson(fileName, value) {
  await writeFile(path.join(GENERATED_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function blankId(questionNumber) {
  return `reading-m1-q${questionNumber}-blank`;
}

function answerMatchesExisting(question, taskBlank) {
  const current = String(question.config?.correctValues?.[blankId(taskBlank.questionNumber)] || question.config?.blanks?.[0]?.answer || "").toLowerCase();
  const currentFull = String(question.config?.blanks?.[0]?.fullAnswer || "").toLowerCase();
  return current === taskBlank.answer.toLowerCase() || current === taskBlank.fullAnswer.toLowerCase() || currentFull === taskBlank.fullAnswer.toLowerCase();
}

function paragraphParts(task) {
  const parts = [];
  let cursor = 0;
  for (const blank of task.blanks) {
    const target = `${blank.prefix}${blank.suffix || ""}`;
    const index = task.paragraph.indexOf(target, cursor);
    if (index < 0) throw new Error(`Could not locate target ${target} in ${task.displayUnitId}`);
    if (index > cursor) parts.push({ type: "text", text: task.paragraph.slice(cursor, index) });
    parts.push({ type: "blank", blankId: blankId(blank.questionNumber) });
    cursor = index + target.length;
  }
  if (cursor < task.paragraph.length) parts.push({ type: "text", text: task.paragraph.slice(cursor) });
  return parts;
}

const questions = await readJson("questions.json");
const stimuli = await readJson("stimuli.json");
const answerKey = await readJson("answer-key.json");
const audit = {
  examId: "28-12326eea",
  examFolder: EXAM_FOLDER,
  generatedAt: new Date().toISOString(),
  completeWordsTasks: []
};

for (const task of tasks) {
  const taskQuestions = questions.filter((question) =>
    question.sectionId === "reading" &&
    question.moduleId === task.moduleId &&
    question.number >= task.startQuestionNumber &&
    question.number <= task.endQuestionNumber
  );
  if (taskQuestions.length !== 10) throw new Error(`${task.displayUnitId} expected 10 questions but found ${taskQuestions.length}`);

  const parts = paragraphParts(task);
  const stimulus = stimuli.find((item) => item.id === task.displayUnitId);
  const nextStimulus = {
    id: task.displayUnitId,
    examPackId: "toefl",
    stimulusType: "reading_material",
    title: task.title,
    content: {
      type: "blocks",
      blocks: [
        {
          type: "paragraph",
          text: task.paragraph,
          parts
        }
      ]
    },
    assetIds: [],
    config: {
      questionRange: [task.startQuestionNumber, task.endQuestionNumber],
      displayMode: "complete_words_page",
      rendererId: "toefl.complete_words_group",
      sourceAssetId: task.sourceAssetId,
      sourceImageUsedOnlyForAudit: true
    }
  };
  if (stimulus) Object.assign(stimulus, nextStimulus);
  else stimuli.push(nextStimulus);

  const blanksAudit = [];
  for (const taskBlank of task.blanks) {
    const question = taskQuestions.find((item) => item.number === taskBlank.questionNumber);
    if (!question) throw new Error(`Missing question ${taskBlank.questionNumber}`);
    const id = blankId(taskBlank.questionNumber);
    const matched = answerMatchesExisting(question, taskBlank);
    question.questionType = "toefl.complete_words";
    question.rendererId = "toefl.complete_words_group";
    question.scoringStrategyId = "toefl.complete_words";
    question.stimulusId = task.displayUnitId;
    question.prompt = { type: "plain_text", text: task.instructions };
    question.assetIds = [];
    question.config = {
      ...question.config,
      blanks: [
        {
          id,
          questionNumber: taskBlank.questionNumber,
          prefix: taskBlank.prefix,
          suffix: taskBlank.suffix || "",
          missingLength: taskBlank.answer.length,
          answer: taskBlank.answer,
          fullAnswer: taskBlank.fullAnswer,
          sourceAssetId: task.sourceAssetId
        }
      ],
      correctValues: { [id]: taskBlank.answer },
      completeWordsTaskId: task.displayUnitId,
      sourceAssetId: task.sourceAssetId,
      imageAssetId: undefined,
      displayMode: "structured",
      readiness: "structured_ready",
      rendererId: "toefl.complete_words_group"
    };
    delete question.config.imageAssetId;
    question.needsReview = !matched;
    question.status = matched ? "published" : "reviewed";
    question.confidence = matched ? 0.95 : 0.65;
    answerKey[question.id] = { [id]: taskBlank.answer };
    blanksAudit.push({
      id,
      questionNumber: taskBlank.questionNumber,
      prefix: taskBlank.prefix,
      suffix: taskBlank.suffix || "",
      missingLength: taskBlank.answer.length,
      answerMatched: matched,
      fullAnswer: taskBlank.fullAnswer,
      sourceAssetId: task.sourceAssetId
    });
  }

  audit.completeWordsTasks.push({
    moduleId: task.moduleId,
    displayUnitId: task.displayUnitId,
    startQuestionNumber: task.startQuestionNumber,
    endQuestionNumber: task.endQuestionNumber,
    sourceAssetId: task.sourceAssetId,
    fullParagraphText: task.paragraph,
    characterCount: task.paragraph.length,
    blankCount: task.blanks.length,
    blanks: blanksAudit,
    rendererId: "toefl.complete_words_group",
    sourceImageUsedOnlyForAudit: true,
    needsReview: blanksAudit.some((blank) => !blank.answerMatched),
    warnings: blanksAudit.some((blank) => !blank.answerMatched) ? ["answer_mismatch_needs_review"] : []
  });
}

await writeJson("questions.json", questions);
await writeJson("stimuli.json", stimuli);
await writeJson("answer-key.json", answerKey);
await writeJson("reading-question-audit.json", audit);

console.log(JSON.stringify({
  updated: tasks.map((task) => task.displayUnitId),
  auditPath: path.join(GENERATED_DIR, "reading-question-audit.json"),
  summaries: audit.completeWordsTasks.map((task) => ({
    displayUnitId: task.displayUnitId,
    characterCount: task.characterCount,
    blankCount: task.blankCount,
    allAnswersMatched: task.blanks.every((blank) => blank.answerMatched)
  }))
}, null, 2));
