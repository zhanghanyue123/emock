import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACK_NAME = "2.25新托福真题";
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
    text: "Rock formations offer valuable insights into Earth's history. Sedimentary layers, for example, reveal past environments. By analyzing their composition and arrangement, geologists can determine if an area was once underwater or exposed. Over time, pressure transforms sediments into solid rock, preserving evidence of ancient climates and geological events. Fossils within layers show what organisms once lived there. Through such studies, scientists reconstruct Earth's past and gain a deeper understanding of the dynamic processes that continue to shape the planet's surface.",
    questions: [
      ["reading-m1-q1", "transform", "trans", 5],
      ["reading-m1-q2", "into", "in", 2],
      ["reading-m1-q3", "rock", "ro", 2],
      ["reading-m1-q4", "evidence", "evid", 4],
      ["reading-m1-q5", "ancient", "anci", 3],
      ["reading-m1-q6", "and", "a", 2],
      ["reading-m1-q7", "events", "eve", 3],
      ["reading-m1-q8", "within", "wi", 4],
      ["reading-m1-q9", "show", "s", 3],
      ["reading-m1-q10", "organisms", "orga", 5]
    ]
  },
  {
    stimulusId: "reading-m1-complete-words-2",
    title: "Fill in the missing letters in the paragraph.",
    text: "Weather patterns are influenced by a variety of factors, including atmospheric pressure, temperature, and humidity. Meteorologists study these factors to predict weather conditions and understand climate change. Tools like satellites and radar allow meteorologists to monitor weather systems in great detail. Accurate weather forecasting is crucial for agriculture, disaster preparedness, and daily planning. It should be noted, however, that despite technological advancements, weather is inherently unpredictable due to the numerous atmospheric variables that can change rapidly.",
    questions: [
      ["reading-m1-q11", "study", "st", 3],
      ["reading-m1-q12", "factors", "fac", 4],
      ["reading-m1-q13", "predict", "pre", 4],
      ["reading-m1-q14", "conditions", "condi", 5],
      ["reading-m1-q15", "understand", "under", 5],
      ["reading-m1-q16", "change", "cha", 3],
      ["reading-m1-q17", "like", "li", 2],
      ["reading-m1-q18", "and", "a", 2],
      ["reading-m1-q19", "allow", "al", 3],
      ["reading-m1-q20", "to", "t", 1]
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
      ["reading-m2-q9", "literature", "lit", 7],
      ["reading-m2-q10", "and", "a", 2]
    ]
  }
];

