"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

export function CheckoutClient({ orderId }: { orderId?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  async function confirm() {
    setError(null);
    const response = await fetch("/api/payment/manual-confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, idempotencyKey })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Payment failed.");
      return;
    }
    setDone(true);
    window.location.href = `/payment/success?orderId=${orderId}`;
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <div className="text-xs font-semibold uppercase">TEST PAYMENT - NO REAL MONEY WILL BE CHARGED</div>
      <h1 className="mt-2 text-2xl font-semibold">Manual test checkout</h1>
      <p className="mt-2 text-sm">Order: {orderId || "missing"}</p>
      {error ? <p className="mt-3 rounded-md bg-red-100 p-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-5 flex gap-2">
        <Button onClick={() => void confirm()} variant="primary" disabled={!orderId || done}>{done ? "Confirmed" : "Confirm test payment"}</Button>
        <Button href="/payment/canceled">Cancel</Button>
      </div>
    </div>
  );
}
