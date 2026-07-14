"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Order } from "@/types/billing";

export function OrderActions({ order }: { order: Order }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function post(action: "query" | "close" | "refund") {
    setBusy(action);
    setMessage(null);
    const body = action === "refund" ? JSON.stringify({ reason: "User requested refund." }) : undefined;
    const response = await fetch(`/api/payments/alipay/orders/${encodeURIComponent(order.id)}/${action}`, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setMessage(data.error || "Request failed.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => void post("query")} disabled={Boolean(busy)}>{busy === "query" ? "Checking..." : "Query"}</Button>
      {order.status === "pending" ? <Button onClick={() => void post("close")} disabled={Boolean(busy)}>{busy === "close" ? "Closing..." : "Close unpaid"}</Button> : null}
      {order.status === "paid" ? <Button onClick={() => void post("refund")} disabled={Boolean(busy)}>{busy === "refund" ? "Refunding..." : "Refund"}</Button> : null}
      {message ? <span className="text-xs text-red-600">{message}</span> : null}
    </div>
  );
}