const readingMaterials = [
  {
    id: "reading-m1-q21-stimulus",
    title: "Thank you for your purchase at Dunlap's!",
    materialType: "receipt",
    paragraphs: [
      "Receipt No.: 11234",
      "Date: Saturday, August 29",
      "Items Purchased:",
      "Smartphone: $299.00",
      "Headphones: $49.00",
      "USB thumb drive: $10.00",
      "Tax: $21.48",
      "Total Amount: $379.48"
    ]
  },
  {
    id: "reading-m1-q23-stimulus",
    title: "Campus Innovation Hub",
    materialType: "social_post",
    paragraphs: [
      "Tech Bootcamp Alert!",
      "Join us on February 20 at the Campus Innovation Hub for an intense, hands-on dive into AI, secure digital systems, and online safety.",
      "Interact with experts, enjoy refreshments, and explore the future of tech.",
      "Limited seats--register now!",
      "Visit www.innovationhub.college.edu.",
      "#TechBootcamp #Innovation #AI #OnlineSafety"
    ]
  },
  {
    id: "reading-m1-q25-stimulus",
    title: "Attention Residents!",
    materialType: "notice",
    paragraphs: [
      "Due to necessary maintenance on the main water line, there will be a temporary interruption in water service for all residents in the Maplewood dormitory.",
      "Date: Monday, March 15 Time: 9:00 A.M.-4:00 P.M.",
      "Important Information:",
      "1. Preparation:",
      "Fill containers with water for drinking and cooking before the interruption.",
      "Store enough water for personal hygiene needs.",
      "2. During the Interruption:",
      "Do not attempt to use faucets, showers, or any appliances that require water.",
      "Toilets may not function properly; please plan accordingly.",
      "3. After Service Resumes:",
      "Run cold water through all faucets for a few minutes to clear any sediment.",
      "Check for any leaks and report them immediately to the maintenance department.",
      "Contact Information: For questions or concerns, please contact the Maplewood Maintenance Department at 555-4321.",
      "We apologize for the inconvenience and appreciate your understanding as we work to improve our community's water infrastructure."
    ]
  },
  {
    id: "reading-m1-q28-stimulus",
    title: "Thank you for shopping at Trendie Boutique!",
    materialType: "receipt",
    paragraphs: [
      "Date: October 8",
      "Time: 2:45 P.M.",
      "Location: 800 Grafton Street, Dublin",
      "Items Purchased:",
      "Silk Scarf €25.00",
      "Leather Handbag €85.00",
      "Sunglasses €50.00",
      "Cotton T-shirt €20.00",
      "Subtotal: €180.00",
      "Gift Card: -€5.00",
      "Value Added Tax (23%): €40.25",
      "Total: €215.25",
      "We hope you love your new items! Returns and exchanges are accepted only with receipts. Your feedback is important to us. Please visit our website to share your experience. Follow us on social media for the latest trends and exclusive offers."
    ]
  },
  {
    id: "reading-m1-q31-stimulus",
    title: "Parallel Algorithms: From Challenges to Opportunities",
    materialType: "academic_passage",
    paragraphs: [
      "Parallel algorithms, a computing method common in modern computers, solve problems faster by dividing a task into smaller parts that run at the same time. Instead of checking every item in a huge database one by one as in a sequential algorithm, a parallel algorithm might split the job across multiple processor cores, each checking a portion of the data simultaneously.",
      "In healthcare, parallel algorithms play a crucial role in analyzing large datasets quickly. When researchers simulate how a virus spreads through a population, they need to process millions of data points--like infection rates and demographics. Using parallel processing, these simulations can run in minutes instead of hours, helping public health officials make faster decisions during outbreaks. However, if too much data is sent to the processors at once without proper management, the system slows down.",
      "One of the strengths of parallel algorithms is their versatility. Developers can tailor them to work efficiently on different types of hardware, such as graphics processing units (GPUs), which are especially good at handling many tasks at once. This is a big reason why deep learning--used in things like facial recognition--has advanced so quickly. Training a deep learning model would be nearly impossible without parallel computing."
    ]
  },
  {
    id: "reading-m2-q11-stimulus",
    title: "Generational Identity",
    materialType: "academic_passage",
    paragraphs: [
      "Some researchers studying the United States population posit that Generation Z (born roughly between 1997 and 2012) is not merely an extension of millennials (born roughly between 1981 and 1996) but a distinct cohort shaped by fundamentally different sociotechnological conditions. While millennials came of age during the rise of the Internet and social media, Gen Z has never known a world without smartphones, automated content filtering, and pervasive digital surveillance. This has led to claims that Gen Z exhibits higher digital literacy but lower trust in institutions and media than millennials do.",
      "However, this theory faces objections. For instance, the assumption that technological immersion leads to skepticism may overlook other factors, such as economic precarity or political polarization, which also influence trust. Moreover, while some studies suggest that Gen Z is more pragmatic and financially cautious than millennials are, this could be attributed not to generational identity but to life-stage effects--young adults often exhibit similar traits regardless of cohort.",
      "Other scholars believe that generational differences are overstated and that intragenerational diversity (e.g., socioeconomic class, race, or geography) is more significant than intergenerational contrasts. Thus, while the Gen Z vs. millennials dichotomy is useful as a cultural shorthand, its explanatory power may be limited."
    ]
  }
];

