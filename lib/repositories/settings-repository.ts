import { storage } from "@/lib/storage";
import type { AppSettings } from "@/types/settings";

export interface SettingsRepository {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  clearProgress(): Promise<void>;
  clearMistakes(): Promise<void>;
}

export class LocalStorageSettingsRepository implements SettingsRepository {
  async getSettings() {
    return storage.getSettings();
  }

  async saveSettings(settings: AppSettings) {
    storage.setSettings(settings);
  }

  async clearProgress() {
    storage.clearProgress();
  }

  async clearMistakes() {
    storage.clearMistakes();
  }
}
