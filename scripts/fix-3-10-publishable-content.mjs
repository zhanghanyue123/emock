import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACK = path.join(ROOT, "真题合集7-5", "3.10新托福真题");
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
      ...paragraphs.map((item) => typeof item === "string" ? { type: "paragraph", text: item } : item)
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
    stimulus = {
      id,
      examPackId: "toefl",
      stimulusType: `toefl.reading_${materialType}`,
      title,
      assetIds: [],
      content: null,
      config: {}
    };
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
  question.questionType = spec.questionType || question.questionType;
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
  updateChoice(question, {
    ...spec,
    sourceQuestionNumber: question.number
  }, answerKey, "toefl.listening_choice");
  question.questionType = spec.questionType || question.questionType || "toefl.listen_choose_response";
  question.config = {
    ...question.config,
    prompt: spec.prompt,
    originalSourceQuestionNumber: spec.sourceQuestionNumber || question.number,
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

function dedupeStimuli(stimuli) {
  const best = new Map();
  const score = (item) => {
    let value = 0;
    if (item.content?.type === "blocks") value += 4;
    if (item.config?.humanVerificationStatus === "verified") value += 3;
    if (item.stimulusType !== "source_image_fallback") value += 2;
    if (item.config?.extractionStatus === "human_verified") value += 1;
    return value;
  };
  for (const stimulus of stimuli) {
    const existing = best.get(stimulus.id);
    if (!existing || score(stimulus) > score(existing)) best.set(stimulus.id, stimulus);
  }
  stimuli.splice(0, stimuli.length, ...best.values());
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
    text: "The earliest ancestor of the modern bicycle is probably a machine used in England in the early 1800s called a hobbyhorse. It has two wheels and a place to sit, but no pedals; riders would push it along with their feet. Later, an inventor added pedals directly to the front wheel, like a modern child's tricycle. This version, with a huge front wheel, was faster, but it was unsafe. Riders were high off the ground, and the two wheels were close together, making both balance and stopping difficult.",
    questions: [
      ["reading-m1-q1", "has", "h", 2],
      ["reading-m1-q2", "wheels", "whe", 3],
      ["reading-m1-q3", "place", "pl", 3],
      ["reading-m1-q4", "sit", "s", 2],
      ["reading-m1-q5", "no", "n", 1],
      ["reading-m1-q6", "riders", "rid", 3],
      ["reading-m1-q7", "push", "pu", 2],
      ["reading-m1-q8", "along", "al", 3],
      ["reading-m1-q9", "their", "th", 3],
      ["reading-m1-q10", "later", "la", 3]
    ]
  },
  {
    stimulusId: "reading-m1-complete-words-2",
    title: "Fill in the missing letters in the paragraph.",
    text: "Honeybee social structure is a fascinating example of cooperation and division of labor in the animal kingdom. The main role of the queen bee is to lay thousands of eggs to keep the colony growing. Worker bees are the busy multitaskers; they collect nectar and pollen, feed baby bees, clean the hive, and stand guard against intruders. The only job of the male drones is to mate with a queen from another hive. Each bee plays a unique role, and this organized system of cooperation helps the colony survive and thrive.",
    questions: [
      ["reading-m1-q11", "thousands", "thou", 5],
      ["reading-m1-q12", "eggs", "eg", 2],
      ["reading-m1-q13", "keep", "ke", 2],
      ["reading-m1-q14", "colony", "col", 3],
      ["reading-m1-q15", "worker", "wor", 3],
      ["reading-m1-q16", "are", "a", 2],
      ["reading-m1-q17", "busy", "bu", 2],
      ["reading-m1-q18", "they", "th", 2],
      ["reading-m1-q19", "nectar", "nec", 3],
      ["reading-m1-q20", "pollen", "pol", 3]
    ]
  },
  {
    stimulusId: "reading-m2-q1-10-stimulus",
    title: "Fill in the missing letters in the paragraph.",
    text: "Medieval European history, lasting approximately from 500 C.E. to 1500 C.E., is marked by significant cultural, political, and economic changes. Feudalism dominated the social structure, with lords governing lands and vassals providing military service. The Church exerted substantial influence over daily life and governance. Trade routes expanded, facilitating the exchange of goods and ideas. Art and architecture flourished, exemplified by Gothic cathedrals and illuminated manuscripts. Studying this era involves analyzing historical documents, artifacts, and architectural remains to understand the complexities of medieval society.",
    questions: [
      ["reading-m2-q1", "dominated", "domi", 5],
      ["reading-m2-q2", "social", "soc", 3],
      ["reading-m2-q3", "with", "wi", 2],
      ["reading-m2-q4", "governing", "gover", 4],
      ["reading-m2-q5", "and", "a", 2],
      ["reading-m2-q6", "providing", "prov", 5],
      ["reading-m2-q7", "service", "ser", 4],
      ["reading-m2-q8", "exerted", "exe", 4],
      ["reading-m2-q9", "influence", "influ", 4],
      ["reading-m2-q10", "daily", "da", 3]
    ]
  }
];