const readingChoices = [
  ["reading-m1-q21", "How much did the customer spend overall?", ["$299.00", "$49.00", "$379.48", "$21.48"], "c", "toefl.daily_life_choice", "reading-m1-q21-stimulus"],
  ["reading-m1-q22", "What can be concluded about Dunlap's?", ["It provides phone repair services.", "It is an electronics store.", "It mainly sells music equipment.", "It is closed on weekends."], "b", "toefl.daily_life_choice", "reading-m1-q21-stimulus"],
  ["reading-m1-q23", "What event is being promoted in the post?", ["A technology competition", "A technology workshop", "A technology webinar", "A technology lecture series"], "b", "toefl.daily_life_choice", "reading-m1-q23-stimulus"],
  ["reading-m1-q24", "What is suggested about the event?", ["It is free of charge.", "It includes follow-up sessions.", "It requires registration.", "It is for professionals only."], "c", "toefl.daily_life_choice", "reading-m1-q23-stimulus"],
  ["reading-m1-q25", "What is the notice primarily about?", ["Providing safety tips during a storm", "Announcing a disruption to a service", "Providing after-installation instructions for a new appliance", "Promoting a community water park opening"], "b", "toefl.daily_life_choice", "reading-m1-q25-stimulus"],
  ["reading-m1-q26", "What should residents do beforehand?", ["Plan for power outages", "Disconnect all water appliances", "Inspect faucets and showers for leaks", "Ensure enough water is stored for one day"], "d", "toefl.daily_life_choice", "reading-m1-q25-stimulus"],
  ["reading-m1-q27", "What can be inferred about the event described in the announcement?", ["It can be postponed to a different day by calling the maintenance department.", "It is required for infrastructure upgrades.", "It will occur weekly.", "It is due to a natural disaster."], "b", "toefl.daily_life_choice", "reading-m1-q25-stimulus"],
  ["reading-m1-q28", "What is the most expensive item?", ["A scarf", "A handbag", "A pair of sunglasses", "A t-shirt"], "b", "toefl.daily_life_choice", "reading-m1-q28-stimulus"],
  ["reading-m1-q29", "How much tax was charged?", ["€5.00", "€15", "€23", "€40.25"], "d", "toefl.daily_life_choice", "reading-m1-q28-stimulus"],
  ["reading-m1-q30", "What can be found on Trendie Boutique's social media accounts?", ["Some travel tips for Dublin, Ireland", "Additional information about returns and exchanges", "Information about special discounts", "Shopper comments and reviews"], "c", "toefl.daily_life_choice", "reading-m1-q28-stimulus"],
  ["reading-m1-q31", "What does the passage indicate about sequential algorithms?", ["They are less efficient than parallel algorithms are.", "They handle computational tasks in the same way that parallel algorithms do.", "They can solve problems that parallel algorithms cannot.", "They use more advanced hardware than parallel algorithms do."], "a", "toefl.academic_passage_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q32", "Why does the author discuss the simulation of the spread of a virus?", ["To illustrate the challenges that public health officials face during disease outbreaks", "To demonstrate the significance of parallel algorithms in healthcare", "To highlight the data points that researchers focus on when a virus spreads through a population", "To emphasize the risk of using small datasets for analysis during disease outbreaks"], "b", "toefl.academic_passage_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q33", "Identify the sentence in paragraph 2 that indicates that parallel algorithms have challenges. Select the sentence to make your choice.", ["In healthcare, parallel algorithms play a crucial role in analyzing large datasets quickly.", "When researchers simulate how a virus spreads through a population, they need to process millions of data points--like infection rates and demographics.", "Using parallel processing, these simulations can run in minutes instead of hours, helping public health officials make faster decisions during outbreaks.", "However, if too much data is sent to the processors at once without proper management, the system slows down."], "d", "toefl.academic_passage_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q34", "The word \"tailor\" in the passage is closest in meaning to", ["direct", "explore", "adapt", "prepare"], "c", "toefl.academic_passage_choice", "reading-m1-q31-stimulus"],
  ["reading-m1-q35", "Where would the sentence best fit? Sentence: In light of their many advantages, parallel algorithms will surely continue to drive innovation in diverse areas like climate modeling and financial analysis.", ["After paragraph 1", "After paragraph 2", "Before the final sentence of paragraph 3", "After the final sentence of the passage"], "d", "toefl.academic_passage_choice", "reading-m1-q31-stimulus"],
  ["reading-m2-q11", "In the first paragraph, what is the relation between sentence 2 and sentence 3?", ["Sentence 2 raises a question, and sentence 3 presents a plausible answer.", "Sentence 2 identifies a problem, and sentence 3 proposes a solution.", "Sentence 2 states a fact, and sentence 3 points to a possible consequence.", "Sentence 2 describes an empirical discovery, and sentence 3 clarifies its context."], "c", "toefl.academic_passage_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q12", "The word \"precarity\" in the passage is closest in meaning to", ["insecurity", "status", "difference", "dependence"], "a", "toefl.academic_passage_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q13", "According to the passage, what is one way Generation Z is believed to differ from the millennial generation?", ["Gen Z is more comfortable using social media.", "Gen Z is less concerned about spending money.", "Gen Z is more used to being constantly observed.", "Gen Z has lower intragenerational diversity."], "c", "toefl.academic_passage_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q14", "What does the passage suggest about the potential impact of \"technological immersion\" on Gen Z?", ["It is significant, but other factors are important as well.", "It will gradually diminish as Gen Z individuals grow older.", "It is less pronounced in Gen Z than in the millennial generation.", "It causes a lack of trust between Gen Z and earlier generations."], "a", "toefl.academic_passage_choice", "reading-m2-q11-stimulus"],
  ["reading-m2-q15", "The passage suggests which of the following about generational differences?", ["The societal impact of technology on generational cohorts may be difficult to measure precisely.", "Differences between Gen Z and millennials may be exaggerated.", "Gen Z and millennials themselves do not accept the dichotomy between their generations.", "Research is needed to explain why the belief in generational differences is so persistent."], "b", "toefl.academic_passage_choice", "reading-m2-q11-stimulus"]
];

