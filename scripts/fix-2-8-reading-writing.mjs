import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACK = path.join(ROOT, "真题合集7-5", "2.8新托福真题");
const GENERATED = path.join(PACK, "generated");

async function readJson(name) {
  return JSON.parse(await readFile(path.join(GENERATED, name), "utf8"));
}

async function writeJson(name, data) {
  await writeFile(path.join(GENERATED, name), `${JSON.stringify(data, null, 2)}\n`);
}

function prompt(text) {
  return { type: "plain_text", text };
}

function blocks(title, paragraphs) {
  return {
    type: "blocks",
    blocks: [
      ...(title ? [{ type: "heading", level: 2, text: title }] : []),
      ...paragraphs.map((block) => typeof block === "string" ? { type: "paragraph", text: block } : { type: "paragraph", ...block })
    ]
  };
}

function blockText(block) {
  return typeof block === "string" ? block : block.text;
}

function sourceText(items) {
  return items.map(blockText).join("\n\n");
}

function options(questionId, values) {
  return values.map((text, index) => ({
    id: `${questionId}-option-${String.fromCharCode(97 + index)}`,
    label: String.fromCharCode(65 + index),
    text
  }));
}

function correctId(questionId, letter) {
  return `${questionId}-option-${letter.toLowerCase()}`;
}

function setStimulus(stimuli, id, { title, paragraphs, materialType }) {
  const stimulus = stimuli.find((item) => item.id === id);
  if (!stimulus) throw new Error(`Missing stimulus ${id}`);
  stimulus.stimulusType = `toefl.reading_${materialType}`;
  stimulus.title = title;
  stimulus.content = blocks(title, paragraphs);
  stimulus.config = {
    ...(stimulus.config || {}),
    materialType,
    extractionStatus: "human_verified",
    extractionConfidence: 1,
    defaultDisplayMode: "structured_text",
    visualRestoration: "structured_dom",
    structuredTemplate: materialType,
    humanVerificationStatus: "verified",
    verificationSource: "verified-content.json"
  };
}

function updateChoice(question, spec, answerKey) {
  const opts = options(question.id, spec.options);
  question.questionType = spec.questionType || question.questionType;
  question.rendererId = "toefl.reading_choice";
  question.scoringStrategyId = "toefl.exact_single_choice";
  question.prompt = prompt(spec.prompt);
  question.config = {
    ...(question.config || {}),
    options: opts,
    correctOptionId: correctId(question.id, spec.answer),
    importedAnswer: spec.answer.toLowerCase(),
    selectionMode: "single",
    displayMode: "structured",
    readiness: "structured_ready",
    extractionStatus: "human_verified",
    humanVerificationStatus: "verified",
    verifiedOverrideSource: "verified-content.json",
    sourceQuestionNumber: question.number
  };
  question.needsReview = false;
  question.status = "published";
  question.confidence = 1;
  answerKey[question.id] = question.config.correctOptionId;
}

function completeBlank(id, answer, prefix, missingLength) {
  return { id, prefix, missingLength, answer };
}

function updateCompleteWords(question, answer, prefix, missingLength, answerKey) {
  const blankId = `${question.id}-blank`;
  question.config = {
    ...(question.config || {}),
    blanks: [completeBlank(blankId, answer, prefix, missingLength)],
    correctValues: { [blankId]: answer },
    displayMode: "structured",
    readiness: "structured_ready",
    extractionStatus: "human_verified",
    humanVerificationStatus: "verified",
    verifiedOverrideSource: "verified-content.json"
  };
  question.needsReview = false;
  question.status = "published";
  question.confidence = 1;
  answerKey[question.id] = { type: "complete_words", values: { [blankId]: answer } };
}

function updateWriting(question, stimulus, task) {
  question.prompt = prompt(task.prompt);
  question.config = {
    ...(question.config || {}),
    context: task.context,
    instructions: sourceText(task.sourceMaterial),
    displayMode: "structured",
    readiness: "structured_ready",
    aiScoringReady: true,
    aiScoringInput: {
      taskType: question.questionType,
      instructions: sourceText(task.sourceMaterial),
      sourceMaterial: sourceText(task.sourceMaterial),
      prompt: task.prompt,
      rubricId: task.rubricId
    },
    rubricId: task.rubricId,
    humanVerificationStatus: "verified",
    verifiedOverrideSource: "verified-content.json"
  };
  question.needsReview = false;
  question.status = "published";
  question.confidence = 1;
  stimulus.stimulusType = `toefl.writing_${task.materialType}`;
  stimulus.title = task.title;
  stimulus.content = blocks(task.title, task.sourceMaterial);
  stimulus.config = {
    ...(stimulus.config || {}),
    materialType: task.materialType,
    extractionStatus: "human_verified",
    extractionConfidence: 1,
    defaultDisplayMode: "structured_text",
    visualRestoration: "structured_dom",
    structuredTemplate: task.materialType,
    humanVerificationStatus: "verified",
    verificationSource: "verified-content.json",
    aiScoringReady: true
  };
}

