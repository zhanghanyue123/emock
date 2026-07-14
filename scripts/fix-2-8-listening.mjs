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

function updateListeningQuestion(question, spec, answerKey) {
  const opts = options(question.id, spec.options);
  question.rendererId = "toefl.listening_choice";
  question.scoringStrategyId = "toefl.exact_single_choice";
  question.prompt = { type: "plain_text", text: spec.prompt };
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

function syncTest(test, questions) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  for (const section of test.sections || []) {
    for (const examModule of section.modules || []) {
      for (const item of examModule.questions || []) {
        const question = byId.get(item.id);
        if (!question) continue;
        item.prompt = question.prompt?.text || item.prompt;
        item.needsReview = Boolean(question.needsReview);
        item.confidence = question.confidence;
        item.options = question.config?.options || item.options || [];
        item.correctOptionId = question.config?.correctOptionId || item.correctOptionId;
        item.displayMode = question.config?.displayMode || item.displayMode;
      }
    }
  }
}

const chooseBest = "Choose the best response.";

const specs = [
  ["listening-q1", chooseBest, "a", ["It was due yesterday.", "My partner is due to be here soon.", "The teaching assistant grades the projects.", "I finished editing mine."]],
  ["listening-q2", chooseBest, "c", ["I can provide support.", "The sooner the better.", "I can as soon as I finish it.", "Please grant them access."]],
  ["listening-q3", chooseBest, "a", ["There's a good Thai restaurant near campus.", "I had to eat my lunch during class.", "I haven't eaten there.", "I had leftovers for dinner yesterday."]],
  ["listening-q4", chooseBest, "d", ["It's on modern technology.", "Because students requested it.", "It's part of the lecture series.", "A visiting researcher."]],
  ["listening-q5", chooseBest, "a", ["That's great for studying.", "No, I've not read that one.", "I had to change my school password yesterday.", "Do you have overdue books too?"]],
  ["listening-q6", chooseBest, "c", ["I left my yoga mat in the car.", "I downloaded a fitness app.", "I look forward to going to all of the classes now.", "They make delicious health shakes at the gym cafe."]],
  ["listening-q7", chooseBest, "d", ["The construction is loud.", "I set my alarm for 8 a.m.", "I heard the announcement.", "I don't have a favorite."]],
  ["listening-q8", chooseBest, "d", ["Yes, the seminary is nearby.", "Sure, let's cook tomorrow.", "The seminar was all weekend.", "Yes, it was very helpful."]],
  ["listening-q9", chooseBest, "a", ["Oh, I didn't know that.", "I saw a rainbow today.", "It is an ancient remedy.", "No, the train gets in late at night."]],
  ["listening-q10", chooseBest, "d", ["He's the tall one in the corner.", "The university archive is located in the main library.", "I think the library is closed tomorrow.", "It's right there next to the post office."]],
  ["listening-q11", chooseBest, "a", ["Several times every season.", "Sometimes it is very tiring.", "Yes, I prefer studying from home.", "The airport is busy in the mornings."]],
  ["listening-q12", chooseBest, "a", ["We wouldn't mind going.", "Presentations are informative.", "There will be multiple attendees.", "I totally agree."]],
  ["listening-q13", "Why is the man upset?", "b", ["His opinion was ignored.", "His favorite restaurant closed.", "He missed an important notice.", "The woman ordered lunch without him."]],
  ["listening-q14", "What does the woman suggest about the sushi restaurant?", "c", ["It needed to hire more staff.", "Its food was bad for her health.", "It did not make enough money.", "It closed a few days each month."]],
  ["listening-q15", "What are the speakers mainly discussing?", "b", ["Their early class schedules", "A new local gym", "A walking tour of the neighborhood", "Going to a resort spa"]],
  ["listening-q16", "Why won't Sarah take the yoga class?", "c", ["She doesn't want to get up at 6 a.m.", "It is too expensive.", "The timing conflicts with her work schedule.", "She prefers other activities to yoga."]],
  ["listening-q17", "What has Linda been doing with her paintings?", "a", ["Using new colors", "Working more slowly", "Painting different subjects", "Using old frames"]],
  ["listening-q18", "What will the man most likely do next month?", "d", ["Buy one of Linda's paintings", "Take art classes", "Showcase his own paintings", "Go to Linda's exhibit"]],
  ["listening-q19", "What does the speaker imply about last year's event?", "d", ["The speeches ran much longer than expected.", "Multiple speakers did not show up.", "Several attendees were inappropriately dressed.", "Noise from phones caused frequent disruptions."]],
  ["listening-q20", "What does the speaker say about tickets for the event?", "c", ["They are only available digitally.", "They are no longer on sale.", "They can be obtained from the box office.", "They include a copy of the dress code."]],
  ["listening-q21", "What is being announced?", "d", ["A new project for a class", "The opening of a new computer lab", "Some policy changes", "Improvements in available software"]],
  ["listening-q22", "Why does the speaker mention possible effects of climate policy decisions?", "c", ["To explain why good communication is needed for a policy to be successful", "To warn against making policy decisions too quickly", "To provide an example of a complex idea that can be visually illustrated", "To identify a problem with the global economic system"]],
  ["listening-q23", "What does the speaker indicate about the previous bin labels?", "c", ["They were created by students.", "They were missing.", "They were confusing.", "They were made from recycled materials."]],
  ["listening-q24", "Why does the speaker refer to \"every floor in each dormitory\"?", "c", ["To highlight the number of students participating in the recycling program", "To point out where students can find some instructions", "To identify a possible problem", "To explain the importance of having easily available recycling bins"]],
  ["listening-q25", "What is the main topic of the talk?", "c", ["Interesting facts about sea otters and other marine mammals", "The importance of preserving kelp forests", "Sea otters and their ecological role", "Sea otter adaptations to their habitat"]],
  ["listening-q26", "What characteristic distinguishes sea otters from most other animals?", "d", ["Their appetite for kelp", "Their ability to breathe under water", "Their protective blubber", "Their use of tools"]],
  ["listening-q27", "What function do sea otters perform in their marine ecosystem?", "a", ["They keep kelp forests healthy by preying on sea urchins.", "They remove clams and other invasive shellfish from shorelines.", "They are food for predators such as whales and seals.", "They build shelters that act as a buffer against storm damage."]],
  ["listening-q28", "According to the speaker, what is one benefit that kelp forests provide?", "b", ["They expand shorelines by trapping sediment and building new land.", "They provide habitat for a great diversity of marine life.", "They clean seawater to make it drinkable or suitable for agriculture.", "They help control the population of sea urchins and other pests."]],
  ["listening-q29", "What is the main topic of the talk?", "c", ["How mythology has shaped cultural traditions", "Joseph Campbell's influence on storytelling techniques", "The structure and significance of the hero's journey", "Criticism of modern storytelling practices"]],
  ["listening-q30", "What point does the speaker make about Joseph Campbell?", "d", ["He invented the hero's journey as a new storytelling model.", "He examined why readers are drawn to heroic actions in stories.", "He was best known for writing fiction based on ancient stories.", "He found that stories from different cultures share a similar pattern."]],
  ["listening-q31", "Why does the speaker mention a gift?", "b", ["To show appreciation for storytellers' creative talents", "To point out what makes the hero's journey meaningful", "To describe what the hero receives from a mentor", "To highlight the hero's motivation for starting the journey"]],
  ["listening-q32", "What is the speaker's opinion about the hero's journey in storytelling?", "c", ["It is outdated and no longer relevant.", "It limits creativity by focusing only on action and adventure.", "It is influential because it reflects shared human experiences.", "It has become more popular due to its use in film and media."]],
  ["listening-m2-q1", chooseBest, "a", ["It could have been a little more fun.", "It was held in the student lounge.", "Please complete the feedback form.", "I find it difficult to wait."]],
  ["listening-m2-q2", chooseBest, "c", ["I think it's too big to move.", "I think it's still on the table.", "If only I had the time.", "I've never been there."]],
  ["listening-m2-q3", chooseBest, "b", ["I have three assignments in my queue now.", "It's always due at the end of the week.", "Yes, it was assigned yesterday.", "There's no fee for overdue books."]],
  ["listening-m2-q4", "What was the problem with the woman's computer?", "b", ["A hard drive was corrupted.", "A virus caused some damage.", "A battery would not charge.", "A program was slowing down the system."]],
  ["listening-m2-q5", "What does the woman regret?", "b", ["Losing some passwords", "Not backing up some files", "Spending too much money on repairs", "Not making a repair sooner"]],
  ["listening-m2-q6", "What does the man encourage the woman to do?", "a", ["Enter a contest", "Take an art class", "Speak with a judge", "Go to see a mural"]],
  ["listening-m2-q7", "Why does the man mention the Newspaper Club and Student Council?", "b", ["To identify where he heard about some upcoming events", "To explain why he is unavailable", "To encourage the woman to join new activities", "To point out why he would be a strong candidate"]],
  ["listening-m2-q8", "What is the main topic of the talk?", "d", ["The benefits of achieving flow", "The role of feedback in flow", "The challenges of finding flow-inducing activities", "The concept and characteristics of flow"]],
  ["listening-m2-q9", "Why does the speaker mention athletes and artists?", "d", ["To explain the role of feedback in achieving flow", "To suggest that not everyone can achieve flow", "To highlight the connection of flow to success", "To provide examples of individuals who often experience flow"]],
  ["listening-m2-q10", "What does the speaker say about people who regularly experience flow?", "c", ["They often work in jobs that include easy tasks.", "They enjoy a variety of activities.", "They are often happier and more fulfilled.", "They earn more money than people who do not experience flow."]],
  ["listening-m2-q11", "What does the speaker say is a challenge to achieving flow?", "b", ["Finding individuals to provide feedback", "Identifying activities that are a proper match with skill level", "Avoiding boredom when a task becomes too easy", "Working on multiple things at the same time"]],
  ["listening-m2-q12", "What is the main focus of the talk?", "b", ["How parks benefit city residents", "Ways to overcome the difficulties of creating urban green spaces", "The problems caused by pollution in cities", "The history of using green spaces in urban planning"]],
  ["listening-m2-q13", "Why does the speaker mention parking lots?", "c", ["To help explain why land is expensive in cities", "To encourage parking solutions that save space", "To provide an example of an area that can be repurposed", "To support reducing the number of cars in cities"]],
  ["listening-m2-q14", "According to the talk, how are green roofs and vertical gardens similar?", "b", ["They provide recreational areas for city residents.", "They do not need additional land to be built.", "They divert rainwater for later use.", "They are both inexpensive to create and maintain."]],
  ["listening-m2-q15", "What opinion does the speaker express about green space quotas?", "b", ["They are not effective because they are hard to enforce.", "They are necessary to ensure development of green space is not neglected.", "They are important because they attract new residents to cities.", "They are not practical because they raise the cost of new development."]]
].map(([id, prompt, answer, optionValues]) => ({ id, prompt, answer, options: optionValues }));

