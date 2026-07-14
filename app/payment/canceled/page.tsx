import { Button } from "@/components/ui/Button";

export default function PaymentCanceledPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-lg border border-line bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold">Payment canceled</h1>
        <p className="mt-2 text-sm text-muted">No membership changes were made.</p>
        <div className="mt-5"><Button href="/pricing">Back to plans</Button></div>
      </div>
    </main>
  );
}