function syncTest(test, questions, stimuli) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const stimuliById = new Map(stimuli.map((stimulus) => [stimulus.id, stimulus]));
  for (const section of test.sections || []) {
    for (const examModule of section.modules || []) {
      for (const item of examModule.questions || []) {
        const question = byId.get(item.id);
        if (!question) continue;
        item.prompt = question.prompt?.text || item.prompt;
        item.needsReview = Boolean(question.needsReview);
        item.confidence = question.confidence;
        item.displayMode = question.config?.displayMode || item.displayMode;
        item.assetIds = question.assetIds;
        item.imageAssetId = question.config?.imageAssetId || item.imageAssetId;
        item.options = question.config?.options || item.options || [];
        item.correctOptionId = question.config?.correctOptionId || item.correctOptionId;
        item.blanks = question.config?.blanks || item.blanks || [];
        item.correctValues = question.config?.correctValues || item.correctValues || {};
        const stimulus = stimuliById.get(question.stimulusId);
        if (stimulus?.content?.type === "blocks") {
          item.passageId = stimulus.id;
        }
      }
    }
  }
}

function dedupeStimuli(stimuli) {
  const bestById = new Map();
  for (const stimulus of stimuli) {
    const existing = bestById.get(stimulus.id);
    const score = (item) => {
      let value = 0;
      if (item.content?.type === "blocks") value += 4;
      if (item.config?.humanVerificationStatus === "verified") value += 3;
      if (item.stimulusType !== "source_image_fallback") value += 2;
      if (item.config?.extractionStatus === "human_verified") value += 1;
      return value;
    };
    if (!existing || score(stimulus) > score(existing)) {
      bestById.set(stimulus.id, stimulus);
    }
  }
  stimuli.splice(0, stimuli.length, ...bestById.values());
}

const readingMaterials = {
  library: {
    ids: ["reading-m1-q21-stimulus", "reading-m1-q22-stimulus"],
    title: "Cranston Library",
    materialType: "plain_passage",
    paragraphs: [
      "Open Monday-Friday, 9:00 A.M.-6:00 P.M. Saturday and Sunday, 10:00 A.M.-5:00 P.M.",
      "Food or drinks allowed only in the entrance area cafe.",
      "Keep voices to a minimum.",
      "Return books that are not being checked out to the front desk when finished; do not reshelve.",
      "For assistance, contact library staff at 555-8504."
    ]
  },
  photography: {
    ids: ["reading-m1-q23-stimulus", "reading-m1-q24-stimulus", "reading-m1-q25-stimulus"],
    title: "The University Photography Club",
    materialType: "plain_passage",
    paragraphs: [
      "The University Photography Club invites you to a weekend of learning and creativity at the Student Center. Tickets are $5. The annual event is open to beginners and experienced photographers alike. Bring your own camera, optional, and a desire to discover your craft.",
      "Saturday, October 5\n9:00-10:30 Registration and Welcome Coffee\n10:30-12:00 Introduction to Photography: Basics of camera settings, composition, and lighting\n12:00-1:30 Lunch (not provided)\n1:30-3:00 Practical Photography: techniques for capturing portraits\n3:30-4:30 Landscape Photography: tips for natural and urban shots",
      "Sunday, October 6\n9:00-10:30 Photo Editing: software tools for images with editing software\n10:30-12:00 Travel Photography: capture candid moments\n1:30-3:00 Advanced Techniques: creative methods for unique shots\n3:00-4:30 Photo Critique and Q&A with local experts for advice",
      "Register at universityphotographyclub.org. Contact Eliza at uphoto@university.edu."
    ]
  },
  smart: {
    ids: ["reading-m1-q26-stimulus", "reading-m1-q27-stimulus", "reading-m1-q28-stimulus", "reading-m1-q29-stimulus", "reading-m1-q30-stimulus"],
    title: "Smart Textiles",
    materialType: "academic_passage",
    paragraphs: [
      "Smart textiles are revolutionizing the fashion industry by integrating advanced digital technology into fabrics. These textiles can respond to environmental changes, monitor physical activity, and even generate energy. One example is phase-change materials that adapt to temperature fluctuations, providing warmth when it's cold and cooling when it's hot. Another innovation is textiles embedded with sensors that track health metrics, such as heart rate and body temperature. These developments offer promising applications for athletes and medical patients.",
      "Researchers are also exploring textiles that harvest energy from movement. These fabrics utilize piezoelectric materials that generate electricity when subjected to mechanical stress. [A] Envision clothing that can charge your smartphone simply through your daily activities. [B] Moreover, smart textiles can be designed to change color or pattern based on electrical stimuli, opening up new possibilities for both fashion and interior design. [C]",
      "Yet, integrating technology into textiles presents challenges. [D] Durability, washability, and cost are significant concerns. Since their initial cost will be higher than traditional fabrics, ensuring that smart textiles can withstand regular use without degrading is essential for their widespread adoption. Protecting privacy is another concern of many; smart textiles could collect vast amounts of user data that must be properly secured."
    ]
  },
  coral: {
    ids: ["reading-m1-q31-stimulus", "reading-m1-q32-stimulus", "reading-m1-q33-stimulus", "reading-m1-q34-stimulus", "reading-m1-q35-stimulus"],
    title: "The Impact of Climate Change on Coral Reefs",
    materialType: "academic_passage",
    paragraphs: [
      "Coral reefs are among the most diverse and valuable ecosystems on Earth, providing habitat for countless marine species. However, climate change poses a severe threat to these vibrant underwater communities. Rising sea temperatures lead to coral bleaching, a phenomenon where corals lose their color and essential symbiotic algae, resulting in weakened corals that are more susceptible to disease.",
      "In addition to temperature changes, climate change contributes to ocean acidification through increased atmospheric CO2 levels. Ocean acidification reduces the availability of calcium carbonate, a crucial component of coral skeletons. [A] As the acidity of seawater increases, corals struggle to maintain their structures, leading to diminished reef growth and stability. [B]",
      "Efforts to mitigate these impacts include developing coral species that are more resilient to temperature fluctuations and acidification. [C] Scientists are exploring selective breeding and genetic modification as potential solutions. Furthermore, initiatives to reduce CO2 emissions globally aim to alleviate the stress on coral reefs. [D] The survival of coral reefs depends largely on addressing climate change comprehensively."
    ]
  }
};

