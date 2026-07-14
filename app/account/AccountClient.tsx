"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function AccountClient({ signedIn }: { signedIn: boolean }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function post(url: string) {
    setError(null);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Request failed.");
      return;
    }
    window.location.reload();
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.reload();
  }

  if (signedIn) return <Button onClick={() => void signOut()}>Sign out</Button>;

  return (
    <div className="rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">Sign in or create an account</h2>
      <p className="mt-2 text-sm text-muted">Development auth uses an email-only test adapter. No passwords are stored by this project.</p>
      <input className="mt-4 h-10 w-full rounded-md border border-line px-3 dark:bg-slate-950" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button onClick={() => void post("/api/auth/signin")} variant="primary">Sign in</Button>
        <Button onClick={() => void post("/api/auth/signup")}>Create account</Button>
      </div>
    </div>
  );
}
