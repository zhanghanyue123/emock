"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { SectionKey } from "@/types/test";

export function BuildSectionButton({ testId, sectionKey, label }: { testId: string; sectionKey: SectionKey; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/import/${testId}/build`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: sectionKey })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Build failed.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button onClick={() => void build()} disabled={busy}>{busy ? "Building..." : label}</Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
