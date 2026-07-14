import "server-only";
import crypto from "node:crypto";
import { AlipaySdk } from "alipay-sdk";
import { getPlan } from "@/lib/plans";
import { readDevDatabase, updateDevDatabase } from "@/lib/server/dev-database";
import { markOrderCanceled, markOrderPaid, markOrderRefunded, type CheckoutSessionResult, type CreateCheckoutInput, type PaymentProvider } from "@/lib/server/payment-provider";
import type { Order, PlanId } from "@/types/billing";

type AlipayMode = "sandbox" | "production";

interface AlipayConfig {
  mode: AlipayMode;
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  sellerId?: string;
  gateway: string;
  notifyUrl: string;
  returnUrl: string;
}

const SANDBOX_GATEWAY = "https://openapi-sandbox.dl.alipaydev.com/gateway.do";
const PRODUCTION_GATEWAY = "https://openapi.alipay.com/gateway.do";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Alipay checkout.`);
  return value.replace(/\\n/g, "\n");
}

function validPublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function getAlipayConfig(): AlipayConfig {
  const mode = process.env.ALIPAY_MODE === "production" ? "production" : "sandbox";
  const config: AlipayConfig = {
    mode,
    appId: requiredEnv("ALIPAY_APP_ID"),
    privateKey: requiredEnv("ALIPAY_PRIVATE_KEY"),
    alipayPublicKey: requiredEnv("ALIPAY_PUBLIC_KEY"),
    sellerId: process.env.ALIPAY_SELLER_ID?.trim() || undefined,
    gateway: process.env.ALIPAY_GATEWAY?.trim() || (mode === "sandbox" ? SANDBOX_GATEWAY : PRODUCTION_GATEWAY),
    notifyUrl: requiredEnv("ALIPAY_NOTIFY_URL"),
    returnUrl: requiredEnv("ALIPAY_RETURN_URL")
  };

  if (process.env.NODE_ENV === "production" && mode !== "production") {
    throw new Error("ALIPAY_MODE must be production when NODE_ENV is production.");
  }
  if (mode === "production" && (!validPublicUrl(config.notifyUrl) || !validPublicUrl(config.returnUrl))) {
    throw new Error("Production Alipay notify and return URLs must be public HTTPS URLs.");
  }
  return config;
}

function createClient(config = getAlipayConfig()) {
  return new AlipaySdk({
    appId: config.appId,
    privateKey: config.privateKey,
    alipayPublicKey: config.alipayPublicKey,
    gateway: config.gateway,
    signType: "RSA2"
  });
}

function amountToYuan(amount: number) {
  return (amount / 100).toFixed(2);
}

function alipaySubject(planName: string) {
  return `Exam Practice ${planName}`.slice(0, 256);
}

async function createPendingOrder(input: CreateCheckoutInput, providerMode: AlipayMode) {
  const plan = getPlan(input.planId);
  if (!plan || !plan.isActive || plan.id === "free") throw new Error("Selected plan is not available.");
  if (plan.billingType !== "one_time") throw new Error("This plan is not configured for one-time purchase.");

  const now = new Date().toISOString();
  const order: Order = {
    id: crypto.randomUUID(),
    userId: input.userId,
    planId: plan.id,
    amount: plan.priceAmount,
    currency: plan.currency,
    status: "pending",
    provider: "alipay",
    providerMode,
    providerOrderId: `ep_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
    idempotencyKey: crypto.randomUUID(),
    createdAt: now,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };

  await updateDevDatabase((db) => {
    db.orders.push(order);
  });
  return { order, plan };
}

function responsePayload(result: unknown) {
  if (result && typeof result === "object" && "data" in result) return (result as { data: unknown }).data;
  return result;
}

export class AlipayPaymentProvider implements PaymentProvider {
  id = "alipay";

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult> {
    const config = getAlipayConfig();
    const sdk = createClient(config);
    const { order, plan } = await createPendingOrder(input, config.mode);
    const method = input.device === "mobile" ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
    const productCode = input.device === "mobile" ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY";
    const checkoutUrl = sdk.pageExecute(method, "GET", {
      notifyUrl: config.notifyUrl,
      returnUrl: `${config.returnUrl}${config.returnUrl.includes("?") ? "&" : "?"}orderId=${encodeURIComponent(order.id)}`,
      bizContent: {
        out_trade_no: order.providerOrderId,
        product_code: productCode,
        subject: alipaySubject(plan.name),
        body: plan.description,
        total_amount: amountToYuan(plan.priceAmount),
        timeout_express: "30m"
      }
    });
    return { order, checkoutUrl, testMode: config.mode === "sandbox" };
  }

