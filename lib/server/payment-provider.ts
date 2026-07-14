import "server-only";
import crypto from "node:crypto";
import type { Order, PlanId } from "@/types/billing";
import { getPlan } from "@/lib/plans";
import { readDevDatabase, updateDevDatabase } from "./dev-database";

export interface CreateCheckoutInput {
  userId: string;
  planId: PlanId;
  device?: "desktop" | "mobile";
}

export interface CheckoutSessionResult {
  order: Order;
  checkoutUrl: string;
  testMode: boolean;
}

export interface PaymentProvider {
  id: string;
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult>;
  getPaymentStatus?(orderId: string): Promise<Order | null>;
  closeOrder?(orderId: string): Promise<Order | null>;
  refundOrder?(orderId: string, reason?: string): Promise<Order | null>;
  cancelSubscription?(orderId: string): Promise<Order | null>;
}

function assertTestPaymentAllowed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Manual test payments are disabled in production.");
  }
}

export function addPlanDuration(start: Date, planId: PlanId) {
  const plan = getPlan(planId);
  const next = new Date(start);
  next.setDate(next.getDate() + (plan?.durationDays || (planId === "personal_quarterly" ? 90 : 30)));
  return next;
}

export async function getOrder(orderId: string) {
  const db = await readDevDatabase();
  return db.orders.find((order) => order.id === orderId || order.providerOrderId === orderId) || null;
}

export async function markOrderPaid(input: {
  orderId: string;
  provider: string;
  providerEventId: string;
  providerPaymentId?: string;
  providerStatus?: string;
  raw: Record<string, unknown>;
  verified?: boolean;
  tradeNo?: string;
  tradeStatus?: string;
}) {
  return updateDevDatabase(async (db) => {
    const existingEvent = db.paymentEvents.find((event) => event.provider === input.provider && event.providerEventId === input.providerEventId);
    const order = db.orders.find((item) => item.id === input.orderId || item.providerOrderId === input.orderId);
    if (!order) throw new Error("Order not found.");
    if (existingEvent?.processed) return order;

    const now = new Date();
    if (order.status !== "paid") {
      order.status = "paid";
      order.paidAt = now.toISOString();
      order.providerPaymentId = input.providerPaymentId || order.providerPaymentId;
      order.providerStatus = input.providerStatus || order.providerStatus;
      const current = db.entitlements.find((item) => item.userId === order.userId && item.status === "active");
      const base = current?.expiresAt && Date.parse(current.expiresAt) > now.getTime() ? new Date(current.expiresAt) : now;
      const expiresAt = addPlanDuration(base, order.planId).toISOString();
      db.entitlements = db.entitlements.filter((item) => item.userId !== order.userId);
      db.entitlements.push({
        userId: order.userId,
        planId: order.planId,
        status: "active",
        startsAt: now.toISOString(),
        expiresAt,
        source: "purchase",
        provider: order.provider,
        providerCustomerId: order.userId,
        providerSubscriptionId: order.providerOrderId
      });
    }

    if (!existingEvent) {
      db.paymentEvents.push({
        id: crypto.randomUUID(),
        provider: input.provider,
        providerEventId: input.providerEventId,
        orderId: order.id,
        type: "payment.paid",
        tradeNo: input.tradeNo,
        tradeStatus: input.tradeStatus,
        verified: input.verified,
        processed: true,
        processedAt: now.toISOString(),
        receivedAt: now.toISOString(),
        raw: input.raw
      });
    } else {
      existingEvent.processed = true;
      existingEvent.processedAt = now.toISOString();
    }
    return order;
  });
}

export async function markOrderCanceled(input: {
  orderId: string;
  provider: string;
  providerEventId: string;
  providerStatus?: string;
  raw: Record<string, unknown>;
  note?: string;
}) {
  return updateDevDatabase((db) => {
    const order = db.orders.find((item) => item.id === input.orderId || item.providerOrderId === input.orderId);
    if (!order) throw new Error("Order not found.");
    const now = new Date().toISOString();
    if (order.status === "pending") {
      order.status = "canceled";
      order.canceledAt = now;
    }
    order.providerStatus = input.providerStatus || order.providerStatus;
    if (!db.paymentEvents.some((event) => event.provider === input.provider && event.providerEventId === input.providerEventId)) {
      db.paymentEvents.push({
        id: crypto.randomUUID(),
        provider: input.provider,
        providerEventId: input.providerEventId,
        orderId: order.id,
        type: "payment.canceled",
        tradeStatus: input.providerStatus,
        verified: true,
        processed: true,
        processedAt: now,
        receivedAt: now,
        raw: input.raw
      });
    }
    db.reconciliations.push({
      id: crypto.randomUUID(),
      orderId: order.id,
      provider: input.provider,
      action: "close",
      providerStatus: input.providerStatus,
      matched: true,
      createdAt: now,
      raw: input.raw,
      note: input.note
    });
    return order;
  });
}

