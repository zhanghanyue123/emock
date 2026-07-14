import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACK = path.join(ROOT, "真题合集7-5", "3.29新托福真题");
const GENERATED = path.join(PACK, "generated");
const EXAM_ID = "329-84d84a55";

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

function sourceText(blocksList) {
  return blocksList.map(blockText).join("\n\n");
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

function setStimulus(stimuli, id, { title, paragraphs, materialType = "plain_passage", assetIds = [] }) {
  let touched = false;
  for (const stimulus of stimuli) {
    if (stimulus.id !== id) continue;
    touched = true;
    stimulus.stimulusType = `toefl.reading_${materialType}`;
    stimulus.title = title;
    stimulus.assetIds = stimulus.assetIds?.length ? stimulus.assetIds : assetIds;
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
  if (!touched) {
    stimuli.push({
      id,
      examPackId: "toefl",
      stimulusType: `toefl.reading_${materialType}`,
      title,
      assetIds,
      content: blocks(title, paragraphs),
      config: {
        materialType,
        extractionStatus: "human_verified",
        extractionConfidence: 1,
        defaultDisplayMode: "structured_text",
        visualRestoration: "structured_dom",
        structuredTemplate: materialType,
        humanVerificationStatus: "verified",
        verificationSource: "verified-content.json"
      }
    });
  }
}

function updateChoiceQuestion(question, spec, answerKey) {
  const opts = options(question.id, spec.options);
  question.questionType = spec.questionType || question.questionType;
  question.rendererId = spec.rendererId || question.rendererId;
  question.scoringStrategyId = "toefl.exact_single_choice";
  question.stimulusId = spec.stimulusId || question.stimulusId;
  question.prompt = prompt(spec.prompt);
  question.config = {
    ...(question.config || {}),
    selectionMode: "single",
    options: opts,
    correctOptionId: correctId(question.id, spec.answer),
    importedAnswer: spec.answer.toLowerCase(),
    displayMode: "structured",
    readiness: "structured_ready",
    extractionStatus: "human_verified",
    humanVerificationStatus: "verified",
    verifiedOverrideSource: "verified-content.json",
    sourceQuestionNumber: spec.sourceQuestionNumber || question.number
  };
  if (spec.sourceImageNumber) {
    question.config.detectedSourceQuestionNumber = spec.sourceQuestionNumber || question.number;
    question.config.sourceImageNumber = spec.sourceImageNumber;
  }
  question.needsReview = false;
  question.status = "published";
  question.confidence = 1;
  answerKey[question.id] = question.config.correctOptionId;
}

function findAssetBySourceImage(assets, sectionName, imageNumber) {
  const suffix = `generated/docx-assets/${sectionName}/image${imageNumber}.png`;
  return assets.find((asset) => asset.relativePath === suffix);
}

function detectLeftStimulusCrop({ data, info }) {
  const channels = info.channels;
  const xMax = Math.min(Math.floor(info.width * 0.52), 720);
  const yMin = Math.min(130, Math.floor(info.height * 0.22));
  let minX = xMax;
  let minY = info.height;
  let maxX = 0;
  let maxY = yMin;
  for (let y = yMin; y < info.height; y += 1) {
    for (let x = 0; x < xMax; x += 1) {
      const offset = (y * info.width + x) * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (r < 244 || g < 244 || b < 244) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    return {
      left: Math.min(90, info.width - 1),
      top: Math.min(130, info.height - 1),
      width: Math.min(620, info.width - 90),
      height: Math.min(720, info.height - 130)
    };
  }
  const padX = 72;
  const padTop = 54;
  const padBottom = 34;
  const x = Math.max(0, minX - padX);
  const y = Math.max(yMin, minY - padTop);
  const right = Math.min(xMax, maxX + padX);
  const bottom = Math.min(info.height, maxY + padBottom);
  return {
    left: x,
    top: y,
    width: Math.max(120, right - x),
    height: Math.max(120, bottom - y)
  };
}

async function ensureListeningStimulusAsset(assets, questionId, sourceAsset, sourceImageNumber) {
  const sourcePath = path.join(PACK, sourceAsset.relativePath);
  const raw = await sharp(sourcePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const cropRegion = detectLeftStimulusCrop(raw);
  const relativePath = `generated/derived-assets/listening/${questionId}-speaker.png`;
  const outputPath = path.join(GENERATED, "derived-assets", "listening", `${questionId}-speaker.png`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath).extract(cropRegion).png().toFile(outputPath);
  const buffer = await readFile(outputPath);
  const hash = createHash("sha256").update(buffer).digest("hex");
  const id = `${EXAM_ID}-${questionId}-speaker-${hash.slice(0, 8)}`;
  const existingIndex = assets.findIndex((asset) => asset.id === id);
  const record = {
    id,
    examId: EXAM_ID,
    type: "image",
    fileName: `${questionId}-speaker.png`,
    relativePath,
    mimeType: "image/png",
    metadata: {
      section: "listening",
      role: "speaker_image",
      derivedFrom: sourceAsset.id,
      questionId,
      sourceImageNumber,
      cropRegion,
      hash,
      humanVerifiedStimulus: true,
      note: "Cropped to the left-side visual stimulus for this 3.29 listening question."
    }
  };
  if (existingIndex >= 0) assets[existingIndex] = record;
  else assets.push(record);
  return id;
}

function updateListeningStimulus(stimuli, questionId, assetId, sourceAssetId, sourceQuestionNumber) {
  const id = `${questionId}-stimulus`;
  const stimulus = stimuli.find((item) => item.id === id);
  if (stimulus) {
    stimulus.stimulusType = "toefl.listening_stimulus_image";
    stimulus.assetIds = [assetId];
    stimulus.config = {
      ...(stimulus.config || {}),
      sourceAssetId,
      questionId,
      questionNumber: sourceQuestionNumber,
      humanVerificationStatus: "verified",
      verificationSource: "verified-content.json"
    };
  }
}

async function updateListeningQuestion(question, spec, assets, stimuli, answerKey) {
  const sourceAsset = findAssetBySourceImage(assets, "3.29-听力", spec.sourceImageNumber);
  if (!sourceAsset) throw new Error(`Missing listening source image ${spec.sourceImageNumber}`);
  const assetId = await ensureListeningStimulusAsset(assets, question.id, sourceAsset, spec.sourceImageNumber);
  const opts = options(question.id, spec.options);
  question.rendererId = "toefl.listening_choice";
  question.scoringStrategyId = "toefl.exact_single_choice";
  question.prompt = prompt(spec.prompt);
  question.assetIds = [assetId];
  question.config = {
    ...(question.config || {}),
    options: opts,
    correctOptionId: correctId(question.id, spec.answer),
    importedAnswer: spec.answer.toLowerCase(),
    imageAssetId: assetId,
    sourceAssetId: sourceAsset.id,
    originalImageAssetId: sourceAsset.id,
    sourceImageNumber: spec.sourceImageNumber,
    sourceQuestionNumber: question.number,
    listeningQuestionSource: {
      sourceQuestionNumber: question.number,
      fullSourceAssetId: sourceAsset.id,
      sourceImageNumber: spec.sourceImageNumber
    },
    selectionMode: "single",
    displayMode: "structured",
    readiness: "structured_ready",
    extractionStatus: "human_verified",
    humanVerificationStatus: "verified",
    verifiedOverrideSource: "verified-content.json"
  };
  question.needsReview = false;
  question.status = "published";
  question.confidence = 1;
  answerKey[question.id] = question.config.correctOptionId;
  updateListeningStimulus(stimuli, question.id, assetId, sourceAsset.id, question.number);
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
        item.audioGroupId = question.config?.audioGroupId || item.audioGroupId;
        if (Array.isArray(question.config?.options)) {
          item.options = question.config.options;
          item.correctAnswer = question.config.correctOptionId
            ? { type: question.sectionId === "listening" ? "listen_choose_response" : "single_choice", optionId: question.config.correctOptionId }
            : item.correctAnswer;
        }
        if (question.config?.correctValues) item.correctAnswer = { type: "complete_words", values: question.config.correctValues };
        const stimulus = stimuliById.get(question.stimulusId);
        if (stimulus?.content?.type === "blocks") {
          item.passageId = question.stimulusId;
        }
      }
    }
    const questionsInSection = (section.modules || []).flatMap((module) => module.questions || []);
    section.issueCount = questionsInSection.filter((question) => question.needsReview).length;
    if (section.issueCount === 0) section.importStatus = "ready";
  }
  test.config = {
    ...(test.config || {}),
    verifiedContentSource: "verified-content.json",
    publicationCandidate: true,
    updatedForContentCompletionAt: new Date().toISOString()
  };
}

const completeWordStimuli = {
  "reading-m1-complete-words-1": {
    title: "Fill in the missing letters in the paragraph.",
    paragraphs: [
      "We know from drawings that have been preserved in caves for over 10,000 years that early humans performed dances as a group activity. We might think that prehistoric people concentrated only on the basic work that was required for survival: hunting, gathering food, and making weapons and garments. However, it is clear from the record that group dancing was important to them. They made masks and costumes; they used much energy in the process of dancing; they recorded more drawings of dancing than of any other group activity."
    ]
  },
  "reading-m1-complete-words-2": {
    title: "Fill in the missing letters in the paragraph.",
    paragraphs: [
      "Museums play a crucial role in preserving and showcasing art, history, and culture. They provide a space where people can engage with multiple forms of artistic expression and historical artifacts. Many museums also offer educational programs and workshops, fostering a deeper understanding of the subjects they display. In addition, digital innovations have enabled museums to reach global audiences through virtual tours and online collections. The patronage of visual arts by individuals and organizations helps support artists and ensures the continued growth and diversity of the cultural landscape."
    ]
  },
  "reading-m2-complete-words-1": {
    title: "Fill in the missing letters in the paragraph.",
    paragraphs: [
      "Glassblowing began in the Roman Empire around the first century B.C.E. It involves shaping molten glass by blowing air into it through a tube, allowing artisans to create different shapes. Roman glassblowing crafted everyday items like cups, bottles, and decorative vases, making glass more widely available. Glassblowing is still carried out today for both artistic and functional purposes-creating everything from colorful sculptures and ornaments to custom lighting and scientific glassware."
    ]
  }
};
completeWordStimuli["reading-m2-q1-10-stimulus"] = completeWordStimuli["reading-m2-complete-words-1"];

const readingMaterials = {
  noticeDining: {
    stimulusIds: ["reading-m1-q21-stimulus", "reading-m1-q22-stimulus"],
    title: "Notice to Students and Staff",
    materialType: "plain_passage",
    paragraphs: [
      "Effective immediately, breakfast is no longer being served in the dining hall. However, coffee, tea, and pastries will continue to be available at the Campus Cafe, including vegetarian, vegan, and gluten-free options.",
      "For dietary needs questions, speak with cafe staff.",
      "To provide feedback, contact Dining Services."
    ]
  },
  pool: {
    stimulusIds: ["reading-m1-q23-stimulus", "reading-m1-q24-stimulus", "reading-m1-q25-stimulus"],
    title: "During the week of December 28-January 3, the swimming pool at Wilson Gym will be closed for maintenance.",
    materialType: "plain_passage",
    paragraphs: [
      "While the pool closes annually for a week of maintenance, this year's closure will bring a significant change: a transition from the current chlorinated sanitation system to a saltwater-based system. Saltwater systems generate chlorine naturally from dissolved salt, creating a more comfortable swimming experience. Many swimmers find the water less irritating to their skin, eyes, and hair because the chlorine levels stay more consistent. Saltwater systems also eliminate the strong chemical smell associated with manually added chlorine.",
      "The closure is timed to occur during winter break when many students are away. However, those remaining on campus who wish to swim during that week will have access to the pool at the YWCA on Biltmore St.",
      "To use that pool, simply show your student ID at the front desk."
    ]
  },
  opal: {
    stimulusIds: ["reading-m1-q26-stimulus", "reading-m1-q27-stimulus", "reading-m1-q28-stimulus", "reading-m1-q29-stimulus", "reading-m1-q30-stimulus"],
    title: "The Mysteries of Opal",
    materialType: "academic_passage",
    paragraphs: [
      "Opal is a unique gemstone, known for its vibrant colors that shift as the stone moves. Unlike most gemstones, which form rigid, repeating crystalline structures, opals are amorphous, meaning they lack a fixed internal shape. This is due to the formation process, where silica-rich water seeps into cracks in rocks deep underground, leaving silica deposits when it evaporates. Tiny silica spheres create the internal structure of opals, and these spheres diffract light, separating it into colors, much like a prism does.",
      "The color and brilliance of opals depends on the size and spacing of the silica spheres. Larger spheres produce reds and oranges, while smaller spheres result in blues and greens. Because of Australia's unique geological conditions, it is home to over 90 percent of the world's opals. Opals are also fragile. Their high water content and noncrystalline structure make them prone to cracking when exposed to sudden temperature changes. Modern jewelers use techniques such as laser cutting and humidity-controlled storage to better protect opals.",
      "Ancient cultures believed opals had mystical properties and brought good luck. The Romans saw them as a symbol of hope and purity, while the Greeks thought they gave the gift of prophecy."
    ]
  },
  radio: {
    stimulusIds: ["reading-m1-q31-stimulus", "reading-m1-q32-stimulus", "reading-m1-q33-stimulus", "reading-m1-q34-stimulus", "reading-m1-q35-stimulus"],
    title: "Radio Astronomy: A New Perspective",
    materialType: "academic_passage",
    paragraphs: [
      "Radio astronomy is the study of celestial objects using radio waves rather than visible light. Unlike optical telescopes, radio telescopes can detect signals from sources obscured by dust or too faint to be seen with traditional instruments. This branch of astronomy has led to transformative discoveries, including the detection of cosmic microwave background radiation-a faint glow left over from the Big Bang-which has enabled scientists to reconstruct the universe's early conditions.",
      "One of the most famous radio astronomy discoveries was the identification of pulsars in 1967. These rapidly spinning neutron stars, the dense remnants of massive stars that have exploded, emit beams of radio waves at regular intervals. Observing pulsars helps scientists understand the end stages of stellar life and the behavior of matter under extreme conditions.",
      "However, radio astronomy faces growing challenges due to technological interference. Devices like mobile phones, wireless routers, and satellites emit radio frequencies that can overwhelm the faint cosmic signals astronomers seek to detect. This \"radio frequency pollution\" makes it increasingly difficult to isolate genuine astronomical data. To combat this, observatories are often located in remote areas and protected by radio quiet zones, but the global spread of wireless technology continues to pose a serious threat."
    ]
  },
  gmo: {
    stimulusIds: ["reading-m2-q11-stimulus", "reading-m2-q12-stimulus", "reading-m2-q13-stimulus", "reading-m2-q14-stimulus", "reading-m2-q15-stimulus"],
    title: "Genetically Modified Foods",
    materialType: "academic_passage",
    paragraphs: [
      "The use of genetically modified organisms (GMOs) in foods has raised a number of concerns, yet genetic modification (GM) technology can provide solutions to many persistent problems facing humanity.",
      "For instance, by engineering crops to resist pests, tolerate drought, or grow in nutrient-poor soil, farmers can produce more food with fewer resources. This can be especially valuable in regions facing food insecurity or harsh environmental conditions. GM technology can also enhance nutritional content. Rice, for example, can be enriched with vitamin A to combat malnutrition. Furthermore, reduced reliance on chemical pesticides benefits both the environment and farm workers.",
      "Yet some critics anticipate harm from GMOs. One major issue is ecological impact. Genetically modified plants may crossbreed with wild species, potentially disrupting ecosystems or reducing biodiversity. GM critics also worry about long-term health effects, even though current scientific consensus finds GM foods safe to eat. Additionally, GM technology has economic effects: Patented GM seeds can increase farmers' dependence on large biotech companies, raising questions about fairness and control within the food system. Public skepticism remains strong, fueled by limited transparency and the rapid pace of technological change. If GM foods are to serve the public good, thoughtful regulation, candid communication, and ongoing research will be essential."
    ]
  }
};

const readingQuestions = {
  "reading-m1-q21": { stimulusId: "reading-m1-q21-stimulus", prompt: "What is the main purpose of this notice?", answer: "d", options: ["To solicit questions for the Campus Cafe staff", "To solicit feedback for Dining Services", "To inform about options for special diets", "To inform about the end of a dining option"] },
  "reading-m1-q22": { stimulusId: "reading-m1-q22-stimulus", prompt: "What can be inferred about the decision to stop serving breakfast in the dining hall?", answer: "c", options: ["It is related to renovation in the dining hall kitchen.", "It will be in effect until the end of the year.", "It was announced without advance warning.", "It was protested by students."] },
  "reading-m1-q23": { stimulusId: "reading-m1-q23-stimulus", prompt: "Which of the following can be inferred about the Wilson Gym swimming pool?", answer: "b", options: ["In past years, it has been closed for maintenance for a week in both winter and summer.", "The way in which chlorine was added to it likely caused an unpleasant smell.", "It is newer and larger than the swimming pool at the YWCA on Biltmore St.", "It is used for both recreational swimming and for competitive swimming events."] },
  "reading-m1-q24": { stimulusId: "reading-m1-q24-stimulus", prompt: "The announcement mentions each of the following EXCEPT", answer: "a", options: ["the cost benefits of a saltwater sanitation system", "information about what it's like to swim in a saltwater pool", "a reason for the timing of the closure of the Wilson Gym pool", "an option for those who wish to swim during the pool closure"] },
  "reading-m1-q25": { stimulusId: "reading-m1-q25-stimulus", prompt: "The announcement mentions \"dissolved salt\" primarily to", answer: "d", options: ["identify one cause of eye irritation among swimmers", "account for the strong chemical smell that some pools give off", "acknowledge one drawback of the new pool sanitation system", "explain an aspect of how the new pool sanitation system will work"] },
  "reading-m1-q26": { stimulusId: "reading-m1-q26-stimulus", prompt: "All of the following are mentioned as part of the formation process of opals EXCEPT:", answer: "d", options: ["Water flows into cracks in rocks.", "The water dries up, leaving silica deposits behind.", "Small spheres of silica create the structure of the gemstones.", "The structure formed is rigid and non-varying."] },
  "reading-m1-q27": { stimulusId: "reading-m1-q27-stimulus", prompt: "Why does the author mention \"a prism\"?", answer: "a", options: ["To illustrate how an opal affects light", "To explain how the internal structure of opals is created", "To give an example of how scientists study opals", "To argue that opals do not truly diffract light"] },
  "reading-m1-q28": { stimulusId: "reading-m1-q28-stimulus", prompt: "What is one consequence of the internal structure of opals?", answer: "d", options: ["90 percent of them are red or orange.", "Relatively little ancient opal jewelry has survived.", "They are easily damaged by water.", "Jewelers must use special care to prevent opals from cracking."] },
  "reading-m1-q29": { stimulusId: "reading-m1-q29-stimulus", prompt: "What does the passage suggest about ancient cultures' view of opals?", answer: "c", options: ["They understood how opals were formed.", "They found opals difficult to work with.", "They believed opals had special qualities that benefited their owners.", "They considered opals to be very durable."] },
  "reading-m1-q30": { stimulusId: "reading-m1-q30-stimulus", prompt: "The word \"prophecy\" in the passage is closest in meaning to", answer: "b", options: ["long life", "the ability to predict the future", "happiness", "high status"] },
  "reading-m1-q31": { stimulusId: "reading-m1-q31-stimulus", prompt: "What does the comparison of optical and radio telescopes suggest?", answer: "b", options: ["Traditional instruments are more susceptible to damage.", "Dust often interferes with the optical detection of objects in space.", "Radio telescopes are best for detecting massive stars.", "Optical telescopes were the first to detect cosmic microwave background radiation."] },
  "reading-m1-q32": { stimulusId: "reading-m1-q32-stimulus", prompt: "The word \"transformative\" in the passage is closest in meaning to", answer: "a", options: ["groundbreaking", "exciting", "concerning", "startling"] },
  "reading-m1-q33": { stimulusId: "reading-m1-q33-stimulus", prompt: "According to the passage, radio astronomy helps scientists study all of the following EXCEPT", answer: "b", options: ["the beginnings of the universe", "how to prevent the explosions of large stars", "the last stages of stars", "the way matter behaves under extreme conditions"] },
  "reading-m1-q34": { stimulusId: "reading-m1-q34-stimulus", prompt: "Why does the author mention \"the global spread of wireless technology\"?", answer: "a", options: ["To suggest that the issue of technological interference is not likely to end soon", "To argue that technological interference is not as severe as was once thought", "To support the argument that optical telescopes are more reliable than radio telescopes", "To highlight the sophisticated tools astronomers use to detect cosmic signals"] },
  "reading-m1-q35": { stimulusId: "reading-m1-q35-stimulus", prompt: "According to the passage, what is one way to address the issue of technological interference?", answer: "c", options: ["Revive the use of optical telescopes", "Limit wireless routers to certain frequencies", "Place observatories far away from urban areas", "Mandate specific quiet times when the use of wireless technology is prohibited"] },
  "reading-m2-q11": { stimulusId: "reading-m2-q11-stimulus", prompt: "The primary purpose of the passage is to", answer: "c", options: ["outline some benefits of GM technology and advocate for its adoption", "argue that GM technology is too dangerous and should be discontinued", "summarize some potential benefits and drawbacks related to the use of GM technology", "propose a set of steps toward resolving the debate over the use of GM technology"] },
  "reading-m2-q12": { stimulusId: "reading-m2-q12-stimulus", prompt: "The word \"persistent\" in the passage is closest in meaning to", answer: "b", options: ["disastrous", "long-lasting", "inconvenient", "technical"] },
  "reading-m2-q13": { stimulusId: "reading-m2-q13-stimulus", prompt: "According to the author, GM technology can do all of the following EXCEPT", answer: "a", options: ["improve the fertility of soil", "boost agricultural productivity", "improve human nutrition", "protect the health of agricultural workers"] },
  "reading-m2-q14": { stimulusId: "reading-m2-q14-stimulus", prompt: "The passage suggests which of the following about \"Patented GM seeds\"?", answer: "c", options: ["They can sometimes alter the nutrients in crops in ways that harm human health.", "Their use can benefit farmers when profits are shared by biotech companies.", "Their adoption could potentially subject farmers to unfair control by businesses.", "Their widespread use in agriculture could help to expand and protect biodiversity."] },
  "reading-m2-q15": { stimulusId: "reading-m2-q15-stimulus", prompt: "The author mentions \"the rapid pace of technological change\" in order to", answer: "d", options: ["acknowledge the promise that GM technology holds for farmers", "suggest why research on the health effects of GM technology has lagged", "question one argument used to advocate for expanded use of GM technology", "explain some of the resistance to implementation of GM technology"] }
};

const listeningQuestions = {
  1: { sourceImageNumber: 1, answer: "d", prompt: "Choose the best response.", options: ["Five trees should be fine.", "Yes, the weekend flew by.", "Last weekend I went home.", "Yes, with the college hiking group."] },
  2: { sourceImageNumber: 2, answer: "b", prompt: "Choose the best response.", options: ["I live in a tight-knit community.", "You can find it on the university's website.", "She said that she was bored during the lesson.", "No, I didn't see the news bulletin."] },
  3: { sourceImageNumber: 3, answer: "c", prompt: "Choose the best response.", options: ["Next time, don't forget to study for your exam.", "The young married couple is starting a new family.", "Oh, I think it was rescheduled for next Thursday.", "Yes, he had a good time on the class field trip."] },
  4: { sourceImageNumber: 4, answer: "d", prompt: "Choose the best response.", options: ["I go to the movies almost every weekend.", "The film club screens movies on Saturdays.", "Do you remember the first movie you saw?", "We should only be a few minutes late."] },
  5: { sourceImageNumber: 5, answer: "d", prompt: "Choose the best response.", options: ["The team lost on a technicality.", "Lectures are usually in the auditorium.", "Yes, it is an electric vehicle.", "Oh, that sounds interesting."] },
  6: { sourceImageNumber: 6, answer: "c", prompt: "Choose the best response.", options: ["Yes, I can watch it.", "Either is fine with me.", "It's for my film class.", "I'd love to."] },
  7: { sourceImageNumber: 7, answer: "b", prompt: "Choose the best response.", options: ["The pictures came out quite well.", "Yes, I'm really excited.", "I worked all last week.", "No, I prefer natural flavors."] },
  8: { sourceImageNumber: 8, answer: "b", prompt: "Choose the best response.", options: ["I like to play football.", "You should speak with the coach.", "The students learn well in that environment.", "They might have some at their new location."] },
  9: { sourceImageNumber: 9, answer: "d", prompt: "Choose the best response.", options: ["At the library.", "It's a group activity.", "I'm fairly certain.", "Tomorrow at noon."] },
  10: { sourceImageNumber: 10, answer: "a", prompt: "Choose the best response.", options: ["I missed the last meeting.", "The bus arrives at seven a.m.", "No, but he does share snacks with friends.", "We sold gift wrap last year."] },
  11: { sourceImageNumber: 11, answer: "a", prompt: "Choose the best response.", options: ["I'll have to check the deadline.", "I enjoy cooking with him.", "The researcher arrived at 9 a.m.", "We went last Thursday."] },
  12: { sourceImageNumber: 12, answer: "d", prompt: "Choose the best response.", options: ["The archives have many documents.", "The ingredients are from local farms.", "The plane has access in the front and rear.", "You should contact the university library."] },
  13: { sourceImageNumber: 14, answer: "d", prompt: "What are the speakers mainly discussing?", options: ["A new academic program", "A trip to an art museum", "A department's financial resources", "An upcoming grant opportunity"] },
  14: { sourceImageNumber: 15, answer: "b", prompt: "What does the man say will be upgraded first?", options: ["Some design software", "Computer hardware", "A meeting schedule", "A course catalog"] },
  15: { sourceImageNumber: 17, answer: "d", prompt: "What feature of the app does the woman like the most?", options: ["Progress bar", "Daily reminders", "Chat", "Guided sessions"] },
  16: { sourceImageNumber: 18, answer: "a", prompt: "What is the most likely reason that the woman tried the app?", options: ["To manage her stress", "To share her schedule", "To seek spiritual guidance", "To meet new people"] },
  17: { sourceImageNumber: 20, answer: "b", prompt: "What is the man's primary concern?", options: ["App costs", "Performance issues", "Data usage", "Payment methods"] },
  18: { sourceImageNumber: 21, answer: "c", prompt: "What will the man look into?", options: ["Deleting an app", "Reinstalling some software", "Making a purchase", "Getting a job"] },
  19: { sourceImageNumber: 23, answer: "d", prompt: "What can be inferred about the class taught by the speaker?", options: ["It is required for first-year students.", "It meets in a building near the cafeteria.", "It teaches students how to prepare meals.", "It takes place early in the morning."] },
  20: { sourceImageNumber: 24, answer: "a", prompt: "What does the speaker urge students to do?", options: ["Maintain a clean classroom", "Alert the facilities staff of a problem", "Stay awake during class", "Bring enough food to class to share"] },
  21: { sourceImageNumber: 26, answer: "d", prompt: "Why does the speaker say a new policy was introduced?", options: ["To resolve ongoing issues with the club's website", "To make additional allowances for admitting new club members", "To create a formal process for club members to appeal dismissal", "To address club members not regularly attending meetings"] },
  22: { sourceImageNumber: 27, answer: "a", prompt: "What possible consequence of failure to follow the new policy does the speaker mention?", options: ["Loss of club membership", "A fine of 75 dollars", "The need to attend a special meeting", "Complaints from other club members"] },
  23: { sourceImageNumber: 29, answer: "d", prompt: "What kind of club is most likely holding the meeting?", options: ["A business club", "A theater club", "A tutoring club", "A community service club"] },
  24: { sourceImageNumber: 30, answer: "c", prompt: "What will probably happen next?", options: ["Students will propose new volunteer projects.", "Students will share information about local schools.", "Students will introduce themselves.", "Students will raise funds for student clubs."] },
  25: { sourceImageNumber: 32, answer: "d", prompt: "Why does the speaker mention churches?", options: ["To explain how a traditional technique of making stained glass was developed", "To emphasize the religious significance of stained glass", "To illustrate an effect of stained glass on large spaces", "To point out a use of stained glass that he expects listeners to be familiar with"] },
  26: { sourceImageNumber: 33, answer: "d", prompt: "Why does the speaker mention the Arts and Crafts movement?", options: ["To identify the inspiration for Louis Comfort Tiffany's stained glass designs", "To emphasize the natural beauty of stained glass", "To describe the origins of the copper foil technique for making stained glass", "To explain how stained glass became popular in homes"] },
  27: { sourceImageNumber: 34, answer: "c", prompt: "According to the professor, what was a disadvantage of using stained glass in homes?", options: ["It required frequent maintenance.", "It was expensive to produce.", "It resulted in a loss of heat.", "It could break easily during transportation."] },
  28: { sourceImageNumber: 35, answer: "a", prompt: "What does the speaker indicate about the methods of creating stained glass?", options: ["They have changed greatly over time.", "They tend to yield consistent results.", "They depend on the desired color.", "They often include both lead and copper."] },
  29: { sourceImageNumber: 37, answer: "a", prompt: "How did Lois Mailou Jones' parents support her artistic development?", options: ["By providing the materials she needed", "By paying for her travel to Paris", "By teaching her how to paint", "By taking her to museums"] },
  30: { sourceImageNumber: 38, answer: "b", prompt: "What does the speaker imply about Indian Shops?", options: ["It depicts a street scene Jones often saw while studying in Paris.", "It was influenced by Jones' early memories and her studies in Paris.", "It is more geometric than most Impressionist paintings.", "It showed how human-made structures negatively affect nature."] },
  31: { sourceImageNumber: 39, answer: "d", prompt: "How did Jones' style change later in her career?", options: ["Her artworks became more focused on nature.", "Her artworks began to depict more human-made structures.", "Her artworks began to include a wider variety of colors.", "Her artworks became more abstract."] },
  32: { sourceImageNumber: 40, answer: "c", prompt: "What point does the speaker make about Moon Masque?", options: ["It was more realistic than Jones' earlier work.", "It was one of Jones' last artistic creations.", "It showed Jones' powerful connection to African art.", "It included an object that Jones had brought from Paris."] }
};

const writingTasks = {
  "writing-q11": {
    title: "Feedback on dining experience",
    prompt: "Write an email to Ms. Lee giving feedback about your dining experience at Cozy Corner.",
    materialType: "email",
    context: "You recently had dinner at a restaurant called 'Cozy Corner.' While part of the experience was enjoyable, the service was poor. You want to provide feedback to the restaurant owner, Ms. Lee.",
    sourceMaterial: [
      "Feedback on dining experience",
      { text: "To: Ms. Lee", config: { role: "email_header", labelWeight: "bold" } },
      { text: "Subject: Feedback on dining experience", config: { role: "email_header", labelWeight: "bold" } },
      "You recently had dinner at a restaurant called 'Cozy Corner.' While part of the experience was enjoyable, the service was poor. You want to provide feedback to the restaurant owner, Ms. Lee.",
      { text: "Write an email to Ms. Lee. In your email, do the following:", config: { role: "instruction", weight: "bold" } },
      { text: "Describe what you enjoyed about your dining experience.", config: { role: "bullet" } },
      { text: "Explain the issues you faced with the service and your order.", config: { role: "bullet" } },
      { text: "Suggest ways to improve the service for future customers.", config: { role: "bullet" } },
      "Write as much as you can and in complete sentences."
    ],
    rubricId: "toefl.writing.email"
  },
  "writing-q12": {
    title: "Academic Discussion: Education and Climate Change",
    prompt: "In your view, which of these two approaches best prepares students to face climate change and other environmental issues?",
    materialType: "academic_discussion",
    context: "Your professor is teaching a class on education. Write a post responding to the professor's question.",
    sourceMaterial: [
      "Your professor is teaching a class on education. Write a post responding to the professor's question.",
      { text: "In your response, you should do the following:", config: { role: "instruction", weight: "bold" } },
      { text: "Express and support your opinion.", config: { role: "bullet" } },
      { text: "Make a contribution to the discussion in your own words.", config: { role: "bullet" } },
      "An effective response will contain at least 100 words.",
      { text: "Dr. Achebe: Today's educational institutions need to prepare students for a world impacted by climate change and other environmental problems. Education that focuses on science and technology can help students develop innovative solutions to environmental problems. On the other hand, education that emphasizes social sciences and ethics can foster students' deeper understanding of environmental problems and their effects. In your view, which of these two approaches best prepares students to face climate change and other environmental issues?", config: { role: "speaker", speaker: "Dr. Achebe" } },
      { text: "Claire: Focusing on social sciences like history and human geography helps us to see how our actions affect global communities. By learning about different cultures and the environment, we understand the need for collective action. This knowledge encourages us to work together to improve the environment on a global scale.", config: { role: "speaker", speaker: "Claire", speakerType: "student" } },
      { text: "Andrew: Technical skills are essential in combating climate change. They provide tangible solutions to environmental issues. Education should prioritize teaching these skills, as they directly address and solve problems like renewable energy development and waste reduction. A practical approach like this can ensure a better future for all.", config: { role: "speaker", speaker: "Andrew", speakerType: "student" } }
    ],
    rubricId: "toefl.writing.academic_discussion"
  }
};

function updateWritingQuestion(question, stimulus, task) {
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
  if (stimulus) {
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
}

const questions = await readJson("questions.json");
const stimuli = await readJson("stimuli.json");
const assets = await readJson("assets.json");
const answerKey = await readJson("answer-key.json");
const test = await readJson("test.json");
const exam = await readJson("exam.json");

for (const [id, spec] of Object.entries(completeWordStimuli)) {
  setStimulus(stimuli, id, { ...spec, materialType: "plain_passage" });
}
for (const material of Object.values(readingMaterials)) {
  for (const id of material.stimulusIds) {
    setStimulus(stimuli, id, material);
  }
}

for (const [id, spec] of Object.entries(readingQuestions)) {
  const question = questions.find((item) => item.id === id);
  if (!question) throw new Error(`Missing question ${id}`);
  updateChoiceQuestion(question, { ...spec, questionType: question.questionType.includes("academic") ? "toefl.academic_passage_choice" : question.questionType, rendererId: "toefl.reading_choice" }, answerKey);
}

for (const [number, spec] of Object.entries(listeningQuestions)) {
  const question = questions.find((item) => item.id === `listening-q${number}`);
  if (!question) throw new Error(`Missing listening-q${number}`);
  await updateListeningQuestion(question, spec, assets, stimuli, answerKey);
}

for (const [id, task] of Object.entries(writingTasks)) {
  const question = questions.find((item) => item.id === id);
  if (!question) throw new Error(`Missing writing question ${id}`);
  const stimulus = stimuli.find((item) => item.id === question.stimulusId);
  updateWritingQuestion(question, stimulus, task);
}

for (const question of questions) {
  if (question.sectionId === "speaking") {
    question.needsReview = false;
    question.status = "published";
    question.config = {
      ...(question.config || {}),
      displayMode: "structured",
      readiness: "structured_ready",
      humanVerificationStatus: "verified",
      verifiedOverrideSource: "verified-content.json"
    };
  }
}

syncTest(test, questions, stimuli);

exam.config = {
  ...(exam.config || {}),
  publicationStatus: "candidate",
  humanVerificationStatus: "content_verified_pending_browser",
  verifiedContentSource: "verified-content.json",
  formatProfile: "toefl-2026-3.2b-final",
  canonicalReference: false,
  updatedForContentCompletionAt: new Date().toISOString()
};
exam.status = "partially_published";

const verified = {
  examId: EXAM_ID,
  sourceFolder: "3.29新托福真题",
  canonicalReference: "3.2新托福真题B卷",
  generatedAt: new Date().toISOString(),
  sourceFiles: {
    reading: "3.29 阅读.docx",
    listening: "3.29 听力.docx",
    writing: "3.29 写作.docx",
    speaking: "3.29 口语.docx",
    answers: "3.29 答案.docx",
    listeningAudio: "3.29 听力.m4a.zip",
    speakingAudio: ["3.29 口语q1.wav", "3.29 口语q2.wav", "3.29 口语q3.wav", "3.29 口语4-最后.m4a"]
  },
  readingQuestionIds: Object.keys(readingQuestions),
  listeningQuestionSourceImages: Object.fromEntries(Object.entries(listeningQuestions).map(([number, spec]) => [`listening-q${number}`, spec.sourceImageNumber])),
  writingQuestionIds: Object.keys(writingTasks),
  note: "Human verified from 3.29 source screenshots and 3.29 answer document. No 3.2B question content was copied."
};

const manifest = {
  sourceName: "3.29新托福真题",
  canonicalReference: "3.2新托福真题B卷",
  updatedAt: new Date().toISOString(),
  lockedCanonicalModified: false,
  roles: verified.sourceFiles,
  verifiedOverride: "verified-content.json",
  contentCompletionStatus: "candidate_pending_browser_validation",
  sourceMappingRules: {
    reading: "Use 3.29 阅读.docx image-derived content and answer keys from 3.29 答案.docx.",
    listening: "Use only formal question pages; skip conversation/talk intro pages when mapping source images to official question numbers.",
    writing: "Keep existing 3.2B-compatible structured Build a Sentence and long-writing renderers.",
    speaking: "Keep existing 11 independent speaking questions and audio groups."
  }
};

await writeJson("questions.json", questions);
await writeJson("stimuli.json", stimuli);
await writeJson("assets.json", assets);
await writeJson("answer-key.json", answerKey);
await writeJson("test.json", test);
await writeJson("exam.json", exam);
await writeFile(path.join(PACK, "verified-content.json"), `${JSON.stringify(verified, null, 2)}\n`);
await writeFile(path.join(PACK, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const digest = createHash("sha256").update(JSON.stringify({ readingQuestions, listeningQuestions })).digest("hex").slice(0, 12);
console.log(JSON.stringify({
  examId: EXAM_ID,
  readingUpdated: Object.keys(readingQuestions).length,
  listeningUpdated: Object.keys(listeningQuestions).length,
  verifiedDigest: digest
}, null, 2));
