"use client";

import { useState } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";

export function AccountDataControls() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function clearCloudData() {
    if (!window.confirm("Delete cloud-synced study data for this account? Local browser data will stay on this device.")) return;
    setBusy(true);
    const response = await fetch("/api/account/data", { method: "DELETE" });
    setBusy(false);
    setMessage(response.ok ? "Cloud study data deleted." : "Unable to delete cloud data.");
  }

  async function deleteAccount() {
    if (!window.confirm("Permanently delete this account? Orders are anonymized for accounting records.")) return;
    setBusy(true);
    const response = await fetch("/api/account/delete", { method: "POST" });
    setBusy(false);
    if (response.ok) {
      for (const key of Object.values(STORAGE_KEYS)) window.localStorage.removeItem(key);
      window.location.assign("/account");
      return;
    }
    setMessage("Unable to delete account.");
  }

  return (
    <div className="grid gap-3 rounded-lg border border-line bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">Data and account</h2>
      <p className="text-muted">Study records sync to your account after sign-in, including attempts, submitted essays, speaking recording metadata, mistakes, vocabulary, and settings.</p>
      {message ? <p className="rounded-md bg-slate-100 p-2 dark:bg-slate-950">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void clearCloudData()} disabled={busy}>Delete cloud study data</Button>
        <Button onClick={() => void deleteAccount()} disabled={busy}>Delete account</Button>
        <Button href="/legal/privacy">Privacy policy</Button>
      </div>
    </div>
  );
}