const m2CompleteText = "Climate change refers to significant and lasting changes in weather patterns over periods ranging from decades to millions of years. It is driven by natural factors like volcanic eruptions and human activities such as burning fossil fuels and removing trees, which release large amounts of greenhouse gases into the atmosphere. These gases trap heat, leading to global warming, rising sea levels, and more extreme weather events. Addressing climate change requires sustainable practices and international cooperation to mitigate its impacts.";
const m2Blanks = [
  ["driven", "dri", 3],
  ["natural", "nat", 4],
  ["like", "li", 2],
  ["eruptions", "erup", 5],
  ["human", "hu", 3],
  ["such", "su", 2],
  ["burning", "bur", 4],
  ["fuels", "fu", 3],
  ["removing", "remo", 4],
  ["which", "wh", 3]
];

const readingQuestionFixes = {
  "reading-m1-q30": {
    prompt: "Where would the sentence best fit? Select a location to add the sentence to the passage.",
    answer: "c",
    options: ["Location A", "Location B", "Location C", "Location D"]
  },
  "reading-m1-q35": {
    prompt: "Where would the sentence best fit? Select a location to add the sentence to the passage.",
    answer: "b",
    options: ["Location A", "Location B", "Location C", "Location D"]
  }
};

const writingTasks = {
  "writing-q11": {
    title: "Issue with kitchen appliance purchase",
    prompt: "Write an email to Ms. Parker about the issue with your kitchen appliance purchase.",
    materialType: "email",
    context: "You recently purchased a new kitchen appliance from a store called Home Essentials. After using it for a few days, you noticed some problems with it. You want to inform the customer service representative, Ms. Parker, about the issue.",
    sourceMaterial: [
      "Issue with kitchen appliance purchase",
      { text: "To: Ms. Parker", config: { role: "email_header", labelWeight: "bold" } },
      { text: "Subject: Issue with kitchen appliance purchase", config: { role: "email_header", labelWeight: "bold" } },
      "You recently purchased a new kitchen appliance from a store called Home Essentials. After using it for a few days, you noticed some problems with it. You want to inform the customer service representative, Ms. Parker, about the issue.",
      { text: "Write an email to Ms. Parker. In your email, do the following:", config: { role: "instruction", weight: "bold" } },
      { text: "Describe the issue you are experiencing with the kitchen appliance.", config: { role: "bullet" } },
      { text: "Explain why this issue is problematic for you.", config: { role: "bullet" } },
      { text: "Request a replacement or repair for the appliance.", config: { role: "bullet" } },
      "Write as much as you can and in complete sentences."
    ],
    rubricId: "toefl.writing.email"
  },
  "writing-q12": {
    title: "Academic Discussion: Advertising and Consumer Behavior",
    prompt: "Do you think advertising has a positive or negative effect on consumer behavior? Why?",
    materialType: "academic_discussion",
    context: "Your professor is teaching a class on consumer studies. Write a post responding to the professor's question.",
    sourceMaterial: [
      "Your professor is teaching a class on consumer studies. Write a post responding to the professor's question.",
      { text: "In your response, you should do the following:", config: { role: "instruction", weight: "bold" } },
      { text: "Express and support your opinion.", config: { role: "bullet" } },
      { text: "Make a contribution to the discussion in your own words.", config: { role: "bullet" } },
      "An effective response will contain at least 100 words.",
      { text: "Dr. Diaz: We've been discussing the influence of advertising on consumer behavior. Advertisements can inform consumers about new products and services, such as the latest tech products or new local businesses, potentially boosting sales and driving economic growth. However, some experts argue that advertisements can be deceptive, create unrealistic expectations about products, and promote materialistic values. Reflect on a specific advertisement that influenced your behavior. Do you think its impact was positive or negative? Why?", config: { role: "speaker", speaker: "Dr. Diaz" } },
      { text: "Paul: I think the primary effect of advertising is to inform consumers. Ads provide valuable information about products and services, helping consumers make informed purchasing decisions and boosting economic growth.", config: { role: "speaker", speaker: "Paul", speakerType: "student" } },
      { text: "Claire: I believe advertisements mainly manipulate consumer choices. They often create unrealistic expectations and encourage materialism, leading people to buy things they don't need and fostering a culture of overconsumption.", config: { role: "speaker", speaker: "Claire", speakerType: "student" } }
    ],
    rubricId: "toefl.writing.academic_discussion"
  }
};