const questions = await readJson("questions.json");
const answerKey = await readJson("answer-key.json");
const test = await readJson("test.json");
const exam = await readJson("exam.json");

for (const spec of specs) {
  const question = questions.find((item) => item.id === spec.id);
  if (!question) throw new Error(`Missing ${spec.id}`);
  updateListeningQuestion(question, spec, answerKey);
}

syncTest(test, questions);
exam.config = {
  ...(exam.config || {}),
  publicationStatus: "ready",
  humanVerificationStatus: "reading_writing_listening_verified",
  verifiedContentSource: "verified-content.json",
  formatProfile: "toefl-2026-3.2b-final"
};
exam.status = "published";

await writeJson("questions.json", questions);
await writeJson("answer-key.json", answerKey);
await writeJson("test.json", test);
await writeJson("exam.json", exam);

const verifiedPath = path.join(PACK, "verified-content.json");
let verified = {};
try {
  verified = JSON.parse(await readFile(verifiedPath, "utf8"));
} catch {
  verified = {};
}
verified.listeningStatus = "options_prompts_answers_verified";
verified.listeningQuestionCount = specs.length;
verified.listeningVerificationSource = "2.8新托福真题听力.docx and 2.8新托福真题答案.docx";
await writeFile(verifiedPath, `${JSON.stringify(verified, null, 2)}\n`);

console.log(JSON.stringify({ listeningQuestions: specs.length }, null, 2));
