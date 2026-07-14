import path from "node:path";
import { ensureGeneratedDir, readJson, walkFiles, writeJson } from "./utils.mjs";

export async function renderPdfStage(testId) {
  const { folder, generatedDir } = await ensureGeneratedDir(testId);
  const files = await walkFiles(folder);
  const pdfs = files.filter((file) => path.extname(file).toLowerCase() === ".pdf");
  const assets = (await readJson(path.join(generatedDir, "assets.json"), [])).filter((asset) => asset.type !== "question_pdf" && asset.type !== "answer_pdf");
  const nextAssets = [
    ...assets,
    ...pdfs.map((file, index) => ({
      id: `pdf-${index + 1}`,
      type: file.toLowerCase().includes("answer") || file.includes("答案") ? "answer_pdf" : "question_pdf",
      file,
      title: path.basename(file),
      order: index + 1
    }))
  ];
  await writeJson(path.join(generatedDir, "assets.json"), nextAssets);
  return { pdfFiles: pdfs.length, pagesRendered: 0, note: "PDF page rendering is staged; no page images were generated automatically." };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const testId = process.argv[2];
  if (!testId) throw new Error("Usage: node render-pdf.mjs <testId>");
  console.log(await renderPdfStage(testId));
}