const readingMaterials = [
  {
    id: "reading-m1-q21-stimulus",
    title: "Build a Raised Garden Bed",
    materialType: "notice",
    paragraphs: [
      "Step 1: Prepare wooden boards for the size of bed you choose.",
      "Step 2: Place the boards in a rectangle.",
      "Step 3: Drill holes in the boards where they meet.",
      "Step 4: Attach the boards with screws to form a frame."
    ]
  },
  {
    id: "reading-m1-q23-stimulus",
    title: "Springfield Community Wellness Classes - Special Addition",
    materialType: "notice",
    paragraphs: [
      "Due to popular demand, guided stretching sessions will take place in Central Park every Saturday at 8:00 A.M., well before the start time of other weekend classes.",
      "Stretching boosts flexibility, reduces tension, and improves circulation.",
      "Bring a mat and a water bottle.",
      "Free for residents!"
    ]
  },
  {
    id: "reading-m1-q25-stimulus",
    title: "How Well Did You Sleep?",
    materialType: "article",
    paragraphs: [
      "In addition to using Health Geek to track your exercise, you can use it to monitor your sleep. Wear the wristband at night. In the morning, upload data to the phone app and get a readout. Here's a sample.",
      "Percentage of Time in Each Sleep Stage: Light Sleep 50%; Deep Sleep 10%; REM Sleep 25%; Awake 15%.",
      "At night, your body moves naturally from one sleep stage to another. Heart rate and movement are used to calculate your sleep pattern.",
      "Light Sleep: The muscles relax. Heart rate and breathing slow down. About half of sleeping time is usually spent in light sleep.",
      "Deep Sleep: The body is deeply relaxed. This stage is critical for physical recovery and growth.",
      "REM (Rapid Eye Movement) Sleep: Brain activity increases, and vivid dreams may occur. Even though the eyes are closed, they move quickly. This stage is essential for memory, learning, and creativity.",
      "Awake: It is normal for a person to wake up several times at night."
    ]
  },
  {
    id: "reading-m1-q28-stimulus",
    title: "Interest in energy regulation policy",
    materialType: "email",
    paragraphs: [
      "To: Yael Thomas, Policy Director, CFES",
      "From: Serena Grant",
      "Sent: March 3, 2:09 P.M.",
      "Subject: Interest in energy regulation policy",
      "Dear Ms. Thomas,",
      "I attended your guest lecture yesterday on regulatory frameworks for the oil and gas sector and found your analysis of industry challenges both candid and thought-provoking. As a junior majoring in political science, I'm eager to understand how regulation affects energy markets. Could we schedule a brief call next week to discuss your experience advising state commissions on drilling permits? I especially appreciated your comments yesterday on the debate over domestic energy independence and the role of alternative fuels in shaping future infrastructure. I'm available Monday or Wednesday afternoons but can adjust to your schedule if needed. Thank you for considering my request--I value your expertise in navigating complex policy arenas.",
      "Best regards,",
      "Serena Grant"
    ]
  },
  {
    id: "reading-m1-q31-stimulus",
    title: "Floating Wind Turbines",
    materialType: "academic_passage",
    paragraphs: [
      "Wind turbines are large devices with long blades that capture wind energy and convert it into electricity. Floating wind turbines are a special type of wind turbines because they are not fixed to the seabed but are anchored using advanced mooring systems, allowing placement in deeper waters where winds are more consistent. In this context, anchoring refers to securing the turbine in place using cables or chains connected to weighted structures or anchors on the ocean floor, ensuring stability despite the lack of a fixed foundation. The deeper placement means the wind turbines can harness untapped wind resources that traditional turbines cannot access.",
      "Engineering floating turbines involves unique challenges. They rely on buoyancy principles rather than on solid ground, making their design and maintenance complex. Despite the increased costs, their ability to reduce visual and noise pollution makes them an attractive option for distant offshore locations. However, their long-term viability is threatened by harsh marine conditions that can accelerate wear and tear.",
      "Research continues to explore solutions for these problems. Some experts are investigating materials and designs to enhance durability. As efforts to capitalize on deeper offshore wind resources persist, floating turbines represent both a promising opportunity and a complex engineering puzzle."
    ]
  },
  {
    id: "reading-m2-q11-stimulus",
    title: "Space Debris: A Growing Concern",
    materialType: "academic_passage",
    paragraphs: [
      "The Kessler Syndrome, proposed by NASA scientist Donald J. Kessler in 1978, hypothesizes a cascading effect in low Earth orbit (LEO) in which collisions between satellites and debris--defunct satellites, spent rocket stages, and fragments from earlier collisions--generate more fragments, exponentially increasing the likelihood of further collisions. This feedback loop could render certain orbital regions unusable for decades. While the model is compelling, some assumptions merit scrutiny. For instance, it presumes a uniform distribution of debris and constant collision probability, yet orbital mechanics suggest that debris clusters in specific altitudes and orbital paths, potentially limiting the scope of cascading events.",
      "Moreover, technological advancements in debris tracking and active removal may mitigate the risk more effectively than Kessler originally envisioned. Critics argue that the syndrome underestimates the resilience of orbital infrastructure and overstates the inevitability of runaway collisions. Alternative explanations for observed debris growth include a greater number of satellite launches and fragmentation from aging spacecraft, rather than a self-sustaining cascade.",
      "Nonetheless, the Kessler Syndrome remains a valuable heuristic for space policy, emphasizing the need for international cooperation and sustainable orbital practices. Its cautionary implications are profound--especially as commercial constellations dramatically increase the number of active satellites in LEO."
    ]
  }
];

