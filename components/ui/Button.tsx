import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "border-action bg-action text-white hover:bg-blue-700",
  secondary: "border-line bg-white text-ink hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100",
  ghost: "border-transparent bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
  danger: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-200"
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  target?: string;
  variant?: Variant;
  children: ReactNode;
}

export function Button({ href, target, variant = "secondary", className = "", children, ...props }: Props) {
  const classes = `inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`;
  if (href) return <Link className={classes} href={href} target={target}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}
