"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

const links = [
  { href: "/", label: "dashboard" },
  { href: "/tests", label: "practiceSets" },
  { href: "/mistakes", label: "mistakes" },
  { href: "/vocabulary", label: "vocabulary" },
  { href: "/account", label: "account" },
  { href: "/settings", label: "settings" }
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-base font-semibold text-ink dark:text-white">Exam Practice</Link>
        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={`rounded-md px-3 py-2 text-sm ${pathname === link.href ? "bg-slate-100 text-action dark:bg-slate-800" : "text-muted hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                {t(link.label)}
              </Link>
            ))}
          </nav>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