const questions = await readJson("questions.json");
const stimuli = await readJson("stimuli.json");
const answerKey = await readJson("answer-key.json");
const test = await readJson("test.json");
const exam = await readJson("exam.json");

for (const material of Object.values(readingMaterials)) {
  for (const id of material.ids) {
    setStimulus(stimuli, id, material);
  }
}

setStimulus(stimuli, "reading-m2-q1-10-stimulus", {
  title: "Fill in the missing letters in the paragraph.",
  materialType: "plain_passage",
  paragraphs: [m2CompleteText]
});
for (const [index, [answer, prefix, missingLength]] of m2Blanks.entries()) {
  const question = questions.find((item) => item.id === `reading-m2-q${index + 1}`);
  if (!question) throw new Error(`Missing reading-m2-q${index + 1}`);
  updateCompleteWords(question, answer, prefix, missingLength, answerKey);
}

for (const [id, spec] of Object.entries(readingQuestionFixes)) {
  const question = questions.find((item) => item.id === id);
  if (!question) throw new Error(`Missing ${id}`);
  updateChoice(question, spec, answerKey);
}

for (const [id, task] of Object.entries(writingTasks)) {
  const question = questions.find((item) => item.id === id);
  if (!question) throw new Error(`Missing ${id}`);
  const stimulus = stimuli.find((item) => item.id === question.stimulusId);
  if (!stimulus) throw new Error(`Missing stimulus ${question.stimulusId}`);
  updateWriting(question, stimulus, task);
}

dedupeStimuli(stimuli);
syncTest(test, questions, stimuli);
exam.config = {
  ...(exam.config || {}),
  publicationStatus: "needs_review",
  humanVerificationStatus: "reading_writing_verified_pending_listening",
  verifiedContentSource: "verified-content.json",
  formatProfile: "toefl-2026-3.2b-final"
};

await writeJson("questions.json", questions);
await writeJson("stimuli.json", stimuli);
await writeJson("answer-key.json", answerKey);
await writeJson("test.json", test);
await writeJson("exam.json", exam);
await writeFile(path.join(PACK, "verified-content.json"), `${JSON.stringify({
  examId: "28-12326eea",
  sourceFolder: "2.8新托福真题",
  sourceFiles: {
    reading: "2.8新托福真题阅读.docx",
    listening: "2.8新托福真题听力.docx",
    writing: "2.8新托福真题写作.docx",
    answers: "2.8新托福真题答案.docx"
  },
  readingStatus: "reading_materials_and_module2_complete_words_verified",
  writingStatus: "long_writing_tasks_verified",
  listeningStatus: "pending_option_extraction"
}, null, 2)}\n`);

console.log(JSON.stringify({ readingMaterials: Object.keys(readingMaterials).length, readingChoiceFixes: Object.keys(readingQuestionFixes).length, writingTasks: Object.keys(writingTasks).length }, null, 2));
