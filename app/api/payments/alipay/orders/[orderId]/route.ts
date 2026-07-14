import { NextResponse } from "next/server";
import { alipayPaymentProvider } from "@/lib/server/alipay-provider";
import { authAdapter } from "@/lib/server/auth-adapter";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await authAdapter.getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { orderId } = await params;
  const order = await alipayPaymentProvider.getPaymentStatus(orderId);
  if (!order || order.userId !== user.id) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({ order });
}