const mainListening = [
  ["I believe it's next week.", "Yes, I have time.", "No, they aren't coming over.", "They're north of the Admissions Office."],
  ["Later on this afternoon.", "The study room is booked.", "No, check with Oscar first.", "Yes, I left them on his desk."],
  ["The daycare on campus is wonderful.", "A lot of folks attended virtually.", "It gave me a few ideas I hadn't considered before.", "A recording should be available by the end of the week."],
  ["There should be a link in the email.", "There are many computer engineering classes.", "You have ten days to cancel and get a refund.", "Late job applications may not be considered."],
  ["Yes, I was the featured speaker.", "My biology class started at three p.m.", "My high school commencement.", "I thought it started earlier."],
  ["Yesterday.", "No, she searched for the answer online.", "Do I need to register for it?", "My biology professor."],
  ["No, I already bought it.", "On the west campus.", "My cupboards are empty.", "Whenever you want to leave."],
  ["It was a very informative session.", "It'll start promptly at noon.", "She was late for class.", "Yes, I'm on the student business council."],
  ["It's close to my university.", "Yes, that's true.", "See you there.", "Who is your neighbor?"],
  ["We practice all the time there.", "Does that store have good sales?", "No, a new boat.", "I just learned how to make paper airplanes."],
  ["I need to work over the weekend.", "It comes with a side of fries.", "They moved it off campus.", "I really enjoy cooking."],
  ["I would love to study there.", "It's a great place to get everything.", "That book has been really popular.", "I recommend online courses."],
  ["Enthusiastic", "Impressed", "Indifferent", "Dissatisfied"],
  ["Bring the woman some sushi", "Tell the woman about his lunch experience", "Find a restaurant with good service", "Make a reservation at the sushi restaurant"],
  ["The man wanted to read it himself.", "The woman had a question about its content.", "The woman wanted to buy a copy for herself.", "The man wanted the woman to return it."],
  ["Start an herb garden", "Write a book of her own", "Help the man with his garden", "Seek gardening advice online"],
  ["She no longer wants to visit an attraction.", "She has been unable to connect to a website.", "She wanted more information about prices.", "She was waiting for further instructions from the man."],
  ["Purchase tickets", "Check her calendar", "Contact her classmates", "Call the sculpture garden"],
  ["To describe a recent observation", "To remind students of proper practices", "To inform about newly posted information", "To explain a change in dormitory policy"],
  ["They can provide cardboard boxes upon request.", "They have noticed waste being disposed of improperly.", "They recently created lists of non-recyclable items.", "They will help residents sort their recycling."],
  ["Submit a research paper", "Give a group presentation", "Attend a seminar", "Prepare an outline"],
  ["Students have many projects due at this time of the year.", "Students should schedule more time for entertainment.", "He is sorry he assigned so much work.", "Some assignments are now optional."],
  ["To advertise new technology", "To provide instructions", "To support innovation", "To inform about a schedule change"],
  ["To read about some technology", "To share their homemade art", "To find out who this year's winners are", "To see examples of great essays"],
  ["By introducing his favorite music genre", "By pointing out an advantage of hearing local music live", "By describing possible reactions to listening to certain kinds of music", "By encouraging students to visit places where famous styles of music originated"],
  ["To emphasize the importance of rhythmic pulse in music", "To provide an example of a style that mixes musical styles from different places", "To identify a style that influenced jazz music", "To explain the popularity of Brazilian music"],
  ["It reflects the composer's own emotional experience.", "It is more popular among Western audiences than among Chinese audiences.", "It was inspired by a Chinese novel.", "It shows a deep understanding of Chinese culture."],
  ["The difficulty of combining different types of music well", "The high cost of using traditional instruments", "The limited interest from international audiences", "The lack of available resources for composers"],
  ["Interesting facts about sea otters and other marine mammals", "The importance of preserving kelp forests", "Sea otters and their ecological role", "Sea otter adaptations to their habitat"],
  ["Their appetite for kelp", "Their ability to breathe under water", "Their protective blubber", "Their use of tools"],
  ["They keep kelp forests healthy by preying on sea urchins.", "They remove clams and other invasive shellfish from shorelines.", "They are food for predators such as whales and seals.", "They build shelters that act as a buffer against storm damage."],
  ["They expand shorelines by trapping sediment and building new land.", "They provide habitat for a great diversity of marine life.", "They clean seawater to make it drinkable or suitable for agriculture.", "They help control the population of sea urchins and other pests."]
];

