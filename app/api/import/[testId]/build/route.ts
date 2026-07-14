import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { findSourceFolderByExamId } from "@/lib/server/source-folder";

const execFileAsync = promisify(execFile);

export async function POST(_request: Request, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const source = await findSourceFolderByExamId(testId);
  if (!source) return NextResponse.json({ error: "Source folder not found." }, { status: 404 });
  try {
    const body = await _request.json().catch(() => ({}));
    const args = ["scripts/build-exam.mjs", "--source", source];
    if (body.section) args.push("--section", String(body.section));
    const { stdout } = await execFileAsync(process.execPath, args, {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024
    });
    return NextResponse.json({ source, report: JSON.parse(stdout) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Build failed." }, { status: 500 });
  }
}
