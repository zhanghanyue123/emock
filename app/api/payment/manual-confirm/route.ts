import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authAdapter } from "@/lib/server/auth-adapter";
import { confirmManualTestPayment } from "@/lib/server/payment-provider";

export async function POST(request: Request) {
  try {
    const user = await authAdapter.getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const body = await request.json();
    const order = await confirmManualTestPayment(String(body.orderId || ""), String(body.idempotencyKey || crypto.randomUUID()));
    if (order?.userId !== user.id) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment confirmation failed." }, { status: 400 });
  }
}
