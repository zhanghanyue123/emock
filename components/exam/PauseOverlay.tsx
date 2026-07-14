"use client";

import { Button } from "@/components/ui/Button";

export function PauseOverlay({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 px-4 text-white">
      <div className="w-full max-w-md rounded-lg border border-white/20 bg-slate-900 p-6 text-center shadow-2xl">
        <h2 className="text-2xl font-semibold">Practice paused</h2>
        <p className="mt-3 text-sm text-slate-300">Your answers and remaining time have been saved.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={onResume} variant="primary">Resume practice</Button>
          <Button onClick={onExit}>Save and exit</Button>
        </div>
      </div>
    </div>
  );
}
