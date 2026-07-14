"use client";

import { useSettings } from "@/hooks/useSettings";

export function LanguageSwitcher() {
  const { settings, setSettings } = useSettings();
  return (
    <select
      aria-label="Language"
      className="h-8 rounded-md border border-line bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
      value={settings.language}
      onChange={(event) => setSettings({ ...settings, language: event.target.value as "en" | "zh" })}
    >
      <option value="en">EN</option>
      <option value="zh">中文</option>
    </select>
  );
}
