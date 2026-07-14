import { NextResponse } from "next/server";
import { authAdapter } from "@/lib/server/auth-adapter";

export async function POST() {
  await authAdapter.signOut();
  return NextResponse.json({ ok: true });
}