const readingChoices = [
  ["reading-m1-q21", "Why would someone follow these instructions?", ["To build some bedroom furniture", "To make a wooden picture frame", "To prepare a garden", "To paint some boards"], "c", "toefl.daily_life_choice", "reading-m1-q21-stimulus"],
  ["reading-m1-q22", "In which step are the wooden boards connected?", ["Step 1", "Step 2", "Step 3", "Step 4"], "d", "toefl.daily_life_choice", "reading-m1-q21-stimulus"],
  ["reading-m1-q23", "What is indicated about the special sessions?", ["They will be held twice a month.", "They are required for those who take other weekend classes.", "They are free for anyone who would like to participate.", "They are being offered in response to community interest."], "d", "toefl.daily_life_choice", "reading-m1-q23-stimulus"],
  ["reading-m1-q24", "What is NOT mentioned about stretching?", ["It improves flexibility.", "It helps relieve tension.", "It builds muscle strength.", "It enhances circulation."], "c", "toefl.daily_life_choice", "reading-m1-q23-stimulus"],
  ["reading-m1-q25", "What is Health Geek?", ["An online fitness class", "A blog for posting sleeping tips", "A device that goes on the wrist", "A health and wellness magazine"], "c", "toefl.daily_life_choice", "reading-m1-q25-stimulus"],
  ["reading-m1-q26", "How is the amount of time in each sleep stage estimated?", ["By observing eye and face motions", "By measuring changes in body temperature", "By following a person's breathing patterns", "By monitoring heart rate and body movements"], "d", "toefl.daily_life_choice", "reading-m1-q25-stimulus"],
  ["reading-m1-q27", "What percentage of time is usually spent in light sleep?", ["50 percent", "25 percent", "15 percent", "10 percent"], "a", "toefl.daily_life_choice", "reading-m1-q25-stimulus"],
  ["reading-m1-q28", "What is the main purpose of the email?", ["To confirm attendance at a lecture for academic credit", "To apply for a research assistant position at a policy institute", "To request a letter of recommendation for a job in the energy sector", "To arrange a conversation about an expert's professional experience"], "d", "toefl.daily_life_choice", "reading-m1-q28-stimulus"],
  ["reading-m1-q29", "What aspect of energy regulation is Serena interested in?", ["Its ability to solve the energy industry's problems", "Its relation to markets", "Its critique of traditional fuels", "Its effects on building new energy infrastructure"], "b", "toefl.daily_life_choice", "reading-m1-q28-stimulus"],
  ["reading-m1-q30", "What will Serena probably do if Ms. Thomas offers to call her on a Tuesday morning?", ["Remind her that she is free on Monday and Wednesday afternoons", "Suggest that they have the call on the weekend instead", "Change her own schedule and agree to a call on Tuesday", "Suggest that they compromise and speak on a Monday or Wednesday morning"], "c", "toefl.daily_life_choice", "reading-m1-q28-stimulus"],
  ["reading-m1-q31", "The word \"harness\" in the passage is closest in meaning to", ["limit", "distribute", "release", "exploit"], "d", "toefl.academic_passage_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q32", "What unique advantage do floating wind turbines have over traditional turbines?", ["They are larger in size and have longer blades.", "They require less maintenance.", "They can be placed in deeper waters.", "They are easier to design."], "c", "toefl.academic_passage_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q33", "Why does the author mention \"buoyancy principles\"?", ["To point out a challenge of creating floating turbines", "To suggest a new area for future research into floating turbines", "To emphasize the greater flexibility of floating turbines compared with traditional turbines", "To provide an example of cost-saving measures related to floating turbines"], "a", "toefl.academic_passage_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q34", "What can be inferred about the acceleration of \"wear and tear\" in floating turbines?", ["Any attempts to reduce it will likely prove to be unsuccessful.", "Scientists are working to control it through better designs and materials.", "It is prompting engineers to place floating wind turbines closer to shore.", "It makes floating turbines especially unattractive to look at."], "b", "toefl.academic_passage_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q35", "Where would the sentence best fit? Sentence: Others assess economic models that might offset higher initial expenses.", ["Before \"Research continues to explore solutions for these problems.\"", "Before \"Some experts are investigating materials and designs to enhance durability.\"", "Before \"As efforts to capitalize on deeper offshore wind resources persist...\"", "After the final sentence of the passage"], "c", "toefl.academic_passage_choice", "reading-m1-q31-stimulus"],
  ["reading-m2-q11", "The passage suggests that one impact of the Kessler Syndrome would be", ["an increase in NASA space research", "a limitation on where satellites could safely orbit", "a greater number of satellite launches", "an increased risk of debris falling to Earth"], "b", "toefl.academic_passage_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q12", "Why does the author mention the assertion that \"debris clusters in specific altitudes and orbital paths\"?", ["To provide a reason for an increase in collisions between satellites and debris", "To illustrate a part of the feedback loop", "To explain an objection to the Kessler Syndrome hypothesis", "To emphasize the need for better debris tracking"], "c", "toefl.academic_passage_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q13", "The word \"resilience\" in the passage is closest in meaning to", ["strength", "threat", "knowledge", "supervision"], "a", "toefl.academic_passage_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q14", "According to the passage, some argue that the Kessler Syndrome will not occur for all of the following reasons EXCEPT:", ["Space debris may not be spread out as evenly as the theory assumes.", "New technology means that the removal of debris may be possible.", "NASA has since developed new orbital infrastructure for avoiding collisions.", "There may be other explanations for the observed growth in debris."], "c", "toefl.academic_passage_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q15", "What does \"Its cautionary implications\" refer to in the passage?", ["The idea that one must assess the Kessler Syndrome carefully before accepting its predictions", "The idea that there will be cascading collisions in LEO, making it difficult for satellites to remain intact", "The suggestion that international cooperation will be more difficult to achieve as space becomes more cluttered", "The suggestion that debris tracking and active removal may pose additional risks to satellites"], "b", "toefl.academic_passage_choice", "reading-m2-q11-stimulus"]
];

