import { NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/lib/constants";
import { authAdapter } from "@/lib/server/auth-adapter";
import { readDevDatabase, updateDevDatabase } from "@/lib/server/dev-database";

const allowedKeys = new Set<string>(Object.values(STORAGE_KEYS));

function cleanStorage(input: unknown) {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowedKeys.has(key)));
}

export async function GET() {
  const user = await authAdapter.getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const db = await readDevDatabase();
  const snapshot = db.accountData.find((item) => item.userId === user.id) || { userId: user.id, updatedAt: "", storage: {} };
  return NextResponse.json({ snapshot });
}

export async function PUT(request: Request) {
  const user = await authAdapter.getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const storage = cleanStorage((body as { storage?: unknown }).storage);
  const snapshot = await updateDevDatabase((db) => {
    const next = { userId: user.id, updatedAt: new Date().toISOString(), storage };
    const index = db.accountData.findIndex((item) => item.userId === user.id);
    if (index >= 0) db.accountData[index] = next;
    else db.accountData.push(next);
    return next;
  });
  return NextResponse.json({ snapshot });
}

export async function DELETE() {
  const user = await authAdapter.getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  await updateDevDatabase((db) => {
    db.accountData = db.accountData.filter((item) => item.userId !== user.id);
  });
  return NextResponse.json({ ok: true });
}
