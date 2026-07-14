"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useI18n } from "@/hooks/useI18n";
import { useSettings } from "@/hooks/useSettings";
import { LocalStorageSettingsRepository } from "@/lib/repositories/settings-repository";
import { LocalStorageVocabularyRepository } from "@/lib/repositories/vocabulary-repository";

const settingsRepository = new LocalStorageSettingsRepository();
const vocabularyRepository = new LocalStorageVocabularyRepository();

export default function SettingsPage() {
  const { settings, setSettings } = useSettings();
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("settingsTitle")}</h1>
      <div className="mt-6 grid gap-4">
        <Card className="grid gap-4">
          <label className="flex items-center justify-between gap-4 text-sm"><span>{t("language")}</span><select className="h-9 rounded-md border border-line px-2 dark:bg-slate-950" value={settings.language} onChange={(event) => setSettings({ ...settings, language: event.target.value as "en" | "zh" })}><option value="en">{t("english")}</option><option value="zh">{t("chinese")}</option></select></label>
          <label className="flex items-center justify-between gap-4 text-sm"><span>{t("practiceMode")}</span><input type="checkbox" checked={settings.practiceMode} onChange={(event) => setSettings({ ...settings, practiceMode: event.target.checked })} /></label>
          <label className="flex items-center justify-between gap-4 text-sm"><span>{t("showCountdown")}</span><input type="checkbox" checked={settings.showCountdown} onChange={(event) => setSettings({ ...settings, showCountdown: event.target.checked })} /></label>
          <label className="flex items-center justify-between gap-4 text-sm"><span>{t("autosave")}</span><input type="checkbox" checked={settings.autosave} onChange={(event) => setSettings({ ...settings, autosave: event.target.checked })} /></label>
          <label className="flex items-center justify-between gap-4 text-sm"><span>{t("darkMode")}</span><input type="checkbox" checked={settings.darkMode} onChange={(event) => setSettings({ ...settings, darkMode: event.target.checked })} /></label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>{t("defaultAudioSpeed")}</span>
            <select className="h-9 rounded-md border border-line px-2 dark:bg-slate-950" value={settings.defaultPlaybackRate} onChange={(event) => setSettings({ ...settings, defaultPlaybackRate: Number(event.target.value) as 0.75 | 1 | 1.25 })}>
              <option value={0.75}>0.75</option>
              <option value={1}>1</option>
              <option value={1.25}>1.25</option>
            </select>
          </label>
        </Card>
        <Card>
          <h2 className="font-semibold">{t("contentFolder")}</h2>
          <p className="mt-2 text-sm text-muted">{t("contentFolderHelp")}</p>
        </Card>
        <Card className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => window.confirm("Clear all local progress?") && void settingsRepository.clearProgress()}>{t("clearProgress")}</Button>
          <Button variant="danger" onClick={() => window.confirm("Clear all saved mistakes?") && void settingsRepository.clearMistakes()}>{t("clearMistakes")}</Button>
          <Button
            variant="danger"
            onClick={async () => {
              const count = (await vocabularyRepository.getAll()).length;
              if (window.confirm(`Clear vocabulary? This will remove ${count} item${count === 1 ? "" : "s"}.`)) await vocabularyRepository.clear();
            }}
          >
            {t("clearVocabulary")}
          </Button>
        </Card>
      </div>
    </div>
  );
}
