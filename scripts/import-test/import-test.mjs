import { parseArgs } from "./utils.mjs";
import { renderPdfStage } from "./render-pdf.mjs";
import { extractPdfTextStage } from "./extract-pdf-text.mjs";
import { classifyPagesStage } from "./classify-pages.mjs";
import { parseQuestionsStage } from "./parse-questions.mjs";
import { matchAudioStage } from "./match-audio.mjs";
import { importAnswerKeyStage } from "./import-answer-key.mjs";
import { generateImportReportStage } from "./generate-import-report.mjs";
import { validateGeneratedTest } from "./validate-generated-test.mjs";

const args = parseArgs(process.argv.slice(2));
const testId = args.test || process.argv[2];

if (!testId) {
  console.error("Usage: npm run import-test -- --test <testId>");
  process.exit(1);
}

const renderResult = await renderPdfStage(testId);
const textResult = await extractPdfTextStage(testId);
await classifyPagesStage(testId);
await parseQuestionsStage(testId);
const audioResult = await matchAudioStage(testId);
const answerResult = await importAnswerKeyStage(testId);
const report = await generateImportReportStage(testId, { ...renderResult, ...textResult, ...audioResult, ...answerResult });
const validation = await validateGeneratedTest(testId);

console.log(JSON.stringify({ report, validation }, null, 2));
