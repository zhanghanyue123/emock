import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentDirs } from "@/lib/content-source";
import { publicAssetPath } from "@/lib/assets";

type AuditSection = "reading" | "listening" | "writing";

interface AuditRow {
  questionId: string;
  moduleId?: string;
  number: number;
  sourceQuestionNumber?: number;
  rendererId: string;
  questionType: string;
  readiness?: string;
  needsReview: boolean;
  prompt: string;
  optionCount: number;
  answer?: string;
  stimulusId?: string;
  imageAssetId?: string;
  questionImageAssetId?: string;
  audioGroupId?: string;
  status: "ready" | "needs_review";
  errors: string[];
  warnings: string[];
}

interface IntegrityReport {
  examId: string;
  title: string;
  publishable: boolean;
  reading: { rows: AuditRow[]; needsReview: number; totalQuestions: number };
  listening: { rows: AuditRow[]; needsReview: number; totalQuestions: number };
  writing: { rows: AuditRow[]; needsReview: number; totalQuestions: number };
}

interface AssetRecord {
  id: string;
  type: string;
  relativePath?: string;
  file?: string;
  fileName?: string;
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function findGeneratedDir(examId: string) {
  for (const contentDir of await getContentDirs()) {
    const entries = await readdir(contentDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const generatedDir = path.join(contentDir, entry.name, "generated");
      const report = await readJson<IntegrityReport>(path.join(generatedDir, "content-integrity-report.json"));
      if (report?.examId === examId) return generatedDir;
    }
  }
  return null;
}

function statusClass(status: string) {
  return status === "ready"
    ? "border-green-200 bg-green-50 text-green-800"
    : "border-amber-200 bg-amber-50 text-amber-900";
}

function sourceAssetId(row: AuditRow) {
  return row.questionImageAssetId || row.imageAssetId;
}

export async function AuditSectionPage({ examId, section, mismatchIndex = 0 }: { examId: string; section: AuditSection; mismatchIndex?: number }) {
  const generatedDir = await findGeneratedDir(examId);
  if (!generatedDir) notFound();
  const report = await readJson<IntegrityReport>(path.join(generatedDir, "content-integrity-report.json"));
  if (!report) notFound();
  const assets = (await readJson<AssetRecord[]>(path.join(generatedDir, "assets.json"))) || [];
  const rows = report[section].rows;
  const mismatches = rows.filter((row) => row.status !== "ready" || row.errors.length || row.warnings.length);
  const selectedMismatch = mismatches[Math.max(0, Math.min(mismatchIndex, mismatches.length - 1))];
  const selectedIndex = selectedMismatch ? rows.findIndex((row) => row.questionId === selectedMismatch.questionId) : -1;
  const selectedRow = selectedMismatch || rows[0];
  const asset = assets.find((item) => item.id === sourceAssetId(selectedRow));
  const assetFile = asset?.relativePath || asset?.file;
  const assetSrc = assetFile ? publicAssetPath(examId, assetFile) : null;
  const basePath = `/dev/exams/${examId}/${section}-audit`;
  const prevMismatch = Math.max(0, mismatchIndex - 1);
  const nextMismatch = Math.min(Math.max(0, mismatches.length - 1), mismatchIndex + 1);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted">{report.examId}</p>
          <h1 className="text-2xl font-semibold">{report.title} · {section[0].toUpperCase() + section.slice(1)} Audit</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} questions · {mismatches.length} need review · {report.publishable ? "publishable" : "hidden until fixed"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-md border border-line px-3 py-2" href={`/dev/exams/${examId}/reading-audit`}>Reading</Link>
          <Link className="rounded-md border border-line px-3 py-2" href={`/dev/exams/${examId}/listening-audit`}>Listening</Link>
          <Link className="rounded-md border border-line px-3 py-2" href={`/dev/exams/${examId}/writing-audit`}>Writing</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="max-h-[calc(100vh-170px)] overflow-auto rounded-lg border border-line bg-white dark:border-slate-700 dark:bg-slate-900">
          {rows.map((row, index) => (
            <Link
              key={row.questionId}
              href={`${basePath}?mismatch=${Math.max(0, mismatches.findIndex((item) => item.questionId === row.questionId))}`}
              className={`block border-b border-line p-3 text-sm dark:border-slate-700 ${index === selectedIndex ? "bg-blue-50 dark:bg-slate-800" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Q{row.number} · {row.questionId}</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-muted">{row.prompt || "Missing prompt"}</p>
              {row.errors.length ? <p className="mt-1 text-xs text-amber-700">{row.errors.join(", ")}</p> : null}
            </Link>
          ))}
        </aside>

        <section className="rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase text-muted">Question {selectedRow?.number}</p>
              <h2 className="mt-1 text-xl font-semibold">{selectedRow?.prompt || "Missing prompt"}</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link className="rounded-md border border-line px-3 py-2" href={`${basePath}?mismatch=${prevMismatch}`}>Previous mismatch</Link>
              <Link className="rounded-md border border-line px-3 py-2" href={`${basePath}?mismatch=${nextMismatch}`}>Next mismatch</Link>
              <button className="rounded-md border border-line px-3 py-2 text-muted" disabled>Confirm</button>
              <button className="rounded-md border border-line px-3 py-2 text-muted" disabled>Mark needsReview</button>
              <button className="rounded-md border border-line px-3 py-2 text-muted" disabled>Edit mapping</button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-line p-3 dark:border-slate-700">
              <h3 className="font-medium">Source image</h3>
              {assetSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetSrc} alt="Source preview" className="mt-3 max-h-[520px] w-full object-contain object-top" />
              ) : (
                <p className="mt-3 text-sm text-muted">No source image linked.</p>
              )}
            </div>
            <div className="rounded-md border border-line p-3 dark:border-slate-700">
              <h3 className="font-medium">Structured data</h3>
              <dl className="mt-3 grid gap-2 text-sm">
                <div><dt className="text-muted">Question ID</dt><dd>{selectedRow?.questionId}</dd></div>
                <div><dt className="text-muted">UI / Source number</dt><dd>{selectedRow?.number} / {selectedRow?.sourceQuestionNumber ?? "unknown"}</dd></div>
                <div><dt className="text-muted">Renderer</dt><dd>{selectedRow?.rendererId}</dd></div>
                <div><dt className="text-muted">Stimulus</dt><dd>{selectedRow?.stimulusId || "missing"}</dd></div>
                <div><dt className="text-muted">Options</dt><dd>{selectedRow?.optionCount}</dd></div>
                <div><dt className="text-muted">Answer</dt><dd>{selectedRow?.answer || "missing"}</dd></div>
                <div><dt className="text-muted">Audio segment</dt><dd>{selectedRow?.audioGroupId || "none"}</dd></div>
              </dl>
              {selectedRow?.errors.length ? (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <strong>Errors</strong>
                  <p className="mt-1">{selectedRow.errors.join(", ")}</p>
                </div>
              ) : null}
              {selectedRow?.warnings.length ? (
                <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <strong>Warnings</strong>
                  <p className="mt-1">{selectedRow.warnings.join(", ")}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