export async function markOrderRefunded(input: {
  orderId: string;
  provider: string;
  providerEventId: string;
  providerRefundId?: string;
  providerStatus?: string;
  reason?: string;
  raw: Record<string, unknown>;
}) {
  return updateDevDatabase((db) => {
    const order = db.orders.find((item) => item.id === input.orderId || item.providerOrderId === input.orderId);
    if (!order) throw new Error("Order not found.");
    const now = new Date().toISOString();
    order.status = "refunded";
    order.refundedAt = now;
    order.providerStatus = input.providerStatus || "REFUNDED";
    const active = db.entitlements.find((item) => item.userId === order.userId && item.providerSubscriptionId === order.providerOrderId && item.status === "active");
    if (active) active.status = "canceled";
    db.entitlements = db.entitlements.filter((item) => !(item.userId === order.userId && item.source === "free"));
    db.entitlements.push({ userId: order.userId, planId: "free", status: "active", startsAt: now, source: "free" });
    const existingRefund = db.refunds.find((refund) => refund.orderId === order.id && refund.status === "succeeded");
    if (!existingRefund) {
      db.refunds.push({
        id: crypto.randomUUID(),
        orderId: order.id,
        userId: order.userId,
        provider: input.provider,
        providerRefundId: input.providerRefundId,
        amount: order.amount,
        currency: order.currency,
        status: "succeeded",
        reason: input.reason,
        requestedAt: now,
        processedAt: now,
        raw: input.raw
      });
    }
    if (!db.paymentEvents.some((event) => event.provider === input.provider && event.providerEventId === input.providerEventId)) {
      db.paymentEvents.push({
        id: crypto.randomUUID(),
        provider: input.provider,
        providerEventId: input.providerEventId,
        orderId: order.id,
        type: "payment.refunded",
        tradeStatus: input.providerStatus,
        verified: true,
        processed: true,
        processedAt: now,
        receivedAt: now,
        raw: input.raw
      });
    }
    db.reconciliations.push({
      id: crypto.randomUUID(),
      orderId: order.id,
      provider: input.provider,
      action: "refund",
      providerStatus: input.providerStatus || "REFUNDED",
      matched: true,
      createdAt: now,
      raw: input.raw,
      note: input.reason
    });
    return order;
  });
}

export class ManualTestPaymentProvider implements PaymentProvider {
  id = "manual_test";

  async createCheckoutSession(input: CreateCheckoutInput) {
    assertTestPaymentAllowed();
    const plan = getPlan(input.planId);
    if (!plan || !plan.isActive || plan.id === "free") throw new Error("Selected plan is not available.");
    const now = new Date().toISOString();
    const order: Order = {
      id: crypto.randomUUID(),
      userId: input.userId,
      planId: plan.id,
      amount: plan.priceAmount,
      currency: plan.currency,
      status: "pending",
      provider: this.id,
      providerOrderId: `manual_${crypto.randomUUID()}`,
      createdAt: now,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
    await updateDevDatabase((db) => {
      db.orders.push(order);
    });
    return { order, checkoutUrl: `/checkout?orderId=${order.id}`, testMode: true };
  }
}

export async function confirmManualTestPayment(orderId: string, idempotencyKey: string) {
  assertTestPaymentAllowed();
  return markOrderPaid({
    orderId,
    provider: "manual_test",
    providerEventId: idempotencyKey,
    providerPaymentId: `test_pay_${crypto.randomUUID()}`,
    providerStatus: "TEST_CONFIRMED",
    verified: true,
    raw: { orderId }
  });
}

export async function getCurrentEntitlement(userId: string) {
  const db = await readDevDatabase();
  return db.entitlements.find((item) => item.userId === userId && item.status === "active") || null;
}

export const paymentProvider = new ManualTestPaymentProvider();
