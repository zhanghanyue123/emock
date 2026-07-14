import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { AccountDataSync } from "@/components/account/AccountDataSync";

export const metadata: Metadata = {
  title: "Exam Practice",
  description: "Private exam practice simulator"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        <AccountDataSync />
        <main className="pb-16 md:pb-0">{children}</main>
        <MobileNav />
      </body>
    </html>
  );
}
