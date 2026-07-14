import { PricingClient } from "./PricingClient";
import { authAdapter } from "@/lib/server/auth-adapter";
import { PLAN_DEFINITIONS } from "@/lib/plans";

export default async function PricingPage() {
  const user = await authAdapter.getCurrentUser();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs font-medium uppercase text-muted">Plans</p>
      <h1 className="mt-2 text-3xl font-semibold">Exam Practice pricing</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Private beta pricing is configurable in one place and Alipay checkout is created on the server.</p>
      <div className="mt-6"><PricingClient plans={PLAN_DEFINITIONS} signedIn={Boolean(user)} /></div>
      <section className="mt-8 rounded-lg border border-line bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">FAQ</h2>
        <p className="mt-2 text-muted">Alipay sandbox and production are controlled by server environment variables. Production payments require public HTTPS callback URLs.</p>
      </section>
    </main>
  );
}
