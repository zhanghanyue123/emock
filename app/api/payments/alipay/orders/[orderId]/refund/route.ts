import { NextResponse } from "next/server";
import { alipayPaymentProvider } from "@/lib/server/alipay-provider";
import { authAdapter } from "@/lib/server/auth-adapter";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await authAdapter.getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const { orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const existing = await alipayPaymentProvider.getPaymentStatus(orderId);
    if (!existing || existing.userId !== user.id) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const order = await alipayPaymentProvider.refundOrder(existing.id, String(body.reason || "User requested refund."));
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Refund failed." }, { status: 400 });
  }
}