const mainListening = [
  ["Do you want to borrow my lawn mower?", "English and history.", "How did you find out?", "That's good advice."],
  ["The artist came late.", "Yesterday.", "Sometime after noon.", "Let's eat off-campus tonight."],
  ["I'm still waiting for feedback.", "Sure, I'll go to the orientation.", "Did he like the present?", "Do they go every weekend?"],
  ["I make sure to check the weather forecast first.", "I tend to prefer paddling downstream.", "The climbing gym is on campus.", "I enjoy spending time outdoors."],
  ["I have everything except the herbs.", "I put the dishes away already.", "We'll have dinner around 7 p.m.", "The student dining center is great."],
  ["It turned out to be quite fragile.", "I found it very engaging.", "At the community arts center.", "Two hours twice a week."],
  ["I like taking notes.", "Yes, in the park.", "No, on the bottom.", "It's quite expensive."],
  ["The conference call lasted two hours.", "Most of our classmates, I think.", "The professor took attendance during the afternoon class.", "No, I wasn't there."],
  ["Yes, she was a gracious hostess.", "Oh, I wonder if they'll supply the exercise mats.", "The climbing gym is on the other side of campus.", "Sorry, she wasn't able to make it on time."],
  ["The location of a new park", "Their favorite types of music", "Their plans to attend an event", "The best places to listen to music"],
  ["He is worried that he might get cold.", "He thinks the tickets are too expensive.", "He would like a seat close to the stage.", "He will sit in the grass with the woman's friends."],
  ["A lost item", "An expensive evening", "A lackluster performance", "A missed bus"],
  ["To ask for a recommendation", "To make a suggestion", "To correct a previous statement", "To provide an explanation"],
  ["Exercising more", "Changing his diet", "Learning to cook", "Growing his own vegetables"],
  ["Chicken and fish", "Cheese and yogurt", "Beans and nuts", "Carrots and spinach"],
  ["To survey graduating students about their experiences", "To improve awareness of a campus service", "To invite writing tutors on stage", "To outline the process for reserving the auditorium"],
  ["It is too small for the center's needs.", "It is housed within the library.", "It is difficult to locate.", "It opens at seven p.m."],
  ["A backup system is not working.", "There is no electricity on campus.", "Temperatures are much colder than usual.", "A steam pipe broke."],
  ["They can overload electrical systems.", "They can affect lab experiments.", "Their use of power is too expensive over time.", "Heat from them can damage pipes."],
  ["To ask for volunteer judges", "To say who won a contest", "To tell when an exhibit will end", "To remind students of a deadline"],
  ["On a Web site", "At a local museum", "In the campus newspaper", "In a campus building"],
  ["Listening to music from different genres", "Choosing particular musicians to research", "Combining a range of musical styles in one song", "Using pieces of recorded music in a new song"],
  ["A legal case", "A concert", "The invention of a new instrument", "The start of a new recording company"],
  ["She disagrees with the criticism that it lacks creativity.", "She likes that it is a unique practice in the history of music.", "She is disappointed that it is no longer commonly used.", "She has not yet decided how she feels about it."],
  ["Take a survey", "Discuss the artwork from an album cover", "Play a recording", "Help students do their own sampling"],
  ["The technical challenges faced by certain artists", "The development and significance of a particular type of art", "The influence of traditional art forms on modern artists", "The popularity of kinetic art among contemporary patrons"],
  ["He criticized the use of technology in art.", "He advanced the idea of using movement and light in art.", "He was the first to use air and wind to manipulate art.", "He established the first kinetic art museum."],
  ["It requires video monitors.", "It can make it difficult for the audience to engage.", "It can involve technical difficulties.", "It is rarely displayed in major galleries."],
  ["To summarize the way kinetic art engages its viewers", "To emphasize that kinetic art is hard to understand", "To highlight an advantage of using video in kinetic art", "To explain the technical requirements of kinetic art installations"]
];

