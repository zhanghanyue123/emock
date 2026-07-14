"use client";

import { Button } from "@/components/ui/Button";

export function PaywallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">This test requires a membership.</h2>
        <p className="mt-2 text-sm text-muted">Free users can continue with the demo. Membership unlocks full tests, exports, and speaking recording.</p>
        <div className="mt-5 flex gap-2">
          <Button href="/pricing" variant="primary">View plans</Button>
          <Button href="/tests">Continue with demo</Button>
          <Button onClick={onClose} variant="ghost">Close</Button>
        </div>
      </div>
    </div>
  );
}
