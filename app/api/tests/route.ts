import { NextResponse } from "next/server";
import { LocalContentRepository } from "@/lib/repositories/content-repository";

export async function GET() {
  const tests = await new LocalContentRepository().getAllTests();
  return NextResponse.json({ tests });
}
