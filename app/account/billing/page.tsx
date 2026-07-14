import { authAdapter } from "@/lib/server/auth-adapter";
import { readDevDatabase } from "@/lib/server/dev-database";
import { getCurrentEntitlement } from "@/lib/server/payment-provider";
import { getPlan, formatPlanPrice } from "@/lib/plans";
import { Button } from "@/components/ui/Button";
import { OrderActions } from "@/components/billing/OrderActions";

export default async function BillingPage() {
  const user = await authAdapter.getCurrentUser();
  if (!user) {
    return <main className="mx-auto max-w-3xl px-4 py-8"><p className="text-sm text-muted">Sign in to view billing.</p><div className="mt-3"><Button href="/account">Account</Button></div></main>;
  }
  const db = await readDevDatabase();
  const entitlement = await getCurrentEntitlement(user.id);
  const orders = db.orders.filter((order) => order.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const userOrderIds = new Set(orders.map((order) => order.id));
  const refunds = db.refunds.filter((refund) => refund.userId === user.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const reconciliations = db.reconciliations.filter((record) => userOrderIds.has(record.orderId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  const plan = getPlan(entitlement?.planId || "free");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-xs font-medium uppercase text-muted">Billing</p>
      <h1 className="mt-2 text-3xl font-semibold">Membership and orders</h1>
      <section className="mt-6 rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Current membership</h2>
        <div className="mt-3 grid gap-2 text-sm">
          <div>Plan: <span className="font-semibold">{plan?.name || "Free"}</span></div>
          <div>Status: <span className="font-semibold">{entitlement?.status || "active"}</span></div>
          <div>Started: <span className="font-semibold">{entitlement?.startsAt ? new Date(entitlement.startsAt).toLocaleString() : "n/a"}</span></div>
          <div>Expires: <span className="font-semibold">{entitlement?.expiresAt ? new Date(entitlement.expiresAt).toLocaleString() : "No expiry"}</span></div>
        </div>
      </section>
      <section className="mt-6 rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Orders</h2>
        <div className="mt-3 grid gap-2">
          {orders.map((order) => {
            const orderPlan = getPlan(order.planId);
            return (
              <div key={order.id} className="grid gap-2 rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-950">
                <div className="grid gap-1 md:grid-cols-5">
                  <span>{orderPlan?.name || order.planId}</span>
                  <span>{formatPlanPrice(orderPlan || { priceAmount: order.amount, currency: order.currency } as never)}</span>
                  <span>{order.status}{order.providerStatus ? ` · ${order.providerStatus}` : ""}</span>
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                  <span className="truncate text-xs text-muted">{order.providerOrderId || order.id}</span>
                </div>
                <OrderActions order={order} />
              </div>
            );
          })}
          {orders.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : null}
        </div>
      </section>
      <section className="mt-6 rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Refunds</h2>
        <div className="mt-3 grid gap-2 text-sm">
          {refunds.map((refund) => (
            <div key={refund.id} className="grid gap-1 rounded-md bg-slate-100 p-3 dark:bg-slate-950 md:grid-cols-4">
              <span>{refund.status}</span>
              <span>¥{(refund.amount / 100).toFixed(2)}</span>
              <span>{refund.reason || "Refund"}</span>
              <span>{new Date(refund.requestedAt).toLocaleString()}</span>
            </div>
          ))}
          {refunds.length === 0 ? <p className="text-sm text-muted">No refunds.</p> : null}
        </div>
      </section>
      <section className="mt-6 rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Reconciliation records</h2>
        <div className="mt-3 grid gap-2 text-sm">
          {reconciliations.map((record) => (
            <div key={record.id} className="grid gap-1 rounded-md bg-slate-100 p-3 dark:bg-slate-950 md:grid-cols-5">
              <span>{record.action}</span>
              <span>{record.providerStatus || "n/a"}</span>
              <span>{record.matched ? "matched" : "unmatched"}</span>
              <span>{new Date(record.createdAt).toLocaleString()}</span>
              <span className="truncate text-xs text-muted">{record.note || record.orderId}</span>
            </div>
          ))}
          {reconciliations.length === 0 ? <p className="text-sm text-muted">No reconciliation records yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
