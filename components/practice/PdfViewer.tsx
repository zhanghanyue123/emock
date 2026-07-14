"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function PdfViewer({ src, expectedPath, page, onPageChange }: { src: string | null; expectedPath: string; page?: number; onPageChange?: (page: number) => void }) {
  const [internalPage, setInternalPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const activePage = page || internalPage;
  const setPage = (next: number | ((current: number) => number)) => {
    const resolved = typeof next === "function" ? next(activePage) : next;
    setInternalPage(resolved);
    onPageChange?.(resolved);
  };
  const url = src ? `${src}#page=${activePage}&zoom=${zoom}` : null;

  return (
    <section className="flex min-h-[70vh] flex-col border-r border-line bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 dark:border-slate-700">
        <Button onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
        <input className="h-9 w-16 rounded-md border border-line px-2 dark:bg-slate-950" type="number" min={1} value={activePage} onChange={(event) => setPage(Math.max(1, Number(event.target.value) || 1))} />
        <Button onClick={() => setPage((value) => value + 1)}>Next</Button>
        <Button onClick={() => setZoom((value) => Math.max(60, value - 10))}>-</Button>
        <span className="text-sm text-muted">{zoom}%</span>
        <Button onClick={() => setZoom((value) => Math.min(180, value + 10))}>+</Button>
        {src ? <Button href={src} target="_blank">Open PDF</Button> : null}
      </div>
      {url ? (
        <object data={url} type="application/pdf" className="min-h-[70vh] flex-1">
          <div className="p-6 text-sm text-muted">PDF could not be loaded. Put the file at {expectedPath} or open it in a new window.</div>
        </object>
      ) : (
        <div className="flex min-h-[70vh] flex-1 items-center justify-center p-6 text-center text-sm text-muted">
          No PDF configured. Put a PDF at {expectedPath}, then reference it in manifest.json.
        </div>
      )}
    </section>
  );
}
