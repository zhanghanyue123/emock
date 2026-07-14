"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function BuildInteractiveTestButton({ testId }: { testId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    setStatus("Scanning source files...");
    setError(null);
    const response = await fetch(`/api/import/${testId}/build`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setStatus(null);
      setError(data.error || "Build failed.");
      return;
    }
    setStatus(`Build complete: ${data.report?.recognized?.totalQuestions || data.report?.recognized?.readingQuestions || 0} questions recognized.`);
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void build()} variant="primary">Build all sections</Button>
        <Button href={`/practice/${testId}/reading?mode=exam`}>Start exam mode</Button>
      </div>
      {status ? <p className="text-sm text-muted">{status}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