const mainListeningPrompts = [
  ...Array(9).fill("Choose the best response."),
  "What are the man and the woman talking about?",
  "What does the man imply when he says, \"I'll bring a blanket too\"?",
  "What are the speakers mainly discussing?",
  "Why does the woman mention that her phone battery needs to be replaced?",
  "What is the man considering?",
  "What does the woman recommend for protein?",
  "What is the main purpose of the information session?",
  "What does the speaker imply about the writing center's current location?",
  "Why are most campus buildings cold?",
  "Why is the use of electric heaters not allowed?",
  "What is the purpose of the announcement?",
  "Where will students be able to view all the photographs?",
  "How does the speaker define \"sampling\"?",
  "What event does the speaker say caused a change to a creative process?",
  "What is the speaker's attitude toward sampling?",
  "What will the speaker most likely do next?",
  "What is the main topic of the talk?",
  "According to the talk, what role did the Hungarian artist Laszlo Moholy-Nagy play in the development of kinetic art?",
  "What challenge is associated with kinetic art, as mentioned in the talk?",
  "Why does the speaker describe kinetic art as \"a multisensory experience\"?"
];

const mainListeningAnswers = [
  "c", "c", "a", "a", "a", "b", "d", "b", "b", "c",
  "d", "a", "d", "b", "c", "b", "b", "d", "a", "d",
  "a", "d", "a", "a", "c", "b", "b", "c", "a"
];