  async getPaymentStatus(orderId: string) {
    const db = await readDevDatabase();
    return db.orders.find((order) => order.id === orderId || order.providerOrderId === orderId) || null;
  }

  async queryAndSyncOrder(orderId: string) {
    const db = await readDevDatabase();
    const order = db.orders.find((item) => item.id === orderId || item.providerOrderId === orderId);
    if (!order?.providerOrderId) throw new Error("Order not found.");
    const sdk = createClient();
    const result = await sdk.exec("alipay.trade.query", { bizContent: { out_trade_no: order.providerOrderId } });
    const payload = responsePayload(result) as Record<string, unknown>;
    const data = (payload.alipay_trade_query_response || payload) as Record<string, unknown>;
    const tradeStatus = String(data.trade_status || order.providerStatus || "");
    await updateDevDatabase((currentDb) => {
      currentDb.reconciliations.push({
        id: crypto.randomUUID(),
        orderId: order.id,
        provider: this.id,
        action: "query",
        providerStatus: tradeStatus,
        matched: Boolean(data.trade_no || data.out_trade_no || tradeStatus),
        createdAt: new Date().toISOString(),
        raw: data
      });
    });
    if (["TRADE_SUCCESS", "TRADE_FINISHED"].includes(tradeStatus)) {
      return markOrderPaid({
        orderId: order.id,
        provider: this.id,
        providerEventId: `query:${String(data.trade_no || order.providerOrderId)}:${tradeStatus}`,
        providerPaymentId: String(data.trade_no || ""),
        providerStatus: tradeStatus,
        tradeNo: String(data.trade_no || ""),
        tradeStatus,
        verified: true,
        raw: data
      });
    }
    await updateDevDatabase((currentDb) => {
      const current = currentDb.orders.find((item) => item.id === order.id);
      if (current) current.providerStatus = tradeStatus || current.providerStatus;
    });
    return this.getPaymentStatus(order.id);
  }

  async closeOrder(orderId: string) {
    const db = await readDevDatabase();
    const order = db.orders.find((item) => item.id === orderId || item.providerOrderId === orderId);
    if (!order?.providerOrderId) throw new Error("Order not found.");
    if (order.status !== "pending") return order;
    const sdk = createClient();
    const result = await sdk.exec("alipay.trade.close", { bizContent: { out_trade_no: order.providerOrderId } });
    const payload = responsePayload(result) as Record<string, unknown>;
    const data = (payload.alipay_trade_close_response || payload) as Record<string, unknown>;
    return markOrderCanceled({
      orderId: order.id,
      provider: this.id,
      providerEventId: `close:${String(data.trade_no || order.providerOrderId)}`,
      providerStatus: String(data.msg || "CLOSED"),
      raw: data,
      note: "Closed by user or expired pending order."
    });
  }

