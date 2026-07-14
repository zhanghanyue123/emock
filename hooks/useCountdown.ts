"use client";

import { useEffect } from "react";

interface CountdownOptions {
  seconds: number;
  running: boolean;
  enabled: boolean;
  onTick: (seconds: number) => void;
  onDone: () => void;
}

export function useCountdown({ seconds, running, enabled, onTick, onDone }: CountdownOptions) {
  useEffect(() => {
    if (!enabled || !running || seconds <= 0) return;
    const timer = window.setInterval(() => {
      onTick(Math.max(0, seconds - 1));
      if (seconds <= 1) onDone();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [enabled, onDone, onTick, running, seconds]);
}