const mainListeningPrompts = [
  ...Array(12).fill("Choose the best response."),
  "How does the woman feel about the service at the restaurant?",
  "What does the man say he will do?",
  "Why were the speakers talking about the gardening book?",
  "What has the book inspired the woman to do?",
  "Why has the woman not bought tickets yet?",
  "What will the woman most likely do next?",
  "What is the main purpose of the announcement?",
  "What does the speaker imply about the custodial staff?",
  "What should students do by next Friday?",
  "What does the speaker imply when he mentions reducing stress?",
  "What is the main purpose of the announcement?",
  "Why are students invited to go to the university website?",
  "How does the speaker begin the lecture?",
  "Why does the speaker mention bossa nova?",
  "What does the speaker emphasize about the music of Tan Dun?",
  "According to the talk, what is one challenge of musical borrowing?",
  "What is the main topic of the talk?",
  "What characteristic distinguishes sea otters from most other animals?",
  "What function do sea otters perform in their marine ecosystem?",
  "According to the speaker, what is one benefit that kelp forests provide?"
];

const mainListeningAnswers = [
  "a", "a", "c", "a", "d", "c", "b", "b", "a", "a", "c", "d", "d", "b", "d", "a",
  "c", "c", "d", "b", "a", "a", "b", "d", "c", "b", "d", "a", "c", "d", "a", "b"
];

const extraListening = [
  ["At the music building.", "I think she will like it.", "Later this afternoon.", "It's expensive."],
  ["The show was great.", "Thanks, we've already been shopping.", "No, we've already eaten.", "I'll be on time."],
  ["I go twice a month!", "They often do.", "A new venue!", "Whenever they want to."],
  ["He invited her to a student photography workshop.", "She saw him taking a picture of a duck with its chicks.", "They met at a meeting of the college photography club.", "She noticed a photo he'd published in a magazine."],
  ["Find out how to join the photography club", "Show the woman a photograph of a duck with her chicks", "Tell the woman about another student club", "Post his photograph online"],
  ["She was not able to buy tickets quickly.", "She was not able to take photographs.", "She got lost on the way to a museum.", "She did not know a museum's operating hours."],
  ["Buy tickets online", "Visit in the early morning", "Take many photos", "Focus only on some parts of the museum"],
  ["To describe the events that led to pottery being invented", "To highlight technological advancements in pottery", "To highlight the cultural significance of pottery", "To compare pottery styles from different ancient regions"],
  ["It allowed potters to decorate pots more easily.", "It made pottery lighter and more portable.", "It helped potters to control the shape of the pots better.", "It reduced the need for firing pottery."],
  ["It was easier to build than other types of kilns.", "It allowed potters to control the final appearance of pottery.", "It was primarily used for making porcelain.", "It was difficult to maintain consistent temperatures when using it."],
  ["The clay is painted before being placed in a kiln.", "It requires very high temperatures.", "The clay is shaped without using a potter's wheel.", "It has to be handled with care as it is very fragile."],
  ["How it impacts society at large", "How it is represented through characters in novels", "How it impacts readers' perceptions of a work", "Why it appears so frequently throughout different works"],
  ["He finds solace only in nature.", "He is considered a tragic figure in literature.", "He is an outcast because of his appearance.", "He is a common subject in studies of isolation in literature."],
  ["To illustrate how isolation can have tragic consequences in literature", "To contrast different literary perspectives on isolation", "To explain why authors may choose isolation as a theme", "To provide an example of isolation presented through a character's thoughts"],
  ["Jane does not recognize that she has been isolated.", "Jane manages to make friends at boarding school.", "Jane has chosen to isolate herself.", "Jane uses isolation to her advantage."]
];

