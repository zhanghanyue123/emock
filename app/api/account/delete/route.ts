import { NextResponse } from "next/server";
import { authAdapter, AUTH_COOKIE } from "@/lib/server/auth-adapter";
import { updateDevDatabase } from "@/lib/server/dev-database";
import { cookies } from "next/headers";

export async function POST() {
  const user = await authAdapter.getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  await updateDevDatabase((db) => {
    db.users = db.users.filter((item) => item.id !== user.id);
    db.sessions = db.sessions.filter((item) => item.userId !== user.id);
    db.entitlements = db.entitlements.filter((item) => item.userId !== user.id);
    db.accountData = db.accountData.filter((item) => item.userId !== user.id);
    db.orders = db.orders.map((order) => order.userId === user.id ? { ...order, userId: "deleted-user" } : order);
    db.refunds = db.refunds.map((refund) => refund.userId === user.id ? { ...refund, userId: "deleted-user" } : refund);
  });
  (await cookies()).delete(AUTH_COOKIE);
  return NextResponse.json({ ok: true });
}
