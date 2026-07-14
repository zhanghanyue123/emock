import { AccountClient } from "./AccountClient";
import { PricingClient } from "../pricing/PricingClient";
import { Button } from "@/components/ui/Button";
import { authAdapter } from "@/lib/server/auth-adapter";
import { getCurrentEntitlement } from "@/lib/server/payment-provider";
import { PLAN_DEFINITIONS, getPlan, isEntitlementActive } from "@/lib/plans";
import { AccountDataControls } from "@/components/account/AccountDataControls";

export default async function AccountPage() {
  const user = await authAdapter.getCurrentUser();
  const entitlement = user ? await getCurrentEntitlement(user.id) : null;
  const plan = getPlan(isEntitlementActive(entitlement) ? entitlement?.planId || "free" : "free");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-xs font-medium uppercase text-muted">Account</p>
      <h1 className="mt-2 text-3xl font-semibold">Your account</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          {user ? (
            <>
              <div className="text-sm text-muted">Signed in as</div>
              <div className="mt-1 text-lg font-semibold">{user.email}</div>
              <div className="mt-4 grid gap-2 text-sm">
                <div>Current plan: <span className="font-semibold">{plan?.name || "Free"}</span></div>
                <div>Status: <span className="font-semibold">{entitlement?.status || "active"}</span></div>
                <div>Expires: <span className="font-semibold">{entitlement?.expiresAt ? new Date(entitlement.expiresAt).toLocaleDateString() : "No expiry"}</span></div>
              </div>
              <div className="mt-5 flex gap-2"><Button href="/account/billing">Billing</Button><Button href="#plans" variant="primary">View plans</Button></div>
            </>
          ) : <AccountClient signedIn={false} />}
        </section>
        <aside className="rounded-lg border border-line bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Local data migration</h2>
          <p className="mt-2 text-muted">Import local practice data will merge attempts, history, mistakes, vocabulary, and settings into the user repository once a production database adapter is connected. Local data is never deleted automatically.</p>
        </aside>
      </div>
      {user ? (
        <div className="mt-4 grid gap-4">
          <AccountDataControls />
          <AccountClient signedIn />
        </div>
      ) : null}
      <section id="plans" className="mt-6">
        <p className="text-xs font-medium uppercase text-muted">Plans</p>
        <h2 className="mt-2 text-2xl font-semibold">Choose a plan</h2>
        <div className="mt-4"><PricingClient plans={PLAN_DEFINITIONS} signedIn={Boolean(user)} /></div>
      </section>
      <section className="mt-6 rounded-lg border border-line bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Service terms</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button href="/legal/terms">User agreement</Button>
          <Button href="/legal/privacy">Privacy policy</Button>
          <Button href="/legal/paid-service">Paid service</Button>
          <Button href="/legal/refund-policy">Refund rules</Button>
          <Button href="/legal/contact">Contact</Button>
          <Button href="/legal/account-deletion">Account deletion</Button>
        </div>
      </section>
    </main>
  );
}
