"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatPlanPrice } from "@/lib/plans";
import type { PlanDefinition } from "@/types/billing";

export function PricingClient({ plans, signedIn }: { plans: PlanDefinition[]; signedIn: boolean }) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(planId: string) {
    setLoadingPlan(planId);
    setError(null);
    const device = window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop";
    const response = await fetch("/api/payments/alipay/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId, device })
    });
    const data = await response.json();
    setLoadingPlan(null);
    if (!response.ok) {
      setError(data.error || "Checkout failed.");
      return;
    }
    window.location.assign(data.checkoutUrl);
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {error ? <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 md:col-span-3">{error}</div> : null}
      {plans.filter((plan) => !plan.hidden).map((plan) => (
        <article key={plan.id} className="rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-sm font-medium text-muted">{plan.durationDays ? `${plan.durationDays} days` : plan.billingInterval || plan.billingType}</div>
          <h2 className="mt-2 text-xl font-semibold">{plan.name}</h2>
          <div className="mt-3 text-3xl font-semibold">{formatPlanPrice(plan)}</div>
          <p className="mt-2 min-h-12 text-sm text-muted">{plan.description}</p>
          <div className="mt-4 grid gap-2 text-sm">
            <span>{plan.entitlements.canAccessFullTests ? "Full tests" : "Demo access"}</span>
            <span>{plan.entitlements.canUseMistakeBook ? "Mistake book" : "Limited mistakes"}</span>
            <span>{plan.entitlements.canExportVocabulary ? "Vocabulary export" : "Limited vocabulary"}</span>
            <span>{plan.entitlements.canRecordSpeaking ? "Speaking recording" : "No speaking recording"}</span>
          </div>
          <div className="mt-5">
            {plan.id === "free" ? (
              <Button href="/tests">Continue with demo</Button>
            ) : signedIn ? (
              <Button onClick={() => void checkout(plan.id)} variant="primary" disabled={loadingPlan === plan.id}>
                {loadingPlan === plan.id ? "Creating order..." : "Pay with Alipay"}
              </Button>
            ) : (
              <Button href="/account" variant="primary">Sign in to buy</Button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
