"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Order } from "@/types/billing";

export function PaymentSuccessClient({ orderId }: { orderId?: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState<string | null>(null);

  async function load(sync = false) {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/payments/alipay/orders/${encodeURIComponent(orderId)}${sync ? "/query" : ""}`, { method: sync ? "POST" : "GET" });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Unable to load order.");
      return;
    }
    setOrder(data.order);
  }

  useEffect(() => {
    void load(false);
    const timer = window.setTimeout(() => void load(true), 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const paid = order?.status === "paid";

  return (
    <div className={`rounded-lg border p-6 ${paid ? "border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100" : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"}`}>
      <h1 className="text-2xl font-semibold">{paid ? "Payment confirmed" : "Payment processing"}</h1>
      <p className="mt-2 text-sm">
        {paid ? "Your membership is active." : "Alipay may still be sending the final server notification. You can refresh the order status below."}
      </p>
      {order ? <p className="mt-3 text-sm">Order status: <span className="font-semibold">{order.status}</span>{order.providerStatus ? ` (${order.providerStatus})` : ""}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700 dark:text-red-200">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {orderId ? <Button onClick={() => void load(true)} disabled={loading}>{loading ? "Checking..." : "Refresh status"}</Button> : null}
        <Button href="/account/billing" variant="primary">View billing</Button>
        <Button href="/tests">Start practice</Button>
      </div>
    </div>
  );
}
