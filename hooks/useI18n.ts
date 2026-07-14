"use client";

import { translate, type I18nKey } from "@/lib/i18n";
import { useSettings } from "@/hooks/useSettings";

export function useI18n() {
  const { settings } = useSettings();
  return {
    locale: settings.language,
    t: (key: I18nKey) => translate(settings.language, key)
  };
}
