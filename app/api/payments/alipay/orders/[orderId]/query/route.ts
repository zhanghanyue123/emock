import { NextResponse } from "next/server";
import { alipayPaymentProvider } from "@/lib/server/alipay-provider";
import { authAdapter } from "@/lib/server/auth-adapter";

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await authAdapter.getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const { orderId } = await params;
    const existing = await alipayPaymentProvider.getPaymentStatus(orderId);
    if (!existing || existing.userId !== user.id) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const order = await alipayPaymentProvider.queryAndSyncOrder(existing.id);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order query failed." }, { status: 400 });
  }
}
