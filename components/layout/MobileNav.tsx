"use client";

import Link from "next/link";
import { useI18n } from "@/hooks/useI18n";

export function MobileNav() {
  const { t } = useI18n();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white text-xs dark:border-slate-700 dark:bg-slate-950 md:hidden">
      <Link className="p-3 text-center" href="/">{t("home")}</Link>
      <Link className="p-3 text-center" href="/tests">{t("tests")}</Link>
      <Link className="p-3 text-center" href="/mistakes">{t("mistakes")}</Link>
      <Link className="p-3 text-center" href="/vocabulary">{t("vocabulary")}</Link>
      <Link className="p-3 text-center" href="/account">{t("account")}</Link>
    </nav>
  );
}