const extraListening = [
  ["What grade did you get on your painting?", "Yes, it inspired the topic of my research paper.", "No, most museums charge an entrance fee.", "Hiking tours are a great way to learn about nature."],
  ["It was wonderful to get some fresh air outdoors.", "The outside vendor request needs approval.", "They went with the student outdoor adventure club.", "There was a tax hike last year, actually."],
  ["The astronomy course has a lab and a lecture.", "Let's meet in the library to review for the test.", "That professor is a real expert in her field.", "On a different site."],
  ["Some content is outdated.", "Some computers are getting old.", "A computer lab was closed.", "A document did not print."],
  ["To correct the man's misunderstanding", "To suggest revising a training schedule", "To communicate a sense of urgency", "To point out some errors that were made"],
  ["It is too crowded.", "It is too early in the morning.", "The instructor is not experienced.", "The location moves regularly."],
  ["To decline the woman's invitation", "To point out where he learned about a yoga class", "To highlight a health benefit of practicing yoga", "To explain why he chose a specific yoga session"],
  ["She outlines solar power's history as an alternative energy resource.", "She lists the technologies involved in generating solar energy.", "She offers case studies of successful solar power projects.", "She compares and contrasts the benefits and challenges of solar power."],
  ["To describe how solar panels convert solar energy into electricity", "To discuss innovations in the storage of solar energy", "To explain the cost of installing solar electric systems", "To explain the difficulty and expense of recycling solar panels"],
  ["To provide context for a discussion of the solar industry's low carbon footprint", "To suggest that there are reasons for skepticism of the solar industry", "To introduce a discussion about the harmful pollutants given off by solar panels", "To support the claim that solar power provides energy to underserved areas"],
  ["Solar panels produced in the last decade cannot be recycled.", "Solar panels in regions with heavy cloud cover are scrapped due to disuse.", "Improvements in panel efficiency are leading to frequent replacement.", "The use of solar power is declining in many regions."],
  ["To contrast two methods of farming", "To describe a method for repairing damaged soil", "To explain differences between several types of ecosystems", "To discuss new research into microorganisms found in soil"],
  ["They hold soil particles together.", "They indicate that soil is degraded.", "They are an important nutrient source for microbes.", "They can replace chemical fertilizers under certain conditions."],
  ["A laboratory where microbes are grown.", "A location where restoration efforts have previously failed.", "A degraded area that is used for testing interventions.", "A healthy ecosystem used as a model."],
  ["Its soil contained high numbers of bacteria.", "Its vines were infected with harmful fungi.", "It was surrounded by forested land.", "Its soil was hard and dry."]
];

