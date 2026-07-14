import { NextResponse } from "next/server";
import { authAdapter } from "@/lib/server/auth-adapter";
import { paymentProvider } from "@/lib/server/payment-provider";
import type { PlanId } from "@/types/billing";

export async function POST(request: Request) {
  try {
    const user = await authAdapter.getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const body = await request.json();
    const result = await paymentProvider.createCheckoutSession({ userId: user.id, planId: String(body.planId || "free") as PlanId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed." }, { status: 400 });
  }
}
