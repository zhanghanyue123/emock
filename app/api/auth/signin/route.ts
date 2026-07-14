import { NextResponse } from "next/server";
import { authAdapter } from "@/lib/server/auth-adapter";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await authAdapter.signIn({ email: String(body.email || "") });
    return NextResponse.json({ user: result.user });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sign in failed." }, { status: 400 });
  }
}
