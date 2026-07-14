"use client";

import { useEffect } from "react";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "@/lib/constants";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { AppSettings } from "@/types/settings";

export function useSettings() {
  const [settings, setSettings, ready] = useLocalStorage<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const normalizedSettings = { ...DEFAULT_SETTINGS, ...settings };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", normalizedSettings.darkMode);
  }, [normalizedSettings.darkMode]);

  return { settings: normalizedSettings, setSettings, ready };
}
