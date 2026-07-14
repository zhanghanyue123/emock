import { NextResponse } from "next/server";
import { authAdapter } from "@/lib/server/auth-adapter";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await authAdapter.signUp({ email: String(body.email || ""), displayName: body.displayName ? String(body.displayName) : undefined });
    return NextResponse.json({ user: result.user });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sign up failed." }, { status: 400 });
  }
}
