import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const examDir = path.join(process.cwd(), "真题合集7-5", "3.2新托福真题B卷");
const generatedDir = path.join(examDir, "generated");

async function readJson(fileName) {
  return JSON.parse(await readFile(path.join(generatedDir, fileName), "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const verified = {
  examId: "32b-c8805fb2",
  title: "3.2新托福真题B卷",
  verificationStatus: "human_verified",
  sourceFiles: {
    reading: "3.2 套二 阅读.docx",
    writing: "3.2 套二 写作.docx",
    answers: "3.2 套二 答案.docx"
  },
  readingStimuli: {
    "reading-m1-form-sarah-oneill": {
      title: "Apartment Reservation Form",
      materialType: "form",
      originalAssetIds: ["32b-c8805fb2-reading-m1-q21-stimulus-cdc9a971"],
      paragraphs: [
        "Read a form.",
        "Applicant: Sarah O'Neill\nTelephone: 555-3210\nEmail: s.oneill@email.com\nIntended Residence: 22 Maple Lane, Apt. 3B, Dublin\nPreferred Move-In: June 15\nEmployment: University student\nPets: None",
        "Applicant must include government-issued identification and employment status verification to ensure reservation of the residence.",
        "Direct queries to the leasing office at 555-4125."
      ],
      questions: [21, 22]
    },
    "reading-m1-email-ryan-internships": {
      title: "Ryan's Internship Candidate Email",
      materialType: "email",
      originalAssetIds: ["32b-c8805fb2-reading-m1-q23-stimulus-3c35e220"],
      paragraphs: [
        "Read an e-mail.",
        "Hi Team,",
        "Blundin University hosted a career fair yesterday. I was able to speak to several promising candidates for summer internships with our company. See their attached resumes. I'd like everyone to give me their feedback no later than Friday.",
        "Thanks,",
        "Ryan"
      ],
      questions: [23, 24]
    },
    "reading-m1-email-leadership-conference": {
      title: "Student Leadership Conference Email",
      materialType: "email",
      originalAssetIds: ["32b-c8805fb2-reading-m1-q26-stimulus-817c68f5"],
      paragraphs: [
        "Read an email.",
        "Subject: Confirmation and update-student leadership conference",
        "Dear Ms. Taylor,",
        "I'm pleased to confirm your participation in the upcoming student leadership conference, scheduled for next Wednesday from 10:00 A.M. to 3:00 P.M. in Room 201 of the Learning Center. Sessions will include effective leadership, with subtopics including building trust and accountability, navigating group dynamics, and fostering inclusive collaboration. A catered lunch will be provided at noon.",
        "Please note: Due to a scheduling conflict, the final segment may be relocated to Room 305. Staff will assist with the transition if needed.",
        "To ensure a productive experience, please arrive 10-15 minutes early for check-in and bring a notebook and pen. If you have dietary restrictions or require accommodations, contact the student conference coordinator at 555-6784 by Monday.",
        "We look forward to your participation in this student leadership conference!",
        "Warm regards,",
        "Robert Williams"
      ],
      questions: [25, 26, 27]
    },
    "reading-m1-notice-data-skills": {
      title: "Downtown School of Data Skills Notice",
      materialType: "notice",
      originalAssetIds: ["32b-c8805fb2-reading-m1-q28-stimulus-192667e5"],
      paragraphs: [
        "Read the following notice.",
        "Downtown School of Data Skills",
        "All classes meet for eight sessions from 6:00 P.M. to 7:00 P.M. beginning September 1.",
        "Spreadsheet Introduction\nStudents will learn how to create spreadsheets and use functions that can speed up work. This course is good for beginners and those who need to relearn basics.\nSection A: Mondays and Wednesdays\nSection B: Tuesdays and Thursdays\nSection C: (virtual) Wednesdays and Fridays",
        "Formulas\nInstructors will show students how to use basic spreadsheet formulas for business. Students should have basic spreadsheet skills before enrolling.\nSection D: Tuesdays\nSection E: (virtual) Thursdays",
        "Data Seminar\nTaught by industry professionals, this course is for researchers who want to learn how to work with complex data.\nSection F: (virtual) Mondays",
        "Data Representation\nThis course is for analysts and researchers who need to show audiences easy-to-read graphs and charts.\nSection G: (virtual) Wednesdays"
      ],
      questions: [28, 29, 30]
    },
    "reading-m1-passage-urban-green-spaces": {
      title: "Urban Green Spaces",
      materialType: "academic_passage",
      originalAssetIds: ["32b-c8805fb2-reading-m1-q34-stimulus-7868296d"],
      paragraphs: [
        "Urban Green Spaces",
        "Urban green spaces, such as parks and community gardens, enhance city life for residents. The contrast between green spaces and the surrounding concrete and glass structures can be a visual respite; such spaces also provide residents with a place to relax and connect with nature, which can significantly improve mental health, reduce stress, and encourage physical activity. [A]",
        "Urban green spaces also contribute to environmental sustainability. [B] They provide a cooler spot within the concrete heat traps surrounding them, absorb rainwater and reduce flooding, and increase biodiversity by providing habitats for various species. [C]",
        "Recent initiatives have focused on creating more green spaces in underserved areas. [D] Some cities are converting abandoned lots into community gardens or small parks. These projects not only provide green spaces but also involve community members in the planning and maintenance of them, fostering a sense of ownership and responsibility.",
        "While urban green spaces offer a host of benefits, they are not without drawbacks. When parks and gardens are added in city neighborhoods, they often increase the value of nearby properties. This can unintentionally lead to the displacement of longtime residents who can no longer afford rising rents or property taxes. Another challenge is preserving these spaces—it can be difficult to secure the funding necessary to maintain them."
      ],
      questions: [31, 32, 33, 34, 35]
    },
    "reading-m2-passage-growth-mindset": {
      title: "Growth Mindset in Education",
      materialType: "academic_passage",
      originalAssetIds: ["32b-c8805fb2-3.2-套二-阅读-image19-f10f4d98"],
      paragraphs: [
        "Growth Mindset in Education",
        "The concept of a growth mindset has gained attention in educational psychology. Coined by Carol Dweck, the phrase \"growth mindset\" refers to the belief that abilities and intelligence can be developed through dedication and hard work. This contrasts with a fixed mindset, where individuals believe their abilities are static.",
        "Research suggests that students with a growth mindset are more likely to embrace challenges, persevere through difficulties, and see effort as a path to mastery. For example, a student who struggles with math but believes they can improve with practice is displaying a growth mindset. This belief encourages resilience and a positive attitude towards learning.",
        "Educators play a crucial role in fostering a growth mindset in their students. Techniques such as praising effort rather than innate ability and providing constructive feedback can help students develop this mindset. Creating a classroom environment that celebrates mistakes as learning opportunities can reinforce the growth mindset philosophy.",
        "[A] However, implementing growth mindset strategies is not without challenges. [B] Some students may find it difficult to change how they view their abilities, especially if they have been accustomed to a fixed mindset for a long time. [C] Additionally, educators themselves must genuinely believe in the growth mindset principles to effectively convey them to their students. [D]"
      ],
      questions: [11, 12, 13, 14, 15],
      moduleId: "reading-m2"
    }
  },
  readingQuestionOverrides: {
    "reading-m1-q21": {
      stimulusId: "reading-m1-form-sarah-oneill",
      prompt: "What is the likely purpose of this form?"
    },
    "reading-m1-q22": {
      stimulusId: "reading-m1-form-sarah-oneill",
      prompt: "What can be inferred about Sarah O'Neill's living situation?"
    },
    "reading-m1-q23": {
      stimulusId: "reading-m1-email-ryan-internships",
      prompt: "What did Ryan do yesterday?"
    },
    "reading-m1-q24": {
      stimulusId: "reading-m1-email-ryan-internships",
      prompt: "What does Ryan ask his team to do?"
    },
    "reading-m1-q25": {
      stimulusId: "reading-m1-email-leadership-conference",
      prompt: "What was this email likely written in response to?"
    },
    "reading-m1-q26": {
      stimulusId: "reading-m1-email-leadership-conference",
      prompt: "What will be the focus of the conference?",
      options: [
        ["reading-m1-q26-option-a", "Applying for summer internships"],
        ["reading-m1-q26-option-b", "Improving study techniques"],
        ["reading-m1-q26-option-c", "Helping people work together"],
        ["reading-m1-q26-option-d", "Using effective tools to improve productivity"]
      ],
      correctOptionId: "reading-m1-q26-option-c"
    },
    "reading-m1-q27": {
      stimulusId: "reading-m1-email-leadership-conference",
      prompt: "What is NOT yet known about the conference?"
    },
    "reading-m1-q28": {
      stimulusId: "reading-m1-notice-data-skills",
      prompt: "Peter has no experience with spreadsheets and cannot attend class on Wednesdays. He should enroll in"
    },
    "reading-m1-q29": {
      stimulusId: "reading-m1-notice-data-skills",
      prompt: "What does Michelle need before enrolling in Section D?"
    },
    "reading-m1-q30": {
      stimulusId: "reading-m1-notice-data-skills",
      prompt: "Beth has worked with formulas for years and is ready to learn advanced data skills. She should enroll in",
      options: [
        ["reading-m1-q30-option-a", "Section A, B, or C"],
        ["reading-m1-q30-option-b", "Section D or E"],
        ["reading-m1-q30-option-c", "Section F"],
        ["reading-m1-q30-option-d", "Section G"]
      ],
      correctOptionId: "reading-m1-q30-option-c"
    },
    "reading-m1-q31": {
      stimulusId: "reading-m1-passage-urban-green-spaces",
      prompt: "The word \"respite\" in the passage is closest in meaning to",
      options: [
        ["reading-m1-q31-option-a", "break"],
        ["reading-m1-q31-option-b", "addition"],
        ["reading-m1-q31-option-c", "symbol"],
        ["reading-m1-q31-option-d", "surprise"]
      ],
      correctOptionId: "reading-m1-q31-option-a"
    },
    "reading-m1-q32": {
      stimulusId: "reading-m1-passage-urban-green-spaces",
      prompt: "What is the relationship between paragraphs 1 and 2?"
    },
    "reading-m1-q33": {
      stimulusId: "reading-m1-passage-urban-green-spaces",
      prompt: "How can cities improve neighborhood residents' sense of responsibility for local green spaces?"
    },
    "reading-m1-q34": {
      stimulusId: "reading-m1-passage-urban-green-spaces",
      prompt: "Why does the author mention rising rents for neighborhood residents?"
    },
    "reading-m1-q35": {
      stimulusId: "reading-m1-passage-urban-green-spaces",
      prompt: "There are four locations in the passage that indicate where the following sentence could be added. Some even integrate playgrounds, sports fields, and exercise stations, making such activity accessible and fun for local residents. Where would the sentence best fit?"
    },
    "reading-m2-q11": {
      stimulusId: "reading-m2-passage-growth-mindset",
      prompt: "The word \"persevere\" in the passage is closest in meaning to"
    },
    "reading-m2-q12": {
      stimulusId: "reading-m2-passage-growth-mindset",
      prompt: "According to the passage, which of the following is true about students with a growth mindset?"
    },
    "reading-m2-q13": {
      stimulusId: "reading-m2-passage-growth-mindset",
      prompt: "All of the following are mentioned in the passage as ways educators can foster a growth mindset EXCEPT by",
      options: [
        ["reading-m2-q13-option-a", "commending students' efforts"],
        ["reading-m2-q13-option-b", "praising students' innate abilities"],
        ["reading-m2-q13-option-c", "giving constructive feedback"],
        ["reading-m2-q13-option-d", "using mistakes as learning opportunities"]
      ],
      correctOptionId: "reading-m2-q13-option-b"
    },
    "reading-m2-q14": {
      stimulusId: "reading-m2-passage-growth-mindset",
      prompt: "According to the passage, the implementation of growth mindset strategies may be challenging because of"
    },
    "reading-m2-q15": {
      stimulusId: "reading-m2-passage-growth-mindset",
      prompt: "There are four locations in the passage that indicate where the following sentence could be added. This reluctance can be further compounded by a lack of immediate, visible progress, which may discourage continued effort. Where would the sentence best fit?"
    }
  },
  writingTasks: {
    "writing-q11": {
      title: "Write an Email",
      prompt: "Write an email to Ms. Taylor about a team-building retreat reservation.",
      sourceMaterial: [
        "You are organizing a team-building retreat for the whole class. You have found a suitable resort for the event and need to contact the resort manager, Ms. Taylor, to discuss the reservation details.",
        "Write an email to Ms. Taylor. In your email, do the following:",
        "Explain the purpose of the retreat and why you chose this particular resort.",
        "Ask about the special dietary options offered.",
        "Inquire about the recreational activities offered at the resort.",
        "Write as much as you can and in complete sentences."
      ],
      context: "To: Ms. Taylor\nSubject: Resort Inquiry",
      aiScoringReady: true,
      rubricId: "toefl.writing.email"
    },
    "writing-q12": {
      title: "Academic Discussion",
      prompt: "Which view do you agree with? Why?",
      sourceMaterial: [
        "Your professor is teaching a class on art history. Write a post responding to the professor's question.",
        "In your response, you should do the following: Express and support your opinion. Make a contribution to the discussion in your own words. An effective response will contain at least 100 words.",
        "Dr. Gupta: We've been discussing how different art forms affect people and communities. Consider these specific examples: protest songs that motivate people to join movements, murals that bring communities together, or movies that change how people think about important issues. Some people argue that art creates change by making people aware of problems and motivating them to act. Others believe art simply shows what already exists in society without actually changing anything. Which view do you agree with? Why?",
        "Andrew: I believe art has the power to drive social change. At many times in history, protest songs helped unite people to support important causes, while political cartoons exposed corruption and motivated voters to demand better leadership. Art doesn't just show problems; it gives people emotional reasons to care and practical ways to take action for justice.",
        "Claire: I think art mainly reflects society by showing us what people experience and observe in their daily lives. Artists create paintings, songs, and stories based on their personal experiences and cultural backgrounds. While art can sometimes inspire people to think differently, its primary role is to document and preserve the current state of society for future generations."
      ],
      context: "Academic discussion in Dr. Gupta's art history class.",
      aiScoringReady: true,
      rubricId: "toefl.writing.academic_discussion"
    }
  }
};

function promptContent(text) {
  return { type: "plain_text", text };
}

function blockContent(paragraphs) {
  return {
    type: "blocks",
    blocks: paragraphs.map((text) => ({ type: "paragraph", text }))
  };
}

function optionObjects(options) {
  return options.map(([id, text], index) => ({ id, label: String.fromCharCode(65 + index), text }));
}

function upsertStimulus(stimuli, id, spec, currentAssetIds = []) {
  const existing = stimuli.find((stimulus) => stimulus.id === id);
  const assetIds = [...new Set([...(currentAssetIds || []), ...(spec.originalAssetIds || [])])];
  const next = {
    id,
    examPackId: "toefl",
    stimulusType: spec.materialType === "academic_passage" ? "toefl.reading_passage" : "toefl.reading_material",
    title: spec.title,
    assetIds,
    content: blockContent(spec.paragraphs),
    config: {
      ...(existing?.config || {}),
      materialType: spec.materialType,
      extractionStatus: "human_verified",
      extractionConfidence: 1,
      defaultDisplayMode: "structured_text",
      originalAssetIds: spec.originalAssetIds || assetIds,
      humanVerificationStatus: "verified",
      verificationSource: "verified-content.json"
    }
  };
  if (existing) Object.assign(existing, next);
  else stimuli.push(next);
}

function updateReadingQuestion(question, override) {
  const options = override.options ? optionObjects(override.options) : question.config.options;
  const correctOptionId = override.correctOptionId || question.config.correctOptionId;
  question.questionType = "toefl.reading_choice";
  question.rendererId = "toefl.reading_choice";
  question.scoringStrategyId = "toefl.exact_single_choice";
  question.stimulusId = override.stimulusId;
  question.prompt = promptContent(override.prompt);
  question.config = {
    ...question.config,
    options,
    correctOptionId,
    displayMode: "structured",
    readiness: "structured_ready",
    extractionStatus: "human_verified",
    humanVerificationStatus: "verified",
    verifiedOverrideSource: "verified-content.json"
  };
  question.needsReview = false;
  question.status = "published";
  question.confidence = 1;
}

function updateWritingTask(question, stimulus, task) {
  question.prompt = promptContent(task.prompt);
  question.config = {
    ...question.config,
    context: task.context,
    instructions: task.sourceMaterial,
    displayMode: "structured",
    readiness: "structured_ready",
    aiScoringReady: true,
    aiScoringInput: {
      taskType: question.questionType,
      instructions: task.sourceMaterial,
      sourceMaterial: task.sourceMaterial,
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
  stimulus.stimulusType = question.questionType === "toefl.write_email" ? "toefl.writing_email_task" : "toefl.writing_academic_discussion_task";
  stimulus.title = task.title;
  stimulus.content = blockContent(task.sourceMaterial);
  stimulus.config = {
    ...(stimulus.config || {}),
    materialType: question.questionType === "toefl.write_email" ? "email" : "mixed",
    extractionStatus: "human_verified",
    extractionConfidence: 1,
    defaultDisplayMode: "structured_text",
    originalAssetIds: stimulus.assetIds || [],
    humanVerificationStatus: "verified",
    aiScoringReady: true,
    verificationSource: "verified-content.json"
  };
}

function updateReadingAudit(audit, questions) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return audit.map((row) => {
    const question = byId.get(row.questionId);
    if (!question || !verified.readingQuestionOverrides[row.questionId]) return row;
    return {
      ...row,
      questionType: question.questionType,
      stimulusId: question.stimulusId,
      prompt: question.prompt.text,
      optionCount: question.config.options.length,
      answerMatched: true,
      rendererId: question.rendererId,
      needsReview: false,
      warnings: [],
      verificationStatus: "human_verified"
    };
  });
}

function writingAudit(questions) {
  return questions.filter((question) => question.sectionId === "writing").map((question) => ({
    questionId: question.id,
    moduleId: question.moduleId,
    questionNumber: question.number,
    questionType: question.questionType,
    sourceFile: "3.2 套二 写作.docx",
    sourceAssetId: question.config.sourceAssetId || question.config.imageAssetId || "",
    stimulusId: question.stimulusId,
    prompt: question.prompt?.text || "",
    rendererId: question.rendererId,
    aiScoringReady: Boolean(question.config.aiScoringReady),
    needsReview: Boolean(question.needsReview),
    warnings: [],
    verificationStatus: question.config.humanVerificationStatus || "unverified"
  }));
}

const questions = await readJson("questions.json");
const stimuli = await readJson("stimuli.json");
const readingAudit = await readJson("reading-question-audit.json");
const exam = await readJson("exam.json");

for (const [id, spec] of Object.entries(verified.readingStimuli)) {
  const currentAssetIds = spec.questions.flatMap((number) => {
    const moduleId = spec.moduleId || "reading-m1";
    const question = questions.find((item) => item.sectionId === "reading" && item.moduleId === moduleId && item.number === number);
    return question?.config?.imageAssetId ? [question.config.imageAssetId] : [];
  });
  upsertStimulus(stimuli, id, spec, currentAssetIds);
}

for (const [questionId, override] of Object.entries(verified.readingQuestionOverrides)) {
  const question = questions.find((item) => item.id === questionId);
  if (!question) throw new Error(`Missing question ${questionId}`);
  updateReadingQuestion(question, override);
}

for (const [questionId, task] of Object.entries(verified.writingTasks)) {
  const question = questions.find((item) => item.id === questionId);
  if (!question) throw new Error(`Missing question ${questionId}`);
  const stimulus = stimuli.find((item) => item.id === question.stimulusId);
  if (!stimulus) throw new Error(`Missing stimulus ${question.stimulusId}`);
  updateWritingTask(question, stimulus, task);
}

exam.config = {
  ...(exam.config || {}),
  publicationStatus: "ready",
  humanVerificationStatus: "verified",
  verifiedContentSource: "verified-content.json"
};

await writeJson(path.join(examDir, "verified-content.json"), verified);
await writeJson(path.join(generatedDir, "questions.json"), questions);
await writeJson(path.join(generatedDir, "stimuli.json"), stimuli);
await writeJson(path.join(generatedDir, "reading-question-audit.json"), updateReadingAudit(readingAudit, questions));
await writeJson(path.join(generatedDir, "writing-question-audit.json"), writingAudit(questions));
await writeJson(path.join(generatedDir, "exam.json"), exam);

console.log(JSON.stringify({
  updatedReadingQuestions: Object.keys(verified.readingQuestionOverrides).length,
  updatedWritingTasks: Object.keys(verified.writingTasks).length,
  verifiedContent: path.join(examDir, "verified-content.json")
}, null, 2));
