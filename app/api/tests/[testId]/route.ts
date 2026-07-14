import { NextResponse } from "next/server";
import { LocalContentRepository } from "@/lib/repositories/content-repository";

export async function GET(_request: Request, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const test = await new LocalContentRepository().getTestById(testId);
  if (!test) return NextResponse.json({ error: "Test not found or manifest is invalid." }, { status: 404 });
  return NextResponse.json({ test });
}