const extraListeningPrompts = [
  "Choose the best response.",
  "Choose the best response.",
  "Choose the best response.",
  "How does the woman know the man enjoys photography?",
  "What will the man probably do next?",
  "Why was the woman frustrated?",
  "What advice does the woman give the man about visiting a museum?",
  "What is the main purpose of the talk?",
  "What benefit of the potter's wheel is mentioned?",
  "What does the speaker imply about the updraft kiln?",
  "How is making porcelain different from making other types of pottery?",
  "What aspect of isolation in literature does the speaker mainly discuss?",
  "What does the speaker say about the creature in Frankenstein?",
  "Why does the speaker mention Moby Dick?",
  "What does the speaker suggest about the character Jane Eyre?"
];

const extraListeningAnswers = ["a", "d", "a", "d", "a", "a", "d", "b", "c", "b", "b", "b", "c", "a", "d"];

const writingTasks = {
  "writing-q11": {
    title: "Issues with group project",
    materialType: "email",
    prompt: "Write an email to Dr. Smith.",
    context: "Your professor, Dr. Smith, recently assigned a group project due in two weeks. You are frustrated because not all of your group members are contributing equally to the project.",
    rubricId: "toefl.writing_email.v1",
    sourceMaterial: [
      { type: "paragraph", role: "context", text: "Your professor, Dr. Smith, recently assigned a group project due in two weeks. You are frustrated because not all of your group members are contributing equally to the project." },
      { type: "paragraph", role: "instruction", weight: "bold", text: "Write an email to Dr. Smith. In your email, do the following:" },
      { type: "list_item", role: "bullet", text: "Describe the issue you are facing with your group members." },
      { type: "list_item", role: "bullet", text: "Describe your specific contribution to the project." },
      { type: "list_item", role: "bullet", text: "Explain why you and the group have been unable to address this issue." },
      { type: "paragraph", role: "instruction", text: "Write as much as you can and in complete sentences." },
      { type: "paragraph", role: "email_header", text: "To: Dr. Smith" },
      { type: "paragraph", role: "email_header", text: "Subject: Issues with group project" }
    ]
  },
  "writing-q12": {
    title: "Academic Discussion",
    materialType: "academic_discussion",
    prompt: "What is your perspective on the impact of cultural globalization on local traditions?",
    context: "Your professor is teaching a class on anthropology. Write a post responding to the professor's question.",
    rubricId: "toefl.academic_discussion.v1",
    sourceMaterial: [
      { type: "paragraph", role: "context", text: "Your professor is teaching a class on anthropology. Write a post responding to the professor's question." },
      { type: "paragraph", role: "instruction", weight: "bold", text: "In your response, you should do the following." },
      { type: "list_item", role: "bullet", text: "Express and support your opinion." },
      { type: "list_item", role: "bullet", text: "Make a contribution to the discussion in your own words." },
      { type: "paragraph", role: "instruction", text: "An effective response will contain at least 100 words." },
      { type: "paragraph", role: "speaker", speaker: "Dr. Gupta", text: "We've been discussing the impact of cultural globalization on local traditions. Some anthropologists argue that cultural globalization leads to the loss of unique and diverse cultural identities, while others believe it promotes cultural exchange and understanding. What is your perspective on the impact of cultural globalization on local traditions?" },
      { type: "paragraph", role: "student", speaker: "Kelly", text: "I believe cultural globalization can lead to the loss of unique cultural identities. As global culture becomes more dominant, traditional practices and languages can be forgotten or replaced. It's important to preserve and celebrate local cultures to maintain diversity." },
      { type: "paragraph", role: "student", speaker: "Andrew", text: "In my opinion, cultural globalization promotes cultural exchange and understanding. It allows people to learn about and appreciate different cultures. This exchange can enrich local traditions and create a more interconnected and tolerant world." }
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
    const existing = stimuli.find((item) => item.id === from);
    if (source && existing) Object.assign(existing, { ...source, id: from });
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
      completeGroups: completeGroups.map(({ stimulusId, text, questions }) => ({ stimulusId, text, questions })),
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
