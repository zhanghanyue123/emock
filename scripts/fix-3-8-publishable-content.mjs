import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACK = path.join(ROOT, "真题合集7-5", "3.8新托福真题");
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

function textOf(block) {
  return typeof block === "string" ? block : block.text;
}

function sourceText(items) {
  return items.map(textOf).join("\n\n");
}

function optionId(questionId, letter) {
  return `${questionId}-option-${letter.toLowerCase()}`;
}

function options(questionId, values) {
  return values.map((text, index) => ({
    id: optionId(questionId, String.fromCharCode(97 + index)),
    label: String.fromCharCode(65 + index),
    text
  }));
}

function setStimulus(stimuli, id, { title, paragraphs, materialType = "plain_passage" }) {
  let touched = false;
  for (const stimulus of stimuli) {
    if (stimulus.id !== id) continue;
    touched = true;
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
  if (!touched) {
    stimuli.push({
      id,
      examPackId: "toefl",
      stimulusType: `toefl.reading_${materialType}`,
      title,
      assetIds: [],
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

function updateChoice(question, spec, answerKey, rendererId = "toefl.reading_choice") {
  const opts = options(question.id, spec.options);
  question.questionType = spec.questionType || question.questionType;
  question.rendererId = rendererId;
  question.scoringStrategyId = "toefl.exact_single_choice";
  question.prompt = prompt(spec.prompt);
  question.config = {
    ...(question.config || {}),
    options: opts,
    correctOptionId: optionId(question.id, spec.answer),
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

function updateCompleteWords(question, answer, prefix, missingLength, answerKey) {
  const blankId = `${question.id}-blank`;
  question.prompt = prompt("Fill in the missing letters in the paragraph.");
  question.config = {
    ...(question.config || {}),
    blanks: [{ id: blankId, prefix, missingLength, answer }],
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

function dedupeStimuli(stimuli) {
  const bestById = new Map();
  const score = (item) => {
    let value = 0;
    if (item.content?.type === "blocks") value += 4;
    if (item.config?.humanVerificationStatus === "verified") value += 3;
    if (item.stimulusType !== "source_image_fallback") value += 2;
    if (item.config?.extractionStatus === "human_verified") value += 1;
    return value;
  };
  for (const stimulus of stimuli) {
    const existing = bestById.get(stimulus.id);
    if (!existing || score(stimulus) > score(existing)) bestById.set(stimulus.id, stimulus);
  }
  stimuli.splice(0, stimuli.length, ...bestById.values());
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
        item.options = question.config?.options || item.options || [];
        item.correctOptionId = question.config?.correctOptionId || item.correctOptionId;
        item.blanks = question.config?.blanks || item.blanks || [];
        item.correctValues = question.config?.correctValues || item.correctValues || {};
        const stimulus = stimuliById.get(question.stimulusId);
        if (stimulus?.content?.type === "blocks") item.passageId = stimulus.id;
      }
    }
  }
}

const completeGroups = [
  {
    stimulusId: "reading-m1-complete-words-1",
    title: "Fill in the missing letters in the paragraph.",
    text: "Oceanography is the study of the physical, chemical, and biological aspects of the ocean. This field encompasses the exploration of ocean currents, marine ecosystems, and geological seabed structures. Oceanographers use satellites and other advanced technology to monitor and analyze ocean conditions. By tracking sea surface temperatures, currents, salinity, and other features, researchers contribute to our understanding of climate change. Their work is vital for sustaining ocean health and preserving marine biodiversity.",
    questions: [
      ["reading-m1-q1", "field", "fi", 3],
      ["reading-m1-q2", "the", "t", 2],
      ["reading-m1-q3", "of", "o", 1],
      ["reading-m1-q4", "currents", "curr", 4],
      ["reading-m1-q5", "ecosystems", "ecosy", 5],
      ["reading-m1-q6", "geological", "geolo", 5],
      ["reading-m1-q7", "structures", "struc", 5],
      ["reading-m1-q8", "use", "u", 2],
      ["reading-m1-q9", "and", "a", 2],
      ["reading-m1-q10", "advanced", "adva", 4]
    ]
  },
  {
    stimulusId: "reading-m1-complete-words-2",
    title: "Fill in the missing letters in the paragraph.",
    text: "The unusual properties of spider silk--a remarkable combination of strength and elasticity--have long attracted the attention of many. Spider silk has a breaking point far greater than steel and may stretch its full length before breaking; a 0.01 centimeter thread can support eighty grams. Spider silk is also very durable, a feature well illustrated by the persistence of cobwebs. Throughout history, humans have adapted spider silk for many purposes. For a long period, thick webs were used in Europe as bandages.",
    questions: [
      ["reading-m1-q11", "silk", "si", 2],
      ["reading-m1-q12", "breaking", "brea", 4],
      ["reading-m1-q13", "far", "f", 2],
      ["reading-m1-q14", "than", "th", 2],
      ["reading-m1-q15", "and", "a", 2],
      ["reading-m1-q16", "stretch", "str", 4],
      ["reading-m1-q17", "full", "fu", 2],
      ["reading-m1-q18", "before", "bef", 3],
      ["reading-m1-q19", "centimeter", "centi", 5],
      ["reading-m1-q20", "can", "c", 2]
    ]
  },
  {
    stimulusId: "reading-m2-q1-10-stimulus",
    title: "Fill in the missing letters in the paragraph.",
    text: "The Renaissance was a period of cultural rebirth in Europe, spanning the fourteenth to seventeenth centuries. A vibrant period of cultural, artistic, and intellectual revival, the Renaissance marked a renewed interest in classical literature, art, and science. The Renaissance had a profound historical impact, serving as a bridge between the Middle Ages and the modern era. It sparked a cultural awakening that emphasized humanism, individual achievement, and secular learning, which reshaped European thought and institutions.",
    questions: [
      ["reading-m2-q1", "vibrant", "vib", 4],
      ["reading-m2-q2", "of", "o", 1],
      ["reading-m2-q3", "artistic", "arti", 4],
      ["reading-m2-q4", "intellectual", "intell", 6],
      ["reading-m2-q5", "the", "t", 2],
      ["reading-m2-q6", "marked", "mar", 3],
      ["reading-m2-q7", "renewed", "ren", 4],
      ["reading-m2-q8", "in", "i", 1],
      ["reading-m2-q9", "literature", "liter", 5],
      ["reading-m2-q10", "and", "a", 2]
    ]
  }
];

const readingMaterials = [
  {
    ids: ["reading-m1-q21-stimulus", "reading-m1-q22-stimulus"],
    title: "Read an excerpt from a syllabus.",
    materialType: "plain_passage",
    paragraphs: [
      "This course explores classical mechanics, thermodynamics, and electromagnetism through lectures, labs, and problem-solving sessions.",
      "Students will develop analytical skills and apply mathematical models to physical systems. Weekly assignments, lab reports, and exams assess understanding.",
      "Prerequisites include calculus.",
      "Attendance and participation are essential for success."
    ]
  },
  {
    ids: ["reading-m1-q23-stimulus", "reading-m1-q24-stimulus", "reading-m1-q25-stimulus"],
    title: "Award Winner Returns to Alma Mater",
    materialType: "article",
    paragraphs: [
      { text: "Award Winner Returns to Alma Mater", config: { role: "headline", weight: "bold" } },
      { text: "By Kevin Martin", config: { role: "byline" } },
      "Students were stunned when actor Daniel Rivero, famous for his award-winning role in Horizon's Edge, visited Ashburn College on Monday.",
      "Rivero, a recent graduate of the Theater Arts program, returned to lead an impromptu drama workshop. Students crowded the theater hall, snapping selfies with the star and asking about his journey from Ashburn to Hollywood.",
      "\"I skipped lunch just to hear him,\" said sophomore Lily Chen. Rivero shared stories from his early auditions, including moments of rejection that taught him resilience.",
      "\"Embrace failure--it's the doorway to invention,\" he told students. He also praised Ashburn's faculty for fostering his love of storytelling. \"It feels like I never left,\" he added.",
      "The visit sparked excitement across campus, with social media flooded by photos from the workshop. For many students, it was a reminder that big dreams can start in small classrooms."
    ]
  },
  {
    ids: ["reading-m1-q26-stimulus", "reading-m1-q27-stimulus", "reading-m1-q28-stimulus", "reading-m1-q29-stimulus", "reading-m1-q30-stimulus"],
    title: "A Unique Advantage of Spicy Cuisine",
    materialType: "academic_passage",
    paragraphs: [
      "Are you fond of spicy food? Spices have been used for thousands of years to enhance the flavor of food, originally in cultures where spice plants were native to the area. Today, spice use is widespread across cultures, though certain spices are more prevalent in some cuisines. Indeed, scientists have suggested that hot-climate cuisines feature a greater amount and variety of spices. For example, a recent study found that the number of different spices was much greater in traditional recipes from Southeast Asian countries than in those from northern Europe.",
      "Why do hot-climate cuisines feature more spices? Some believe that spice consumption is related to cultural preferences. While culture certainly plays a part, scientists have recently suggested that the antimicrobial properties of spices, which prevent the growth of dangerous foodborne microorganisms, ensured their widespread use in hot climates. In such climates, food spoilage was a concern before the availability of refrigeration. Spices with greater antimicrobial or antibacterial properties, such as allspice, cinnamon, cumin, garlic, and onions, were frequently featured in the traditional recipes of hot-climate cuisines and in different combinations. Scientists concluded that food safety precipitated the use of many and multiple spices in hot regions."
    ]
  },
  {
    ids: ["reading-m1-q31-stimulus", "reading-m1-q32-stimulus", "reading-m1-q33-stimulus", "reading-m1-q34-stimulus", "reading-m1-q35-stimulus"],
    title: "The Dynamics of Hollywood's Golden Age",
    materialType: "academic_passage",
    paragraphs: [
      "Hollywood's Golden Age, from the 1920s to the 1960s, was a transformative period in cinema history. Under the studio system, major companies like RKO controlled film production, creating an efficient assembly-line process that produced stars such as Humphrey Bogart and Katharine Hepburn. While this system ensured a steady output of films, it often limited creative freedom for directors and actors tied to restrictive contracts. Yet this very constraint led to unexpected innovation as filmmakers sought new ways to tell compelling stories within set boundaries.",
      "A pivotal change during this era was the introduction of sound, forever altering cinematic storytelling. Silent film stars had to adapt or risk obsolescence, while new genres like musicals capitalized on sound technology's possibilities. This shift pushed directors to experiment with narrative structures, often blurring the lines between genres to captivate audiences.",
      "The decline of the studio system began with a 1948 Supreme Court ruling that dismantled studios' monopolies over theaters. This ruling opened the door for independent filmmakers, whose diverse and unconventional stories began gaining traction in theaters. However, the legacy of the studio system's efficiency and star-making machinery still influences Hollywood's operations today."
    ]
  },
  {
    ids: ["reading-m2-q11-stimulus", "reading-m2-q12-stimulus", "reading-m2-q13-stimulus", "reading-m2-q14-stimulus", "reading-m2-q15-stimulus"],
    title: "Biochemical Systems Theory: Challenges and Implications",
    materialType: "academic_passage",
    paragraphs: [
      "Biochemical systems theory, a potent framework for simulating biochemical processes, hinges on mathematical models for predicting the interactions of molecules within cells. The theory's ability to predict metabolic pathways regulated by enzymes (proteins facilitating and managing chemical reactions) offers significant potential for advancements in biotechnology. However, constructing accurate models demands a profound grasp of biology and mathematics, posing significant challenges to researchers.",
      "While the theory enables simulations of complex cellular behavior, it is reliant on precise data inputs. Erroneous data can skew predictions, underscoring the delicate balance between mathematical precision and biological variability. That interplay raises questions about the theory's reliability, particularly in drug development, where predicting compounds' effects on metabolic pathways is crucial yet fraught with uncertainty.",
      "Furthermore, biochemical systems theory has sparked debates over its ethical implications. By scrutinizing biological systems, researchers identify processes ripe for intervention. [A] Yet this provokes concerns about the manipulation of life at a granular level, including the possibility that interventions could have unintended consequences or adversely affect future generations. [B] As the field evolves, ethical discussions are as dynamic as the biochemical networks themselves. [C] [D]"
    ]
  }
];

const readingChoices = {
  "reading-m1-q21": { answer: "c", prompt: "What is the most likely subject of the course?", options: ["Biology", "Calculus", "Physics", "Sociology"] },
  "reading-m1-q22": { answer: "d", prompt: "What is NOT mentioned as an assessment method?", options: ["Weekly exercises", "Lab reports", "Tests", "Essays"] },
  "reading-m1-q23": { answer: "d", prompt: "What is the main topic of the article?", options: ["A graduating student is given a role in a Hollywood film.", "A college campus is the backdrop of a Hollywood film.", "A film screening on campus draws a large crowd.", "A celebrated alumnus reconnects with his college."] },
  "reading-m1-q24": { answer: "c", prompt: "What did Daniel Rivero do at Ashburn?", options: ["He gave an interview to the student newspaper.", "He held auditions for his latest film.", "He taught an unscheduled acting class.", "He announced his role in an upcoming film."] },
  "reading-m1-q25": { answer: "a", prompt: "What is the meaning of Daniel Rivero's advice to students?", options: ["Creative thinking begins when things go wrong.", "It is good to leave home, but come back often.", "Poor choices can stifle innovation if you are not careful.", "Dream big and do not let anyone stand in your way."] },
  "reading-m1-q26": { answer: "a", prompt: "What is the purpose of the passage?", options: ["To share research findings related to spice use", "To promote the widespread use of specific spices", "To describe an outdated theory about spice use", "To contrast traditional and contemporary spice consumption"] },
  "reading-m1-q27": { answer: "a", prompt: "What data were likely collected for the study?", options: ["The number of spices used in a variety of countries", "The types of microorganisms on different spices", "The food preferences of customers at traditional restaurants", "The number of traditional Southeast Asian recipes used in Europe"] },
  "reading-m1-q28": { answer: "c", prompt: "According to the passage, what is suggested about spice usage in food?", options: ["It can conceal the odor of spoiled food.", "It has caused a rise in demand for native plants.", "It may prevent bacteria on food from developing.", "It has decreased substantially in Southeast Asia."] },
  "reading-m1-q29": { answer: "b", prompt: "All of the following are mentioned about spices EXCEPT:", options: ["Spices are derived from plant products.", "Spices require refrigeration to maintain their function.", "Spice usage is associated with cultural practices.", "Spice usage varies considerably by cuisine."] },
  "reading-m1-q30": { answer: "c", prompt: "The word \"precipitated\" in the passage is closest in meaning to", options: ["threw", "separated", "caused", "rained"] },
  "reading-m1-q31": { answer: "d", prompt: "Which aspect of the studio system encouraged filmmakers to innovate?", options: ["The demand for more silent films", "The freedom to create experimental films", "The inefficiency of film production", "The boundaries imposed by restrictive contracts"] },
  "reading-m1-q32": { answer: "c", prompt: "The word \"compelling\" in the passage is closest in meaning to", options: ["modern", "astonishing", "fascinating", "complex"] },
  "reading-m1-q33": { answer: "a", prompt: "Why does the author mention the introduction of sound in films?", options: ["To highlight a development that led to new, creative narrative techniques", "To emphasize the former popularity of silent films", "To discuss how sound renewed the careers of silent film stars", "To identify the event that started the decline of the studio system"] },
  "reading-m1-q34": { answer: "b", prompt: "What inference can be made about the 1948 Supreme Court ruling?", options: ["It led to a temporary increase in studio profits.", "It allowed independent films to be seen and become popular.", "It caused studios to develop more large-scale musical productions.", "It had no effect on Hollywood's operations."] },
  "reading-m1-q35": { answer: "d", prompt: "What does the passage imply about the Hollywood film industry today?", options: ["Modern studios have completely abandoned all practices from the Golden Age period.", "Contemporary films commonly use the storytelling techniques developed during the 1920s-1960s.", "Independent filmmakers have entirely replaced the studio system's influence on cinema.", "The assembly-line process of the studio system still impacts current Hollywood operations."] },
  "reading-m2-q11": { answer: "d", prompt: "The word \"hinges\" in the passage is closest in meaning to", options: ["focuses", "builds", "acts", "depends"] },
  "reading-m2-q12": { answer: "a", prompt: "Which statement best summarizes the relationship between paragraphs 1 and 2?", options: ["Paragraph 2 describes a shortcoming of the concept introduced in paragraph 1.", "Paragraph 2 proposes a solution to a problem discussed in paragraph 1.", "Paragraph 2 proposes an alternative to the theory presented in paragraph 1.", "Paragraph 2 illustrates the successful application of the theory described in paragraph 1."] },
  "reading-m2-q13": { answer: "a", prompt: "Why does the author discuss drug development?", options: ["To emphasize the importance of using accurate data when constructing models", "To give an example of an industry that has been transformed by biochemical systems theory", "To demonstrate that questions about the theory's reliability have been largely resolved", "To suggest that the theory's reliability is less important than discovering industrial applications that work"] },
  "reading-m2-q14": { answer: "b", prompt: "What does the passage imply about the ethical concerns raised by biochemical systems theory?", options: ["They have been dismissed by most ethicists as unjustified.", "They are far from being completely resolved as of today.", "They have been eased thanks to more precise modeling.", "They are causing researchers to abandon the theory."] },
  "reading-m2-q15": { answer: "b", prompt: "Where would the sentence best fit? Select a location to add the sentence to the passage.", options: ["Location A", "Location B", "Location C", "Location D"] }
};

const listeningChoices = [
  ["listening-q1", "d", ["Five trees should be fine.", "Yes, the weekend flew by.", "Last weekend I went home.", "Yes, with the college hiking group."]],
  ["listening-q2", "a", ["Have you looked at used ones?", "Where did you get the tickets?", "I don't check my email often.", "My backpack is really heavy too."]],
  ["listening-q3", "d", ["I slept well--thanks.", "Yes, we golfed nine holes.", "No, I haven't seen it.", "Nine a.m. or nine p.m.?"]],
  ["listening-q4", "c", ["Do you want to borrow my lawn mower?", "English and history.", "How did you find out?", "That's good advice."]],
  ["listening-q5", "b", ["I'm unavailable that morning.", "Sure, I can.", "We'll need a reservation.", "We should go one day."]],
  ["listening-q6", "a", ["I'm still waiting for feedback.", "Sure, I'll go to the orientation.", "Did he like the present?", "Do they go every weekend?"]],
  ["listening-q7", "a", ["We should leave our dorm early to get there on time.", "There is a park near the campus.", "That's great, I love hiking in the evening.", "What is the nature of your visit?"]],
  ["listening-q8", "a", ["A friend of the professor.", "It will be live streamed.", "The speaker was difficult to follow.", "A lecture about climate change."]],
  ["listening-q9", "b", ["No, they are located on the third floor.", "Practice with different types of texts.", "Yes, I'll be attending the book club.", "Poor communication can lead to conflict."]],
  ["listening-q10", "d", ["I like taking notes.", "Yes, in the park.", "No, on the bottom.", "It's quite expensive."]],
  ["listening-q11", "c", ["I had to run all the way back to campus.", "Yes, I can help you with that.", "I don't have much free time this summer.", "I'm not sure how many."]],
  ["listening-q12", "b", ["Sure, you can borrow one.", "I was in a class.", "No, please ask Molly.", "It's around the corner."]],
  ["listening-q13", "c", ["She no longer wants to visit an attraction.", "She has been unable to connect to a website.", "She wanted more information about prices.", "She was waiting for further instructions from the man."]],
  ["listening-q14", "c", ["Purchase tickets", "Check her calendar", "Contact her classmates", "Call the sculpture garden"]],
  ["listening-q15", "c", ["The location of a new park", "Their favorite types of music", "Their plans to attend an event", "The best places to listen to music"]],
  ["listening-q16", "d", ["He is worried that he might get cold.", "He thinks the tickets are too expensive.", "He would like a seat close to the stage.", "He will sit in the grass with the woman's friends."]],
  ["listening-q17", "a", ["To express concern", "To correct an error", "To point out a change", "To identify a benefit"]],
  ["listening-q18", "b", ["Changing his major", "Switching to another university", "Finishing his degree early", "Taking a class with a small number of students"]],
  ["listening-q19", "d", ["To ask for volunteer judges", "To say who won a contest", "To tell when an exhibit will end", "To remind students of a deadline"]],
  ["listening-q20", "a", ["On a Web site", "At a local museum", "In the campus newspaper", "In a campus building"]],
  ["listening-q21", "d", ["To interview some experts in the field", "To learn about things they will see on some trails", "To hear about the requirements for becoming a botanist", "To get information about trail routes and closures"]],
  ["listening-q22", "a", ["One requires a certain level of skill.", "One involves traveling off site.", "Both will be led by experienced guides.", "Both will involve high physical effort."]],
  ["listening-q23", "d", ["To describe a recent observation", "To remind students of proper practices", "To inform about newly posted information", "To explain a change in dormitory policy"]],
  ["listening-q24", "b", ["They can provide cardboard boxes upon request.", "They have noticed waste being disposed of improperly.", "They recently created lists of non-recyclable items.", "They will help residents sort their recycling."]],
  ["listening-q25", "d", ["Listening to music from different genres", "Choosing particular musicians to research", "Combining a range of musical styles in one song", "Using pieces of recorded music in a new song"]],
  ["listening-q26", "a", ["A legal case", "A concert", "The invention of a new instrument", "The start of a new recording company"]],
  ["listening-q27", "a", ["She disagrees with the criticism that it lacks creativity.", "She likes that it is a unique practice in the history of music.", "She is disappointed that it is no longer commonly used.", "She has not yet decided how she feels about it."]],
  ["listening-q28", "c", ["Take a survey", "Discuss the artwork from an album cover", "Play a recording", "Help students do their own sampling"]],
  ["listening-q29", "d", ["That their inventions were available to the general public", "That they were famous in their time", "That they worked in laboratories", "That they created their inventions alone"]],
  ["listening-q30", "a", ["By teaching himself", "By studying with a tutor", "By receiving help from an inventor", "By going to a special school"]],
  ["listening-q31", "b", ["To point out why Hiram Maxim was impressed by Latimer at first", "To help explain the beauty of Latimer's technical drawings", "To introduce Latimer's collaborative project with a musician", "To describe how Latimer's career changed after he worked as a drafter"]],
  ["listening-q32", "a", ["Latimer helped make lightbulbs more available to the public.", "Latimer invented a new way of producing electricity.", "Latimer created a new drawing style that was useful for inventors.", "Latimer made a drawing that helped convince the public of the usefulness of electric lighting."]]
];

const listeningPrompts = {
  "listening-q13": "Why has the woman not bought tickets yet?",
  "listening-q14": "What will the woman most likely do next?",
  "listening-q15": "What are the man and the woman talking about?",
  "listening-q16": "What does the man imply when he says, \"I'll bring a blanket too\"?",
  "listening-q17": "Why does the man say, \"we only have ten students in my program\"?",
  "listening-q18": "What is the man considering?",
  "listening-q19": "What is the purpose of the announcement?",
  "listening-q20": "Where will students be able to view all the photographs?",
  "listening-q21": "Why will students go to an auditorium?",
  "listening-q22": "What does the speaker say about the afternoon activities?",
  "listening-q23": "What is the main purpose of the announcement?",
  "listening-q24": "What does the speaker imply about the custodial staff?",
  "listening-q25": "How does the speaker define \"sampling\"?",
  "listening-q26": "What event does the speaker say caused a change to a creative process?",
  "listening-q27": "What is the speaker's attitude toward sampling?",
  "listening-q28": "What will the speaker most likely do next?",
  "listening-q29": "What does the speaker say is a false belief about nineteenth-century inventors?",
  "listening-q30": "How did Lewis Latimer learn to be a drafter?",
  "listening-q31": "Why does the speaker mention that Latimer was a poet?",
  "listening-q32": "What did Latimer achieve in his work with Hiram Maxim?"
};

const writingTasks = {
  "writing-q11": {
    title: "Feedback on Recent Cake Purchase",
    prompt: "Write an email to Ms. Lopez about your recent cake purchase.",
    materialType: "email",
    context: "You are a regular customer at a local bakery and have always enjoyed their products. Recently, you bought a cake for your favorite professor, but it did not meet your expectations. You want to provide feedback to the bakery owner, Ms. Lopez, and suggest improvements.",
    sourceMaterial: [
      "You are a regular customer at a local bakery and have always enjoyed their products. Recently, you bought a cake for your favorite professor, but it did not meet your expectations. You want to provide feedback to the bakery owner, Ms. Lopez, and suggest improvements.",
      { text: "Write an email to Ms. Lopez. In your email, do the following:", config: { role: "instruction", weight: "bold" } },
      { text: "Explain what you usually enjoy about their products.", config: { role: "bullet" } },
      { text: "Describe the issues you had with your recent cake purchase.", config: { role: "bullet" } },
      { text: "Suggest how they could improve the quality of their cakes.", config: { role: "bullet" } },
      "Write as much as you can and in complete sentences.",
      { text: "To: Ms. Lopez", config: { role: "email_header", labelWeight: "bold" } },
      { text: "Subject: Feedback on Recent Cake Purchase", config: { role: "email_header", labelWeight: "bold" } }
    ],
    rubricId: "toefl.writing.email"
  },
  "writing-q12": {
    title: "Academic Discussion: Social Media Influencers",
    prompt: "Which view about using social media personalities for marketing do you agree with?",
    materialType: "academic_discussion",
    context: "Your professor is teaching a class on marketing. Write a post responding to the professor's question.",
    sourceMaterial: [
      "Your professor is teaching a class on marketing. Write a post responding to the professor's question.",
      { text: "In your response, you should do the following.", config: { role: "instruction", weight: "bold" } },
      { text: "Express and support your opinion.", config: { role: "bullet" } },
      { text: "Make a contribution to the discussion in your own words.", config: { role: "bullet" } },
      "An effective response will contain at least 100 words.",
      { text: "Dr. Diaz: We've been discussing how companies hire popular social media personalities with thousands of followers to promote their products through posts, videos, and reviews on social media platforms. Some marketers believe these influencers can effectively increase sales because their followers trust their personal recommendations and view them as friends rather than advertisers. Others argue that hiring influencers is expensive and unpredictable since their popularity can decline suddenly. Which view about using social media personalities for marketing do you agree with?", config: { role: "speaker", speaker: "Dr. Diaz" } },
      { text: "Claire: Social media influencers are highly effective for marketing because they create authentic connections with their audiences. When popular personalities share reviews and demonstrate products in their daily lives, followers trust these recommendations more than traditional advertisements. Influencers also reach specific target groups like young adults, helping companies connect with customers who are genuinely interested in their products.", config: { role: "speaker", speaker: "Claire", speakerType: "student" } },
      { text: "Paul: I think relying on influencers for marketing can be risky and unpredictable for business success. Their popularity can change quickly due to scandals or changing trends, potentially damaging the brand's reputation. Additionally, many influencer campaigns fail to generate actual sales despite high costs, making it difficult for companies to measure whether their investment produced profitable results and increased revenue.", config: { role: "speaker", speaker: "Paul", speakerType: "student" } }
    ],
    rubricId: "toefl.writing.academic_discussion"
  }
};

const questions = await readJson("questions.json");
const stimuli = await readJson("stimuli.json");
const answerKey = await readJson("answer-key.json");
const test = await readJson("test.json");
const exam = await readJson("exam.json");

for (const group of completeGroups) {
  setStimulus(stimuli, group.stimulusId, { title: group.title, paragraphs: [group.text], materialType: "plain_passage" });
  for (const [id, answer, prefix, missingLength] of group.questions) {
    const question = questions.find((item) => item.id === id);
    if (!question) throw new Error(`Missing ${id}`);
    updateCompleteWords(question, answer, prefix, missingLength, answerKey);
  }
}

for (const material of readingMaterials) {
  for (const id of material.ids) {
    setStimulus(stimuli, id, material);
  }
}

for (const [id, spec] of Object.entries(readingChoices)) {
  const question = questions.find((item) => item.id === id);
  if (!question) throw new Error(`Missing ${id}`);
  updateChoice(question, spec, answerKey, "toefl.reading_choice");
}

for (const [id, answer, opts] of listeningChoices) {
  const question = questions.find((item) => item.id === id);
  if (!question) throw new Error(`Missing ${id}`);
  updateChoice(question, { answer, prompt: listeningPrompts[id] || "Choose the best response.", options: opts }, answerKey, "toefl.listening_choice");
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
  publicationStatus: "ready",
  humanVerificationStatus: "reading_writing_listening_verified",
  verifiedContentSource: "verified-content.json",
  formatProfile: "toefl-2026-3.2b-final"
};
exam.status = "published";

await writeJson("questions.json", questions);
await writeJson("stimuli.json", stimuli);
await writeJson("answer-key.json", answerKey);
await writeJson("test.json", test);
await writeJson("exam.json", exam);
await writeFile(path.join(PACK, "verified-content.json"), `${JSON.stringify({
  examId: "38-f18a54ef",
  sourceFolder: "3.8新托福真题",
  sourceFiles: {
    reading: "3.8  阅读.docx",
    listening: "3.8  听力.docx",
    writing: "3.8  写作.docx",
    answers: "3.8  答案.docx"
  },
  readingStatus: "verified",
  listeningStatus: "verified",
  writingStatus: "verified",
  verificationSource: "source images and answer document"
}, null, 2)}\n`);

console.log(JSON.stringify({ readingChoices: Object.keys(readingChoices).length, listeningChoices: listeningChoices.length, writingTasks: Object.keys(writingTasks).length }, null, 2));
