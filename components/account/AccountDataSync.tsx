"use client";

import { useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/constants";

const keys = Object.values(STORAGE_KEYS);

function readLocalStorageSnapshot() {
  return Object.fromEntries(keys.map((key) => [key, window.localStorage.getItem(key)]).filter(([, value]) => value !== null));
}

function isEmptyValue(value: string | null) {
  if (!value) return true;
  return ["{}", "[]", "null", "\"\""].includes(value);
}

export function AccountDataSync() {
  useEffect(() => {
    let cancelled = false;
    async function sync() {
      const response = await fetch("/api/account/data", { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const data = await response.json() as { snapshot?: { storage?: Record<string, unknown> } };
      const remote = data.snapshot?.storage || {};
      for (const key of keys) {
        const remoteValue = remote[key];
        const localValue = window.localStorage.getItem(key);
        if (typeof remoteValue === "string" && isEmptyValue(localValue) && !isEmptyValue(remoteValue)) {
          window.localStorage.setItem(key, remoteValue);
        }
      }
      await fetch("/api/account/data", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storage: readLocalStorageSnapshot() })
      });
    }
    const timer = window.setTimeout(() => void sync(), 800);
    const interval = window.setInterval(() => void sync(), 30_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);
  return null;
}