  async refundOrder(orderId: string, reason = "User requested refund.") {
    const db = await readDevDatabase();
    const order = db.orders.find((item) => item.id === orderId || item.providerOrderId === orderId);
    if (!order?.providerOrderId) throw new Error("Order not found.");
    if (order.status === "refunded") return order;
    if (order.status !== "paid") throw new Error("Only paid orders can be refunded.");
    const sdk = createClient();
    const outRequestNo = `rf_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const result = await sdk.exec("alipay.trade.refund", {
      bizContent: {
        out_trade_no: order.providerOrderId,
        refund_amount: amountToYuan(order.amount),
        refund_reason: reason,
        out_request_no: outRequestNo
      }
    });
    const payload = responsePayload(result) as Record<string, unknown>;
    const data = (payload.alipay_trade_refund_response || payload) as Record<string, unknown>;
    const providerStatus = String(data.msg || data.sub_msg || "REFUNDED");
    return markOrderRefunded({
      orderId: order.id,
      provider: this.id,
      providerEventId: `refund:${String(data.trade_no || order.providerOrderId)}:${outRequestNo}`,
      providerRefundId: outRequestNo,
      providerStatus,
      reason,
      raw: data
    });
  }

  verifyNotify(params: Record<string, string>) {
    return createClient().checkNotifySignV2(params);
  }
}

export const alipayPaymentProvider = new AlipayPaymentProvider();

export async function processAlipayNotification(params: Record<string, string>) {
  const config = getAlipayConfig();
  const verified = alipayPaymentProvider.verifyNotify(params);
  const outTradeNo = params.out_trade_no;
  const tradeNo = params.trade_no;
  const tradeStatus = params.trade_status;
  const providerEventId = `notify:${tradeNo || outTradeNo}:${tradeStatus || "unknown"}`;

  const db = await readDevDatabase();
  const order = db.orders.find((item) => item.provider === "alipay" && item.providerOrderId === outTradeNo);
  const existingEvent = db.paymentEvents.find((event) => event.provider === "alipay" && event.providerEventId === providerEventId && event.processed);
  if (existingEvent) return { ok: true };
  const failure = !order
    ? "Order not found."
    : !verified
      ? "Invalid Alipay signature."
      : params.app_id !== config.appId
        ? "Alipay app_id mismatch."
        : config.sellerId && params.seller_id !== config.sellerId
          ? "Alipay seller_id mismatch."
          : params.total_amount !== amountToYuan(order.amount)
            ? "Alipay amount mismatch."
            : order.currency !== "CNY"
              ? "Order currency mismatch."
              : "";

  if (failure) {
    await updateDevDatabase((currentDb) => {
      currentDb.paymentEvents.push({
        id: crypto.randomUUID(),
        provider: "alipay",
        providerEventId,
        orderId: order?.id || outTradeNo || "unknown",
        type: "payment.notify_failed",
        tradeNo,
        tradeStatus,
        verified,
        processed: false,
        failureReason: failure,
        receivedAt: new Date().toISOString(),
        raw: params
      });
      currentDb.reconciliations.push({
        id: crypto.randomUUID(),
        provider: "alipay",
        orderId: order?.id || outTradeNo || "unknown",
        action: "notify",
        providerStatus: tradeStatus,
        matched: false,
        createdAt: new Date().toISOString(),
        raw: params,
        note: failure
      });
    });
    return { ok: false, failure };
  }
  if (!order) return { ok: false, failure: "Order not found." };

  if (!["TRADE_SUCCESS", "TRADE_FINISHED"].includes(tradeStatus)) {
    await updateDevDatabase((currentDb) => {
      currentDb.paymentEvents.push({
        id: crypto.randomUUID(),
        provider: "alipay",
        providerEventId,
        orderId: order.id,
        type: "payment.notify_ignored",
        tradeNo,
        tradeStatus,
        verified,
        processed: true,
        receivedAt: new Date().toISOString(),
        raw: params
      });
      const current = currentDb.orders.find((item) => item.id === order.id);
      if (current) current.providerStatus = tradeStatus;
      currentDb.reconciliations.push({
        id: crypto.randomUUID(),
        provider: "alipay",
        orderId: order.id,
        action: "notify",
        providerStatus: tradeStatus,
        matched: true,
        createdAt: new Date().toISOString(),
        raw: params,
        note: "Ignored non-success trade status."
      });
    });
    return { ok: true };
  }

  const paidOrder = await markOrderPaid({
    orderId: order.id,
    provider: "alipay",
    providerEventId,
    providerPaymentId: tradeNo,
    providerStatus: tradeStatus,
    tradeNo,
    tradeStatus,
    verified,
    raw: params
  });
  await updateDevDatabase((currentDb) => {
    currentDb.reconciliations.push({
      id: crypto.randomUUID(),
      provider: "alipay",
      orderId: paidOrder.id,
      action: "notify",
      providerStatus: tradeStatus,
      matched: true,
      createdAt: new Date().toISOString(),
      raw: params,
      note: "Payment success notification processed."
    });
  });
  return { ok: true };
}

export type { AlipayMode };
