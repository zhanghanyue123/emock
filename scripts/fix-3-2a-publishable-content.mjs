import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACK_NAME = "3.2新托福真题A卷";
const PACK = path.join(ROOT, "真题合集7-5", PACK_NAME);
const GENERATED = path.join(PACK, "generated");

async function readJson(name) {
  return JSON.parse(await readFile(path.join(GENERATED, name), "utf8"));
}

async function writeJson(name, data) {
  await writeFile(path.join(GENERATED, name), `${JSON.stringify(data, null, 2)}\n`);
}

function plain(text) {
  return { type: "plain_text", text };
}

function blocks(title, paragraphs) {
  return {
    type: "blocks",
    blocks: [
      ...(title ? [{ type: "heading", level: 2, text: title }] : []),
      ...paragraphs.map((item) => (typeof item === "string" ? { type: "paragraph", text: item } : item))
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
  let stimulus = stimuli.find((item) => item.id === id);
  if (!stimulus) {
    stimulus = { id, examPackId: "toefl", stimulusType: `toefl.reading_${materialType}`, title, assetIds: [], config: {} };
    stimuli.push(stimulus);
  }
  stimulus.stimulusType = materialType.startsWith("listening") ? "toefl.listening_visual" : `toefl.reading_${materialType}`;
  stimulus.title = title;
  stimulus.content = blocks(title, paragraphs);
  stimulus.config = {
    ...(stimulus.config || {}),
    materialType,
    extractionStatus: "human_verified",
    extractionConfidence: 1,
    defaultDisplayMode: materialType.startsWith("listening") ? "source_image" : "structured_text",
    visualRestoration: materialType.startsWith("listening") ? "stimulus_image_only" : "structured_dom",
    structuredTemplate: materialType,
    humanVerificationStatus: "verified",
    verificationSource: "verified-content.json"
  };
}

function updateCompleteWords(question, answer, prefix, missingLength, answerKey) {
  const blankId = `${question.id}-blank`;
  question.prompt = plain("Fill in the missing letters in the paragraph.");
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

function updateChoice(question, spec, answerKey, rendererId = "toefl.reading_choice") {
  const opts = options(question.id, spec.options);
  question.questionType = spec.questionType || "toefl.reading_choice";
  question.rendererId = rendererId;
  question.scoringStrategyId = "toefl.exact_single_choice";
  question.prompt = plain(spec.prompt);
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
    sourceQuestionNumber: spec.sourceQuestionNumber || question.number
  };
  question.needsReview = false;
  question.status = "published";
  question.confidence = 1;
  answerKey[question.id] = question.config.correctOptionId;
}

function updateListening(question, spec, answerKey) {
  updateChoice(question, spec, answerKey, "toefl.listening_choice");
  question.questionType = spec.questionType || question.questionType || "toefl.listen_choose_response";
  question.config = {
    ...question.config,
    prompt: spec.prompt,
    audioSegmentNeedsReview: false,
    listeningDisplayMode: "stimulus_left_choice_right"
  };
}

function updateWriting(question, stimulus, task) {
  question.prompt = plain(task.prompt);
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
    const sectionQuestions = questions.filter((question) => question.sectionId === section.id);
    section.issueCount = sectionQuestions.filter((question) => question.needsReview).length;
    section.importStatus = section.issueCount ? "needs_review" : "ready";
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

function dedupeStimuli(stimuli) {
  const best = new Map();
  const score = (item) => {
    let value = 0;
    if (item.content?.type === "blocks") value += 4;
    if (item.config?.humanVerificationStatus === "verified") value += 3;
    if (item.stimulusType !== "source_image_fallback") value += 2;
    return value;
  };
  for (const stimulus of stimuli) {
    const existing = best.get(stimulus.id);
    if (!existing || score(stimulus) > score(existing)) best.set(stimulus.id, stimulus);
  }
  stimuli.splice(0, stimuli.length, ...best.values());
}

const completeGroups = [
  {
    stimulusId: "reading-m1-complete-words-1",
    title: "Fill in the missing letters in the paragraph.",
    text: "Conservation ecology focuses on protecting and restoring natural habitats to preserve biodiversity. Ecologists study ecosystems to understand how different species interact with their environment. This research informs strategies for managing natural resources and mitigating human impact. Efforts include habitat restoration, species protection, and sustainable practices. Understanding conservation principles is crucial for maintaining ecological balance and ensuring the survival of diverse species. Corridor creation connects fragmented habitats, while captive breeding programs help recover endangered species, and citizen science initiatives engage communities in monitoring local ecosystems and wildlife populations.",
    questions: [
      ["reading-m1-q1", "study", "st", 3],
      ["reading-m1-q2", "to", "t", 1],
      ["reading-m1-q3", "how", "h", 2],
      ["reading-m1-q4", "species", "spe", 4],
      ["reading-m1-q5", "with", "wi", 2],
      ["reading-m1-q6", "environment", "envir", 6],
      ["reading-m1-q7", "research", "rese", 4],
      ["reading-m1-q8", "strategies", "strat", 5],
      ["reading-m1-q9", "managing", "mana", 4],
      ["reading-m1-q10", "resources", "reso", 5]
    ]
  },
  {
    stimulusId: "reading-m1-complete-words-2",
    title: "Fill in the missing letters in the paragraph.",
    text: "Tigers are solitary animals known for their territorial behavior; males use scent markings and vocalizations to define their territories. Each male tiger establishes control over a large territory spanning several square miles and patrols the area regularly to look for prey and maintain dominance. This behavior helps reduce conflicts over prey, but tigers are known to fiercely defend their territory from intruders when necessary. Often hunting at night, tigers use stealth and their excellent night vision to their advantage.",
    questions: [
      ["reading-m1-q11", "male", "ma", 2],
      ["reading-m1-q12", "establishes", "estab", 6],
      ["reading-m1-q13", "over", "ov", 2],
      ["reading-m1-q14", "large", "la", 3],
      ["reading-m1-q15", "spanning", "span", 4],
      ["reading-m1-q16", "square", "squ", 3],
      ["reading-m1-q17", "and", "a", 2],
      ["reading-m1-q18", "the", "t", 2],
      ["reading-m1-q19", "regularly", "regu", 5],
      ["reading-m1-q20", "look", "lo", 2]
    ]
  },
  {
    stimulusId: "reading-m2-q1-10-stimulus",
    title: "Fill in the missing letters in the paragraph.",
    text: "Logical reasoning is a cornerstone of academic methodology, providing a structured approach to analyzing arguments and evidence. Deductive reasoning starts with general principles and derives specific conclusions, while inductive thinking involves drawing broad generalizations from specific observations. Critical thinking skills enable scholars to identify logical fallacies, assess the credibility of sources, and construct coherent arguments. The application of logic extends across disciplines, from mathematics to philosophy to the natural sciences. Developing proficiency in logical reasoning enhances the ability to solve complex problems and communicate effectively, fostering intellectual rigor and innovation.",
    questions: [
      ["reading-m2-q1", "reasoning", "reas", 5],
      ["reading-m2-q2", "with", "wi", 2],
      ["reading-m2-q3", "principles", "princ", 5],
      ["reading-m2-q4", "derives", "der", 4],
      ["reading-m2-q5", "conclusions", "concl", 6],
      ["reading-m2-q6", "inductive", "indu", 5],
      ["reading-m2-q7", "involves", "invol", 4],
      ["reading-m2-q8", "broad", "br", 3],
      ["reading-m2-q9", "from", "fr", 2],
      ["reading-m2-q10", "observations", "observ", 6]
    ]
  }
];

const readingMaterials = [
  {
    id: "reading-m1-q21-stimulus",
    title: "City Park Renovation Timeline",
    materialType: "notice",
    paragraphs: [
      "Phase 1 (January-April): Main playground is closed to build new equipment.",
      "Phase 2 (May-August): Installation of walking paths (the playground is open).",
      "Picnic areas remain closed throughout the renovation.",
      "Miller Park offers temporary playground access during Phase 1 only."
    ]
  },
  {
    id: "reading-m1-q23-stimulus",
    title: "Email from Ryan",
    materialType: "email",
    paragraphs: [
      "Hi Team,",
      "Blundin University hosted a career fair yesterday. I was able to speak to several promising candidates for summer internships with our company. See their attached resumes. I'd like everyone to give me their feedback no later than Friday.",
      "Thanks,",
      "Ryan"
    ]
  },
  {
    id: "reading-m1-q25-stimulus",
    title: "Downtown School of Data Skills",
    materialType: "schedule",
    paragraphs: [
      "All classes meet for eight sessions from 6:00 P.M. to 7:00 P.M. beginning September 1.",
      "Spreadsheet Introduction",
      "Students will learn how to create spreadsheets and use functions that can speed up work. This course is good for beginners and those who need to relearn basics.",
      "Section A: Mondays and Wednesdays",
      "Section B: Tuesdays and Thursdays",
      "Section C: (virtual) Wednesdays and Fridays",
      "Formulas",
      "Instructors will show students how to use basic spreadsheet formulas for business. Students should have basic spreadsheet skills before enrolling.",
      "Section D: Tuesdays",
      "Section E: (virtual) Thursdays",
      "Data Seminar",
      "Taught by industry professionals, this course is for researchers who want to learn how to work with complex data.",
      "Section F: (virtual) Mondays",
      "Data Representation",
      "This course is for analysts and researchers who need to show audiences easy-to-read graphs and charts.",
      "Section G: (virtual) Wednesdays"
    ]
  },
  {
    id: "reading-m1-q28-stimulus",
    title: "Join the Annual Cultural Festival!",
    materialType: "advertisement",
    paragraphs: [
      "Date: August 20 | Time: 10:00 A.M. - 6:00 P.M.",
      "Location: Central Park in Glenn Valley",
      "Celebrate the diversity and richness of our community at the Annual Cultural Festival. Enjoy a day filled with exciting activities and performances suitable for all ages. Here are some of the highlights:",
      "Live Music and Dance Performances: Experience traditional and contemporary music and dance from various cultures.",
      "Food Stalls: Taste delicious dishes from around the world, including Spanish tapas, Italian pasta, Indian curry, and more.",
      "Art Exhibits: View artworks from local and international artists showcasing different styles and mediums.",
      "Children's Activities: Bring the kids for face painting, storytelling sessions, and interactive games.",
      "Cultural Workshops: Participate in workshops on crafts, cooking, and languages led by cultural experts.",
      "Admission is free for everyone.",
      "Don't miss out on this incredible event!"
    ]
  },
  {
    id: "reading-m1-q31-stimulus",
    title: "Echoes of the Deep",
    materialType: "academic_passage",
    paragraphs: [
      "Cetaceans--a group of mammals that includes whales, dolphins, and porpoises--use echolocation to navigate and hunt in waters too deep for sunlight to penetrate. Many cetaceans emit clicks, producing sound waves that bounce off objects and return as echoes.",
      "Echolocation techniques vary among species, depending on their environments and needs. Dolphins, for instance, produce more frequent and higher-pitched clicks than do larger cetaceans like sperm whales. Although high frequency sounds do not travel as far as low frequencies do, high frequencies with very short wavelengths help dolphins locate small objects and pick out fine detail--the higher the frequencies, the better the detail. This enables dolphins to find and track small, agile fish that make up their diet. Sperm whales, on the other hand, dive deep to hunt prey such as giant squid and use lower-frequency clicks that travel farther in the deep ocean.",
      "Noise pollution can interfere with the echolocation signals used by cetaceans. Human-made sounds--such as those from sonar and ship engines--can make it difficult for whales and dolphins to locate prey, orient themselves, or communicate with others. The disruption can cause stress and disorientation, increasing the risk of collisions and strandings, and it can also induce changes in behavior or habitat."
    ]
  },
  {
    id: "reading-m2-q11-stimulus",
    title: "Cybernetic Prosthetics",
    materialType: "academic_passage",
    paragraphs: [
      "Cybernetic prosthetics have revolutionized medical technology, offering hope to individuals who have lost limbs. Unlike traditional prosthetics, which are often cumbersome and limited in function, cybernetic versions are designed to integrate seamlessly with the human nervous system. This integration allows for more natural movement and even sensation. A key development in this field has been the use of myoelectric sensors, which detect electrical signals generated by muscle movements.",
      "One example is a cybernetic hand that can perform delicate tasks such as picking up small objects or typing. This is achieved through advanced algorithms that translate muscle signals into controlled movements. Researchers are also exploring haptic feedback, which would enable users to feel textures and temperatures through their prosthetic limbs. It involves integrating sensors and actuators that mimic the sensation of touch by stimulating the user's nerve endings or skin with electrical signals. This could significantly improve the quality of life for amputees.",
      "The high cost of these prosthetics makes them inaccessible to many. Additionally, the technology requires regular maintenance and updates, which can be a barrier. Current battery life is another limitation, as it restricts the user's ability to wear the prosthetic for extended periods. Researchers are continually working to make these devices more affordable and user-friendly."
    ]
  }
];

const readingChoices = [
  ["reading-m1-q21", "When can families use the main playground while also having access to picnic areas?", ["During Phase 1 only", "During Phase 2 only", "Throughout the entire renovation", "Never during the renovation period"], "d", "toefl.reading_choice", "reading-m1-q21-stimulus"],
  ["reading-m1-q22", "Where should parents take their children for playground access in February?", ["The main playground at City Park", "Miller Park's temporary playground", "Nowhere", "Picnic areas"], "b", "toefl.reading_choice", "reading-m1-q21-stimulus"],
  ["reading-m1-q23", "What did Ryan do yesterday?", ["He took a class at a university.", "He attended a job fair.", "He was interviewed by a manager.", "He hired some summer interns."], "b", "toefl.reading_choice", "reading-m1-q23-stimulus"],
  ["reading-m1-q24", "What does Ryan ask his team to do?", ["Share their opinions of some job candidates", "Review a summer internship program", "Update their resumes by Friday", "Introduce themselves to new interns"], "a", "toefl.reading_choice", "reading-m1-q23-stimulus"],
  ["reading-m1-q25", "Peter has no experience with spreadsheets and cannot attend class on Wednesdays. He should enroll in", ["Section A", "Section B", "Section C", "Section D"], "b", "toefl.reading_choice", "reading-m1-q25-stimulus"],
  ["reading-m1-q26", "What does Michelle need before enrolling in Section D?", ["Experience creating new spreadsheet formulas", "A research position that requires creating formulas", "Training in how to present complex data", "Previous experience using spreadsheets"], "d", "toefl.reading_choice", "reading-m1-q25-stimulus"],
  ["reading-m1-q27", "Beth has worked with formulas for years and is ready to learn advanced data skills. She should enroll in", ["Section A, B, or C", "Section D or E", "Section F", "Section G"], "c", "toefl.reading_choice", "reading-m1-q25-stimulus"],
  ["reading-m1-q28", "What is NOT listed as a feature of the event?", ["Films created in various countries", "Traditional and contemporary music", "Foods from different parts of the world", "Local and international artworks"], "a", "toefl.reading_choice", "reading-m1-q28-stimulus"],
  ["reading-m1-q29", "What can be inferred about the event?", ["It requires an admission fee.", "It celebrates cultural diversity.", "It will be conducted partly online.", "It requires advance registration."], "b", "toefl.reading_choice", "reading-m1-q28-stimulus"],
  ["reading-m1-q30", "Which is NOT mentioned as an activity for children?", ["Playing games", "Making crafts", "Putting paint on faces", "Listening to stories"], "b", "toefl.reading_choice", "reading-m1-q28-stimulus"],
  ["reading-m1-q31", "One of the main themes of the passage is", ["differences between cetaceans and other species", "vulnerability of cetaceans to disruptive sounds", "surprising properties of sound waves", "biological adaptations behind echolocation"], "d", "toefl.reading_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q32", "The passage suggests that compared to dolphins, sperm whales hunt", ["slower prey", "for shorter periods", "in shallower waters", "less often"], "a", "toefl.reading_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q33", "The word \"track\" in the passage is closest in meaning to", ["follow", "consume", "see", "attack"], "a", "toefl.reading_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q34", "The passage suggests that one reason a cetacean may become stranded is", ["lack of light in deep waters", "difficulty in locating prey", "sounds from passing ships", "inability to find a new habitat"], "c", "toefl.reading_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q35", "Where would the sentence best fit? Sentence: In such environments, hearing is more important than sight.", ["Location A: after the sentence about clicks returning as echoes", "Location B: after the sentence about environments and needs", "Location C: after the sentence about better detail", "Location D: at the end of the passage"], "a", "toefl.reading_choice", "reading-m1-q31-stimulus"],
  ["reading-m2-q11", "The word \"seamlessly\" in the passage is closest in meaning to", ["generally", "smoothly", "repeatedly", "slowly"], "b", "toefl.reading_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q12", "What can be inferred about myoelectric sensors?", ["They function less effectively in traditional prosthetics.", "They rely less on electric signals than other types of sensors do.", "They allow for more natural movement in cybernetic prosthetics.", "They make cybernetic prosthetics somewhat cumbersome."], "c", "toefl.reading_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q13", "What does the passage indicate about cybernetic hands?", ["They are very similar in appearance to natural human limbs.", "They are currently limited in their range of motion.", "They rely on algorithms that turn muscle signals into movements.", "They can cause skin irritation if worn for extended periods."], "c", "toefl.reading_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q14", "According to the passage, using haptic feedback in artificial limbs involves each of the following EXCEPT", ["detecting electrical signals from muscles", "changing the temperatures of objects", "stimulating skin and nerve endings", "using multiple sensors and actuators"], "b", "toefl.reading_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q15", "Where would the sentence best fit? Sentence: To take full advantage of these amazing new technologies, a few obstacles need to be overcome.", ["Location A: before the sentence about high cost", "Location B: before the sentence about regular maintenance and updates", "Location C: before the sentence about battery life", "Location D: at the end of the passage"], "a", "toefl.reading_choice", "reading-m2-q11-stimulus"]
];

const mainListeningPrompts = [
  ...Array(12).fill("Choose the best response."),
  "How does the man respond when the woman mentions her trip to Europe?",
  "Why does the woman mention Los Angeles?",
  "What is the man looking to buy?",
  "Why does the woman mention her brother?",
  "What are the man and the woman talking about?",
  "What does the man imply when he says, \"I'll bring a blanket too\"?",
  "What is the main purpose of the announcement?",
  "What does the speaker imply about the writing mentor program?",
  "What is the purpose of the announcement?",
  "What will the speaker probably do next?",
  "What can be inferred about the purpose of the student fair?",
  "Why should students present their student IDs?",
  "What is the purpose of the talk?",
  "What does the speaker suggest about turning?",
  "What does leaning in help a cyclist to do?",
  "What do professional cyclists try to do when turning?",
  "What is the main focus of the talk?",
  "Why does the speaker mention a coffee cup?",
  "What does the speaker say about the initial reception of Cubism?",
  "Why does the speaker mention Modernism?"
];

const mainListening = [
  ["That classroom is in the administration building.", "No, interest rates have gone up.", "Generally around four p.m.--why?", "Yes, I learned so much."],
  ["The membership dues.", "The auditorium on the second floor.", "Last night it rained a lot.", "At least five said they would come."],
  ["It's a requirement for the class.", "It starts in twenty minutes.", "The professor said there will be a quiz afterwards.", "A professor from another university."],
  ["What size did you buy?", "It was a good-looking design.", "I'll give him the list of what we need.", "This year it starts earlier than usual."],
  ["I've been there once.", "I've been too busy to organize it.", "The new furniture looks great.", "It should arrive tomorrow."],
  ["It's a device that runs on solar power.", "Yes, they usually go out to eat.", "I thought it was a powerful speech.", "It looks like the streetlights outside the dorm are still on."],
  ["He works at a call center.", "Here's a bus token.", "The one that leaves from Maple Street Station.", "The last stop before Springfield."],
  ["It's within the hour.", "It connects through London.", "The train goes to the airport.", "We need to wait for our luggage."],
  ["All student leaders.", "Everyone must register online.", "The conference will be recorded.", "Try registering next year."],
  ["Yes, I think it is.", "A very noisy concert.", "Sure, sorry about that.", "No, I'm not going to return it."],
  ["I need help.", "Please clean your desk.", "No, I have other plans.", "Yes, I got the invite."],
  ["My order was placed yesterday.", "Let's check in the main office.", "There are a lot of new clubs this year.", "One box and four bags."],
  ["By sharing his own experience", "By expressing surprise", "By requesting some information", "By giving her some advice"],
  ["To express agreement with the man", "To identify a place she would like to visit next", "To emphasize the importance of booking accommodations in advance", "To point out a negative experience that she had"],
  ["A gift for his cousin", "A suit for a wedding", "A new pair of shoes", "A wedding ring"],
  ["He had a good experience at a boutique.", "He is getting married this weekend.", "He just got a new job.", "He can lend the man a suit."],
  ["The location of a new park", "Their favorite types of music", "Their plans to attend an event", "The best places to listen to music"],
  ["He is worried that he might get cold.", "He thinks the tickets are too expensive.", "He would like a seat close to the stage.", "He will sit in the grass with the woman's friends."],
  ["To provide tips for writing a research paper", "To invite students to an event", "To highlight feedback from previous students", "To encourage students to meet new people"],
  ["This is the first year it has been offered.", "Mentors are only available on Tuesdays.", "Students have generally found it helpful.", "Only students who love to write can benefit from it."],
  ["To ask for volunteers", "To give information about a museum's history", "To explain the plan for a tour", "To request donations"],
  ["Take students to the next floor", "Discuss an artist", "Collect feedback from visitors", "Hand out some printed information"],
  ["Its purpose is to promote awareness of diverse cultures.", "Its purpose is to give students a study break during exams.", "Its purpose is to provide exposure to local artists.", "Its purpose is to honor student excellence."],
  ["To receive a commemorative T-shirt", "To receive free entry", "To receive international street food", "To receive a guest pass for a friend"],
  ["To show how easy it is to conduct a physics experiment", "To describe the discovery of a law of physics", "To explain two physical forces acting on a moving bicycle", "To offer reasons why many physicists like bicycle riding"],
  ["It is more complicated than it seems.", "It is the hardest skill to learn.", "It is easier to turn right than left.", "It is important to go slowly."],
  ["Go faster", "Avoid falling down", "See more clearly around corners", "Prevent uneven wear on the wheels"],
  ["Slide out significantly on some turns in the road", "Keep their bikes relatively upright at high speeds", "Shift their weight just enough to work against inertia", "Change the direction of only their front wheel"],
  ["The historical origins of Cubism", "How Cubism changed the world of art", "Some similarities between architecture and Cubist art", "Some examples of Cubist paintings"],
  ["To provide a visual example of Cubist techniques", "To highlight the influence of coffee on European artists", "To identify a painting on which two Cubist artists worked together", "To identify a common subject in many Cubist paintings"],
  ["It quickly became popular among the general public.", "It was not received well by some critics.", "It became a topic in music and literature.", "It was compared to another artistic style."],
  ["To contrast its conceptual ideas with those of Cubism", "To help students understand Cubists' goals", "To emphasize how influential Cubism was", "To highlight the variety of ways in which Cubist paintings can be understood"]
];

const mainListeningAnswers = ["d", "d", "d", "c", "b", "d", "c", "a", "a", "c", "a", "b", "d", "d", "b", "a", "c", "d", "b", "c", "c", "d", "a", "b", "c", "a", "b", "c", "b", "a", "b", "c"];

const extraListeningPrompts = [
  "Choose the best response.",
  "Choose the best response.",
  "Choose the best response.",
  "Where is the restaurant that the woman mentions most likely located?",
  "What possible problem with the restaurant does the woman mention?",
  "What does the woman wish had been different about her trip to Italy?",
  "What advice does the woman give the man?",
  "What is the main topic of the talk?",
  "According to the talk, what is one way music therapy helps patients?",
  "Why does the speaker mention dopamine?",
  "What does the speaker imply about the future of music therapy?",
  "What is the main topic of the talk?",
  "What factor contributed most to the decline of natural indigo in industrial use?",
  "What explains the appeal of natural indigo in today's market?",
  "Why does the speaker discuss the labor involved in traditional indigo dye extraction?"
];

const extraListening = [
  ["No, it's on the other side.", "Yes, and it works really well.", "Sorry--I need it myself.", "I don't think it works anymore."],
  ["We grabbed dinner before the concert.", "I will see my friends there.", "The band played some great songs.", "Ticket prices will go up next month."],
  ["I'm not sure how much the shoes cost.", "I've never worn a running race in my life.", "I saw the advertisement.", "I exercise four times a week."],
  ["In the city center", "Inside the art museum", "Far from the botanical gardens", "By the sea"],
  ["It has a limited dinner menu.", "Its food is sometimes not very fresh.", "It is often crowded.", "It does not accept reservations."],
  ["She wishes she could have stayed in Italy longer.", "She wishes she had visited more churches and art museums.", "She wishes she could have studied more with Italian professors.", "She wishes she had taken the trip over spring break."],
  ["He should start planning for the program early.", "He should take a class with Professor Douglas.", "He should visit the university art museum.", "He should research ticket prices for flights to Italy."],
  ["How culture affects a person's perception of music", "The use of music in behavioral therapy", "How music influences emotions and memories", "The neurological effects of music on the brain"],
  ["By improving sleep patterns", "By decreasing stress levels", "By enhancing memory recall", "By increasing physical activity"],
  ["To describe a method commonly used in music therapy", "To highlight a common neurotransmitter involved in physical activity", "To explain the neurological basis of music's impact on emotions", "To suggest that music's effect on the brain is only temporary"],
  ["It will likely lead to additional benefits for mental health.", "It will face challenges due to differences across cultures.", "It will eventually replace some medications used to treat psychological conditions.", "It will focus more on the lyrical content of songs and less on melody and rhythm."],
  ["Advantages and disadvantages of indigo for coloring jeans", "The role of indigo in British trade and colonial expansion", "The history of the indigo trade and indigo's reappearance as a modern commodity", "Qualities that make indigo a viable commercial product"],
  ["The effects of climate change on Indigofera plants", "Labor shortages in the British Empire", "The invention of synthetic indigo", "Trade restrictions"],
  ["It is seen as good for the environment.", "It is the least expensive dye available.", "It requires very little processing.", "It is used in traditional rituals."],
  ["To explain why indigo processing can be interesting for tourists", "To support the claim that indigo is good for traditional economies", "To challenge the claim that some producers use harsh chemicals", "To introduce one problem with using natural indigo"]
];

const extraListeningAnswers = ["b", "c", "c", "d", "c", "c", "a", "c", "b", "c", "a", "c", "c", "a", "d"];

const writingTasks = {
  "writing-q11": {
    title: "Printing Services for Upcoming Play",
    materialType: "email",
    prompt: "Write an email to the print shop manager, Ms. Clark.",
    context: "You are part of your school's drama club and have been assigned the role of event coordinator for an upcoming play. You need to arrange for promotional materials, such as posters and flyers, to be printed and distributed. You want to contact a local print shop to discuss this.",
    rubricId: "toefl.writing_email.v1",
    sourceMaterial: [
      { type: "paragraph", role: "context", text: "You are part of your school's drama club and have been assigned the role of event coordinator for an upcoming play. You need to arrange for promotional materials, such as posters and flyers, to be printed and distributed. You want to contact a local print shop to discuss this." },
      { type: "paragraph", role: "instruction", weight: "bold", text: "Write an email to the print shop manager, Ms. Clark. In your email, do the following:" },
      { type: "list_item", role: "bullet", text: "Describe the event and its importance." },
      { type: "list_item", role: "bullet", text: "Ask about their services for printing promotional materials." },
      { type: "list_item", role: "bullet", text: "Inquire about the costs and turnaround time for printing." },
      { type: "paragraph", role: "instruction", text: "Write as much as you can and in complete sentences." },
      { type: "paragraph", role: "email_header", text: "To: Ms. Clark" },
      { type: "paragraph", role: "email_header", text: "Subject: Printing Services for Upcoming Play" }
    ]
  },
  "writing-q12": {
    title: "Academic Discussion",
    materialType: "academic_discussion",
    prompt: "Do you think its influence is mostly beneficial, or should we be more cautious about its reach and impact?",
    context: "Your professor is teaching a class on sociology. Write a post responding to the professor's question.",
    rubricId: "toefl.academic_discussion.v1",
    sourceMaterial: [
      { type: "paragraph", role: "context", text: "Your professor is teaching a class on sociology. Write a post responding to the professor's question." },
      { type: "paragraph", role: "instruction", weight: "bold", text: "In your response, you should do the following." },
      { type: "list_item", role: "bullet", text: "Express and support your opinion." },
      { type: "list_item", role: "bullet", text: "Make a contribution to the discussion in your own words." },
      { type: "paragraph", role: "instruction", text: "An effective response will contain at least 100 words." },
      { type: "paragraph", role: "speaker", speaker: "Dr. Gupta", text: "We've been exploring how social media platforms influence public opinion in today's connected world. These platforms allow ideas, news, and perspectives to spread quickly, giving individuals and organizations powerful tools to shape conversations. From raising awareness to mobilizing support, social media plays a key role in how people engage with current events. Do you think its influence is mostly beneficial, or should we be more cautious about its reach and impact?" },
      { type: "paragraph", role: "student", speaker: "Claire", text: "I think social media has a negative impact on public opinion. It can often create echo chambers, where people only hear opinions that reinforce their existing beliefs. For example, if my friends on social media all seem to be saying the same thing, how can we be challenged to think more independently?" },
      { type: "paragraph", role: "student", speaker: "Andrew", text: "I believe that the influence of social media is mostly beneficial. It allows people to access a wide range of viewpoints and engage in all kinds of discussions and across languages. This enhances understanding and awareness of different issues." }
    ]
  }
};

async function main() {
  const [questions, stimuli, test, exam] = await Promise.all([
    readJson("questions.json"),
    readJson("stimuli.json"),
    readJson("test.json"),
    readJson("exam.json")
  ]);
  const answerKey = await readJson("answer-key.json").catch(() => ({}));
  const byId = new Map(questions.map((question) => [question.id, question]));

  for (const group of completeGroups) {
    setStimulus(stimuli, group.stimulusId, { title: group.title, paragraphs: [group.text], materialType: "complete_words" });
    for (const [questionId, answer, prefix, missingLength] of group.questions) {
      const question = byId.get(questionId);
      if (question) updateCompleteWords(question, answer, prefix, missingLength, answerKey);
    }
  }

  for (const material of readingMaterials) setStimulus(stimuli, material.id, material);

  for (const [questionId, text, values, answer, questionType, stimulusId] of readingChoices) {
    const question = byId.get(questionId);
    if (!question) continue;
    question.stimulusId = stimulusId;
    updateChoice(question, { prompt: text, options: values, answer, questionType }, answerKey);
  }

  mainListening.forEach((values, index) => {
    const question = byId.get(`listening-q${index + 1}`);
    if (!question) return;
    updateListening(question, {
      prompt: mainListeningPrompts[index],
      options: values,
      answer: mainListeningAnswers[index],
      sourceQuestionNumber: index + 1
    }, answerKey);
  });

  extraListening.forEach((values, index) => {
    const question = byId.get(`listening-m2-q${index + 1}`);
    if (!question) return;
    updateListening(question, {
      prompt: extraListeningPrompts[index],
      options: values,
      answer: extraListeningAnswers[index],
      sourceQuestionNumber: index + 1
    }, answerKey);
  });

  for (const [questionId, task] of Object.entries(writingTasks)) {
    const question = byId.get(questionId);
    const stimulus = stimuli.find((item) => item.id === question?.stimulusId);
    if (question && stimulus) updateWriting(question, stimulus, task);
  }

  dedupeStimuli(stimuli);
  syncTest(test, questions, stimuli);

  for (const section of exam.sections || []) {
    const sectionQuestions = questions.filter((question) => question.sectionId === section.id);
    section.status = sectionQuestions.some((question) => question.needsReview) ? "needs_review" : "published";
    section.config = {
      ...(section.config || {}),
      issueCount: sectionQuestions.filter((question) => question.needsReview).length,
      importStatus: sectionQuestions.some((question) => question.needsReview) ? "needs_review" : "ready"
    };
  }
  exam.config = {
    ...(exam.config || {}),
    publicationStatus: "ready",
    humanVerificationStatus: "reading_writing_listening_verified",
    verifiedContentSource: "verified-content.json",
    formatProfile: "toefl-2026-3.2b-final"
  };
  exam.status = "published";

  const verified = {
    exam: PACK_NAME,
    status: "human_verified",
    canonicalReference: "3.2新托福真题B卷",
    reading: {
      completeGroups: completeGroups.map(({ stimulusId, text, questions: groupQuestions }) => ({ stimulusId, text, questions: groupQuestions })),
      choices: readingChoices.map(([questionId, promptText, values, answer, questionType, stimulusId]) => ({ questionId, stimulusId, questionType, prompt: promptText, options: values, answer }))
    },
    listening: {
      main: mainListening.map((values, index) => ({ questionId: `listening-q${index + 1}`, sourceQuestionNumber: index + 1, prompt: mainListeningPrompts[index], options: values, answer: mainListeningAnswers[index] })),
      extra: extraListening.map((values, index) => ({ questionId: `listening-m2-q${index + 1}`, sourceQuestionNumber: index + 1, prompt: extraListeningPrompts[index], options: values, answer: extraListeningAnswers[index] }))
    },
    writing: writingTasks
  };

  await Promise.all([
    writeJson("questions.json", questions),
    writeJson("stimuli.json", stimuli),
    writeJson("test.json", test),
    writeJson("exam.json", exam),
    writeJson("answer-key.json", answerKey),
    writeFile(path.join(PACK, "verified-content.json"), `${JSON.stringify(verified, null, 2)}\n`)
  ]);

  console.log(JSON.stringify({
    readingChoices: readingChoices.length,
    listeningChoices: mainListening.length + extraListening.length,
    writingTasks: Object.keys(writingTasks).length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