const extraListeningPrompts = [
  "Choose the best response.",
  "Choose the best response.",
  "Choose the best response.",
  "What did the woman notice yesterday?",
  "Why does the woman mention three new staff members?",
  "What complaint does the man have about a yoga class?",
  "Why does the man mention his biology seminar?",
  "How does the speaker organize the talk on solar power?",
  "Why does the speaker mention photovoltaic cells?",
  "Why does the speaker note that all industries produce some carbon dioxide?",
  "According to the speaker, what is causing a rapid increase in waste from used solar panels?",
  "What is the main purpose of the talk?",
  "What does the speaker point out about extracellular polymeric substances?",
  "What is a reference site in the work that the speaker describes?",
  "What does the professor say about the California vineyard before the intervention?"
];

const extraListeningAnswers = [
  "b", "a", "c", "a", "c", "a", "d", "d", "a", "a",
  "c", "b", "a", "d", "d"
];

const writingTasks = {
  "writing-q11": {
    title: "Managing stress and workload",
    materialType: "email",
    prompt: "Write an email to Alex.",
    context: "Your friend, Alex, has been feeling overwhelmed with university assignments. You have noticed that he is struggling to keep up with his workload and is not taking proper care of his health. You want to offer some helpful advice.",
    rubricId: "toefl.writing_email.v1",
    sourceMaterial: [
      { type: "paragraph", role: "context", text: "Your friend, Alex, has been feeling overwhelmed with university assignments. You have noticed that he is struggling to keep up with his workload and is not taking proper care of his health. You want to offer some helpful advice." },
      { type: "paragraph", role: "instruction", weight: "bold", text: "In your email, do the following:" },
      { type: "list_item", role: "bullet", text: "Describe to Alex what you have recently noticed about him." },
      { type: "list_item", role: "bullet", text: "Explain why it is important to maintain good health." },
      { type: "list_item", role: "bullet", text: "Suggest some specific strategies Alex can use to manage his stress and workload." },
      { type: "paragraph", role: "instruction", text: "Write as much as you can and in complete sentences." },
      { type: "paragraph", role: "email_header", text: "To: Alex" },
      { type: "paragraph", role: "email_header", text: "Subject: Managing stress and workload" }
    ]
  },
  "writing-q12": {
    title: "Academic Discussion",
    materialType: "academic_discussion",
    prompt: "What do you think has a greater impact on shaping history: individual actions or broader social and economic forces? Why?",
    context: "Your professor is teaching a class on history. Write a post responding to the professor's question.",
    rubricId: "toefl.academic_discussion.v1",
    sourceMaterial: [
      { type: "paragraph", role: "context", text: "Your professor is teaching a class on history. Write a post responding to the professor's question." },
      { type: "paragraph", role: "instruction", weight: "bold", text: "In your response, you should do the following." },
      { type: "list_item", role: "bullet", text: "Express and support your opinion." },
      { type: "list_item", role: "bullet", text: "Make a contribution to the discussion in your own words." },
      { type: "paragraph", role: "instruction", text: "An effective response will contain at least 100 words." },
      { type: "paragraph", role: "speaker", speaker: "Dr. Diaz", text: "We've been discussing the impact of major historical figures on their respective societies. Some historians argue that individuals like political leaders or influential thinkers shape the course of history more than broader social and economical forces. Others believe social and economical events are the primary drivers of historical change. What do you think has a greater impact on shaping history: individual actions or broader social and economic forces? Why?" },
      { type: "paragraph", role: "speaker", speaker: "Andrew", text: "I believe individuals and their actions have a greater impact on shaping history. Leaders and influential thinkers can inspire movements, create significant changes, and leave a lasting legacy. Their decisions and actions often alter the course of events in profound ways." },
      { type: "paragraph", role: "speaker", speaker: "Kelly", text: "In my opinion, broader social and economic events are more significant in shaping history. While individuals can influence events, it is the underlying conditions and trends that drive major changes. These forces affect large groups of people and create the context in which individuals operate." }
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
  const stimuliById = new Map(stimuli.map((stimulus) => [stimulus.id, stimulus]));

  for (const group of completeGroups) {
    setStimulus(stimuli, group.stimulusId, {
      title: group.title,
      paragraphs: [group.text],
      materialType: "complete_words"
    });
    for (const [questionId, answer, prefix, missingLength] of group.questions) {
      const question = byId.get(questionId);
      if (question) updateCompleteWords(question, answer, prefix, missingLength, answerKey);
    }
  }

  for (const material of readingMaterials) {
    setStimulus(stimuli, material.id, material);
  }
  const aliasStimuli = new Map([
    ["reading-m1-q22-stimulus", "reading-m1-q21-stimulus"],
    ["reading-m1-q24-stimulus", "reading-m1-q23-stimulus"],
    ["reading-m1-q26-stimulus", "reading-m1-q25-stimulus"],
    ["reading-m1-q27-stimulus", "reading-m1-q25-stimulus"],
    ["reading-m1-q29-stimulus", "reading-m1-q28-stimulus"],
    ["reading-m1-q30-stimulus", "reading-m1-q28-stimulus"],
    ["reading-m1-q32-stimulus", "reading-m1-q31-stimulus"],
    ["reading-m1-q33-stimulus", "reading-m1-q31-stimulus"],
    ["reading-m1-q34-stimulus", "reading-m1-q31-stimulus"],
    ["reading-m1-q35-stimulus", "reading-m1-q31-stimulus"],
    ["reading-m2-q12-stimulus", "reading-m2-q11-stimulus"],
    ["reading-m2-q13-stimulus", "reading-m2-q11-stimulus"],
    ["reading-m2-q14-stimulus", "reading-m2-q11-stimulus"],
    ["reading-m2-q15-stimulus", "reading-m2-q11-stimulus"]
  ]);
  for (const [from, to] of aliasStimuli) {
    const source = stimuli.find((item) => item.id === to);
    if (source) {
      stimuliById.set(from, source);
      const existing = stimuli.find((item) => item.id === from);
      if (existing) Object.assign(existing, { ...source, id: from });
    }
  }

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
      sourceQuestionNumber: index + 4
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

  for (const question of questions.filter((item) => item.sectionId === "speaking")) {
    question.needsReview = false;
    question.status = "published";
    question.confidence = Math.max(question.confidence || 0, 0.95);
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

  const verified = {
    exam: "3.10新托福真题",
    status: "human_verified",
    canonicalReference: "3.2新托福真题B卷",
    reading: {
      completeGroups: completeGroups.map(({ stimulusId, text, questions }) => ({ stimulusId, text, questions })),
      choices: readingChoices.map(([questionId, promptText, values, answer, questionType, stimulusId]) => ({ questionId, stimulusId, questionType, prompt: promptText, options: values, answer }))
    },
    listening: {
      mainStartsAtSourceQuestion: 4,
      main: mainListening.map((values, index) => ({ questionId: `listening-q${index + 1}`, sourceQuestionNumber: index + 4, prompt: mainListeningPrompts[index], options: values, answer: mainListeningAnswers[index] })),
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
